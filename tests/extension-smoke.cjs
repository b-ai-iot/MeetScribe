const {chromium}=require('playwright');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 let extension=path.resolve(__dirname,'../extension');const artifacts=path.resolve(__dirname,'../artifacts');
 await fs.mkdir(artifacts,{recursive:true});
 const fixture=await fs.mkdtemp(path.join(artifacts,'extension-fixture-'));await fs.cp(extension,fixture,{recursive:true});const manifest=JSON.parse(await fs.readFile(fixture+'/manifest.json'));manifest.host_permissions=['https://meet.google.com/*','https://app.zoom.us/*'];await fs.writeFile(fixture+'/manifest.json',JSON.stringify(manifest));extension=fixture;
 const profile=await fs.mkdtemp(path.join(artifacts,'smoke-profile-'));const downloadDir=path.join(profile,'downloads');await fs.mkdir(path.join(profile,'Default'),{recursive:true});
 await fs.writeFile(path.join(profile,'Default/Preferences'),JSON.stringify({download:{default_directory:downloadDir,prompt_for_download:false},plugins:{always_open_pdf_externally:true}}));
 const context=await chromium.launchPersistentContext(profile,{headless:true,channel:'chromium',args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`],acceptDownloads:true});
 try{
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker',{timeout:15000});
  console.log('Real extension worker ready');
  const errors=[];worker.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const page=await context.newPage();const pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));
  await page.route('https://meet.google.com/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><meta charset="utf-8"><title>Meet - Enfarm smoke test</title><body style="background:#202124;color:#fff;font:16px system-ui"><h1>Enfarm demo meeting</h1><div aria-label="Phụ đề" id="caps" style="position:fixed;right:24px;bottom:100px;padding:24px">Alice: actual extension test caption</div><button aria-label="Rời cuộc họp">Rời cuộc họp</button></body></html>'}));
  await page.goto('https://meet.google.com/abc-defg-hij');
  const dev=await context.newCDPSession(page);await dev.send('Browser.setDownloadBehavior',{behavior:'default'});
  const css=await fs.readFile(extension+'/overlay.css','utf8');
  await worker.evaluate(async css=>{
   const [tab]=await chrome.tabs.query({url:'https://meet.google.com/*'});
   await chrome.scripting.executeScript({target:{tabId:tab.id},files:['content.js']});
   await chrome.tabs.sendMessage(tab.id,{scope:'meetscribe',target:'content',type:'mount',css});
  },css);
  console.log('Content toolbar mounted');
  await page.getByRole('button',{name:'Bắt đầu ghi',exact:true}).click();
  console.log('Start requested');

  await page.getByRole('button',{name:'Dừng và lưu',exact:true}).waitFor();
  await page.locator('#caps').evaluate(el=>el.textContent='Bao: verified Stop drain');
  await page.getByRole('button',{name:'Dừng và lưu',exact:true}).click();
  console.log('Stop requested');
  await page.waitForFunction(()=>document.querySelector('meetscribe-toolbar')?.shadowRoot.getElementById('status').textContent==='Đã dừng');
  const lib=await context.newPage();await lib.goto(worker.url().replace('/background.js','/library.html'));
  const result={sessions:await lib.evaluate(async()=> (await import('./store.mjs')).listSessions())};
  assert.equal(result.sessions.length,1);assert.equal(result.sessions[0].status,'completed');assert.ok(result.sessions[0].count>=1);
  for(let i=0;i<80;i++){
   if(!(await lib.evaluate(async()=> (await (await import('./store.mjs')).listSessions())[0].pendingExports)))break;
   await new Promise(r=>setTimeout(r,250));
  }
  const complete={s:await lib.evaluate(async()=> (await (await import('./store.mjs')).listSessions())[0]),downloads:await worker.evaluate(()=>chrome.downloads.search({limit:30}))};
  console.log('Export state',JSON.stringify({status:complete.s.status,pending:complete.s.pendingExports,error:complete.s.exportError,downloads:complete.downloads.map(d=>({name:d.filename,state:d.state,error:d.error}))}));
  assert.equal(complete.s.pendingExports,0);
  const captions=complete.downloads.find(d=>d.filename.endsWith('.jsonl'));assert.ok(captions);assert.match(await fs.readFile(captions.filename,'utf8'),/verified Stop drain/);
  assert.ok(complete.downloads.some(d=>d.filename.endsWith('/finished.json')&&d.state==='complete'));
  assert.deepEqual(pageErrors,[]);assert.deepEqual(errors,[]);
  await page.screenshot({path:artifacts+'/extension-real-smoke.png'});
  await lib.reload();await lib.getByRole('heading',{name:'Enfarm smoke test',exact:true}).waitFor();
  await lib.screenshot({path:artifacts+'/library-desktop.png',fullPage:true});

  // Seed 1MiB deterministic binary and Vietnamese captions before library export
  const binary1M = Buffer.alloc(1024 * 1024);
  let st = 0x5a17c9e3;
  for (let i = 0; i < binary1M.length; i++) {
    st ^= st << 13; st ^= st >>> 17; st ^= st << 5;
    binary1M[i] = st & 255;
  }
  const viCaption = JSON.stringify({sequence: 2, timestamp: '2026-10-30T10:30:00Z', text: 'Bảo: Thống nhất kế hoạch phiên bản 1.2.0.'}) + '\n';
  await lib.evaluate(async ({sid, b64, cap}) => {
    const store = await import('./store.mjs');
    await store.writeFile(sid, 'images/slide-01.png', 'data:image/png;base64,' + b64, 'image/png', true);
    await store.writeFile(sid, 'captions/part-000002.jsonl', cap, 'application/octet-stream');
  }, {sid: complete.s.id, b64: binary1M.toString('base64'), cap: viCaption});

  const expectedBinaryPath = path.join(artifacts, 'expected-1m.bin');
  await fs.writeFile(expectedBinaryPath, binary1M);

  // Trigger production export-zip from library UI
  const zipBtn = lib.locator('.zip-btn').first();
  await zipBtn.click();
  let zipItem;
  for (let i = 0; i < 40; i++) {
   const items = await worker.evaluate(() => chrome.downloads.search({limit: 30}));
   zipItem = items.find(d => d.filename.endsWith('.zip') && d.state === 'complete');
   if (zipItem) break;
   await new Promise(r => setTimeout(r, 250));
  }
  assert.ok(zipItem, 'ZIP download completed from library UI');
  const {execFileSync} = require('node:child_process');
  const pyOut = execFileSync('python3', ['-c', `
import sys, zipfile
archive, expected_bin = sys.argv[1:3]
with zipfile.ZipFile(archive) as z:
    names = z.namelist()
    assert 'transcript.md' in names
    assert 'README-for-AI.md' in names
    assert 'manifest.json' in names
    assert 'images/slide-01.png' in names
    assert any(n.endswith('.jsonl') for n in names)
    assert z.testzip() is None
    assert z.read('images/slide-01.png') == open(expected_bin, 'rb').read()
    assert 'Thống nhất kế hoạch' in z.read('transcript.md').decode('utf-8')
    print('PASS unpacked extension production ZIP export with 1MiB binary and Vietnamese verified by Python zipfile')
`, zipItem.filename, expectedBinaryPath], {encoding: 'utf8'});
  console.log(pyOut.trim());

  await fs.writeFile(artifacts+'/extension-smoke-result.json',JSON.stringify({session:complete.s,downloads:complete.downloads.map(({filename,state})=>({filename,state})),pageErrors,workerErrors:errors},null,2));
  console.log('PASS real unpacked extension: content -> service worker -> IndexedDB -> confirmed actual Downloads files -> library');
  const zoom=await context.newPage();const zoomErrors=[];zoom.on('pageerror',e=>zoomErrors.push(e.message));
  await zoom.route('https://app.zoom.us/**',route=>{
   const url=new URL(route.request().url());
   const inner=url.searchParams.get('inner')==='1';
   const body=inner?'<div id="meeting-app"><div class="live-transcription-subtitle__box" id="zoomcaps">Bao: Real Zoom iframe caption</div><div id="share-region" style="position:fixed;right:10px;top:100px;width:300px;height:200px;background:green">Selected shared slide</div><button aria-label="Leave">Leave</button></div>':'<iframe id="webclient" style="position:fixed;left:80px;top:40px;width:900px;height:600px;border:0" src="https://app.zoom.us/wc/123/join?inner=1"></iframe><iframe title="Unrelated notes" src="https://unrelated.example/notes"></iframe>';
   return route.fulfill({contentType:'text/html',body:'<!doctype html><html><meta charset="utf-8"><title>Zoom - Enfarm iframe smoke</title><body>'+body+'</body></html>'});
  });
  await zoom.route('https://unrelated.example/**',route=>route.fulfill({contentType:'text/html',body:'<div>Unrelated notes: not a caption</div>'}));
  await zoom.goto('https://app.zoom.us/wc/123/join?fromPWA=1');
  const installedFrame=await lib.evaluate(async()=>{const [tab]=await chrome.tabs.query({url:'https://app.zoom.us/*'});return (await import('./install.mjs')).installToolbar(chrome,tab.id);});
  assert.notEqual(installedFrame,0);
  const client=zoom.frameLocator('#webclient');await client.getByRole('button',{name:'Bắt đầu ghi',exact:true}).click();
  await client.getByRole('button',{name:'Dừng và lưu',exact:true}).waitFor();
  await client.getByRole('button',{name:'Vùng share',exact:true}).click();await client.locator('#share-region').hover();await client.locator('#share-region').click();
  const runningZoom=await lib.evaluate(async()=> (await (await import('./store.mjs')).listSessions()).find(s=>s.platform==='zoom'));
  const visualProbe=await context.newPage();await visualProbe.goto(worker.url().replace('/background.js','/offscreen.html'));
  const roi=await visualProbe.evaluate(async sid=>chrome.runtime.sendMessage({scope:'meetscribe',target:'worker',type:'visual-inspect',sid}),runningZoom.id);
  assert.equal(roi.ok,true);assert.equal(roi.shareAvailable,true);
  const selectedBox=await client.locator('#share-region').boundingBox();const viewport=zoom.viewportSize();
  for(const [actual,expected] of [[roi.rect.x,selectedBox.x/viewport.width],[roi.rect.y,selectedBox.y/viewport.height],[roi.rect.w,selectedBox.width/viewport.width],[roi.rect.h,selectedBox.height/viewport.height]])assert.ok(Math.abs(actual-expected)<.002);
  await visualProbe.close();
  await client.locator('#zoomcaps').evaluate(el=>el.textContent='Bao: Zoom iframe last caption before Stop');
  await client.getByRole('button',{name:'Dừng và lưu',exact:true}).click();
  await zoom.frameLocator('#webclient').getByRole('status').filter({hasText:'Đã dừng'}).waitFor();
  let zs;for(let i=0;i<80;i++){zs=await lib.evaluate(async()=> (await (await import('./store.mjs')).listSessions()).find(s=>s.platform==='zoom'));if(zs&&!zs.pendingExports)break;await new Promise(r=>setTimeout(r,250));}
  assert.equal(zs.status,'completed');assert.equal(zs.frameId,installedFrame);assert.equal(zs.pendingExports,0);
  const zdownloads=await worker.evaluate(()=>chrome.downloads.search({limit:50}));const zcaption=zdownloads.find(d=>d.filename.includes('Enfarm iframe smoke')&&d.filename.endsWith('.jsonl'));
  assert.ok(zcaption);const ztext=await fs.readFile(zcaption.filename,'utf8');assert.match(ztext,/Zoom iframe last caption/);assert.doesNotMatch(ztext,/Unrelated notes/);assert.deepEqual(zoomErrors,[]);
  await zoom.screenshot({path:artifacts+'/zoom-iframe-smoke.png'});await fs.writeFile(artifacts+'/zoom-smoke-result.json',JSON.stringify({session:zs,installedFrame,errors:zoomErrors},null,2));
  console.log('PASS real unpacked Zoom PWA: correct child frame, auto-discovered captions, persisted frame routing, worker-confirmed whole-tab ROI mapping, actual JSONL Downloads and Stop drain; unrelated iframe excluded');
 }finally{await context.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
