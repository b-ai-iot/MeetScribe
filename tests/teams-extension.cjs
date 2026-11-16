// Real unpacked extension on synthetic Teams-shaped pages; never joins a live meeting.
const {chromium}=require('playwright');
const {expandToolbar}=require('./toolbar-fixture.cjs');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
async function poll(read,predicate){
 for(let n=0;n<200;n++){const value=await read();if(predicate(value))return value;await new Promise(resolve=>setTimeout(resolve,100));}
 assert.fail('Timed out waiting for real extension state');
}
(async()=>{
 const artifacts=path.resolve(__dirname,'../artifacts');await fs.mkdir(artifacts,{recursive:true});
 const fixture=await fs.mkdtemp(path.join(artifacts,'teams-extension-'));
 await fs.cp(path.resolve(__dirname,'../extension'),fixture,{recursive:true});
 const manifest=JSON.parse(await fs.readFile(fixture+'/manifest.json','utf8'));
 manifest.host_permissions=['https://teams.microsoft.com/*','https://teams.cloud.microsoft/*','https://teams.live.com/*'];
 await fs.writeFile(fixture+'/manifest.json',JSON.stringify(manifest));
 const profile=await fs.mkdtemp(path.join(artifacts,'teams-profile-')),downloads=path.join(profile,'downloads');
 await fs.mkdir(path.join(profile,'Default'),{recursive:true});
 await fs.writeFile(path.join(profile,'Default/Preferences'),JSON.stringify({download:{default_directory:downloads,prompt_for_download:false}}));
 const context=await chromium.launchPersistentContext(profile,{headless:true,channel:'chromium',viewport:{width:1280,height:900},args:[`--disable-extensions-except=${fixture}`,`--load-extension=${fixture}`],acceptDownloads:true});
 const errors=[];
 try{
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
  const lib=await context.newPage();await lib.goto(worker.url().replace('/background.js','/library.html'));
  const dev=await context.newCDPSession(lib);await dev.send('Browser.setDownloadBehavior',{behavior:'default'});
  const visualProbe=await context.newPage();await visualProbe.goto(worker.url().replace('/background.js','/offscreen.html'));
  for(const [index,host,language,iframe,manual] of [[0,'teams.microsoft.com','vi',false,false],[1,'teams.cloud.microsoft','en',true,false],[2,'teams.live.com','vi',false,true]]){
   await lib.evaluate(language=>chrome.storage.local.set({meetscribe_setting_language:language}),language);
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   await page.route('https://'+host+'/**',route=>{
    const inner=new URL(route.request().url()).searchParams.has('inner');
    const body=iframe&&!inner?`<iframe id="client" style="position:fixed;left:80px;top:40px;width:1000px;height:700px;border:0" src="https://${host}/v2/?inner=1"></iframe>`:
     `<main><h1>Teams fixture ${index}</h1><div role="log" aria-label="Meeting chat">CHAT MUST NOT BE CAPTURED</div><div id="caps" ${manual?'':'data-tid="closed-caption-renderer-wrapper"'} style="position:fixed;left:20px;bottom:30px;padding:18px;background:#25283c"><div data-tid="${manual?'manual-caption':'closed-caption-renderer'}"><span data-tid="author">Lan</span><span data-tid="closed-caption-text">Teams initial ${index}</span></div><div><span>Bảo</span><span>Tiếng Việt unchanged ${index}</span></div></div><div id="slide" style="position:fixed;left:100px;top:120px;width:280px;height:180px;background:#6554d9">Shared slide</div><button aria-label="Leave">Leave</button></main>`;
    return route.fulfill({contentType:'text/html',body:`<!doctype html><html><meta charset="utf-8"><title>Microsoft Teams - Teams fixture ${index}</title><body style="font:16px Arial">${body}</body></html>`});
   });
   await page.goto('https://'+host+'/v2/');
   const frameId=await lib.evaluate(async host=>{const [tab]=await chrome.tabs.query({url:'https://'+host+'/*'});return (await import('./install.mjs')).installToolbar(chrome,tab.id);},host);
   assert.equal(frameId===0,!iframe);
   const client=iframe?page.frameLocator('#client'):page;await expandToolbar(client);
   if(manual){await client.getByRole('button',{name:'Vùng caption',exact:true}).click();await client.locator('#caps').hover({position:{x:4,y:4}});await client.locator('#caps').click({position:{x:4,y:4}});}
   await client.getByRole('button',{name:language==='en'?'Start recording':'Bắt đầu ghi',exact:true}).click();
   await client.getByRole('button',{name:language==='en'?'Stop and save':'Dừng và lưu',exact:true}).waitFor();
   await client.locator('#caps [data-tid="closed-caption-text"]').evaluate((el,index)=>el.textContent='Updated Teams '+index,index);
   if(!manual){
    await client.locator('#caps').evaluate((el,index)=>{const replacement=el.cloneNode(true);replacement.querySelector('[data-tid="closed-caption-text"]').textContent='Reacquired Teams '+index;el.replaceWith(replacement);},index);
    await poll(()=>lib.evaluate(async index=>(await(await import('./store.mjs')).listSessions()).find(s=>s.title==='Teams fixture '+index),index),s=>s?.captionTail?.includes('Reacquired Teams'));
   }
   await client.getByRole('button',{name:language==='en'?'Share region':'Vùng share',exact:true}).click();await client.locator('#slide').hover();await client.locator('#slide').click();
   const running=await lib.evaluate(async index=>(await(await import('./store.mjs')).listSessions()).find(s=>s.title==='Teams fixture '+index),index);
   assert.equal(running.platform,'teams');assert.equal(running.frameId,frameId);
   const roi=await visualProbe.evaluate(async sid=>chrome.runtime.sendMessage({scope:'meetscribe',target:'worker',type:'visual-inspect',sid}),running.id);
   assert.equal(roi.ok,true,'Teams share rectangle must map to the actual tab');
   assert.equal(roi.shareAvailable,true);
   const box=await client.locator('#slide').boundingBox(),viewport=page.viewportSize();
   for(const [a,b]of [[roi.rect.x,box.x/viewport.width],[roi.rect.y,box.y/viewport.height],[roi.rect.w,box.width/viewport.width],[roi.rect.h,box.height/viewport.height]])assert.ok(Math.abs(a-b)<.002);
   await client.locator('#caps [data-tid="closed-caption-text"]').evaluate((el,index)=>el.textContent='Final Teams stop drain '+index,index);
   await client.getByRole('button',{name:language==='en'?'Stop and save':'Dừng và lưu',exact:true}).click();
   // Media-start warnings can legitimately remain visible after Stop in a fixture
   // without an activeTab grant. Wait for the persisted outcome, not its status label.
   await poll(()=>lib.evaluate(async sid=>(await import('./store.mjs')).getSession(sid),running.id),s=>s?.status==='completed'&&s.pendingExports===0);
   const completed=await lib.evaluate(async sid=>(await import('./store.mjs')).getSession(sid),running.id);
   assert.match(completed.captionTail,/Final Teams stop drain/);assert.doesNotMatch(completed.captionTail,/CHAT MUST/);
   const files=await worker.evaluate(()=>chrome.downloads.search({limit:100}));
   const parts=files.filter(x=>x.filename.includes('Teams fixture '+index+'--')&&x.filename.endsWith('.jsonl'));
   assert.ok(parts.length);let raw='';for(const part of parts){assert.equal(part.state,'complete');raw+=await fs.readFile(part.filename,'utf8');}
   assert.match(raw,/Final Teams stop drain/);assert.match(raw,/Tiếng Việt unchanged/);assert.doesNotMatch(raw,/CHAT MUST/);
   const exported=await lib.evaluate(async sid=>chrome.runtime.sendMessage({scope:'meetscribe',target:'worker',type:'export-zip',sid,saveAs:false,destination:'downloads'}),running.id);
   assert.equal(exported.ok,true);
   const zipItems=await worker.evaluate(()=>chrome.downloads.search({limit:100}));const zip=zipItems.find(x=>x.filename.endsWith(exported.filename)&&x.state==='complete');assert.ok(zip);
   const {execFileSync}=require('node:child_process');execFileSync('python3',['-c',`import zipfile,json,sys\nwith zipfile.ZipFile(sys.argv[1]) as z:\n assert z.testzip() is None\n assert json.loads(z.read('session.json'))['platform']=='teams'\n assert 'Final Teams stop drain' in z.read('transcript.md').decode()\n assert 'README-for-AI.md' in z.namelist()`,zip.filename]);
   if(index===0)await page.screenshot({path:artifacts+'/teams-web-smoke.png'});
   console.log('PASS Teams '+host+' '+language+': '+(iframe?'child-frame ROI':'top-frame ROI')+', '+(manual?'manual captions':'auto discovery/reacquisition')+', Stop drain, real Downloads and production ZIP');
   await page.close();
  }
  assert.deepEqual(errors,[]);
 }finally{await context.close();await fs.rm(fixture,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1});
