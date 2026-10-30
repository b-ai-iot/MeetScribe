// End-to-end language switching through real extension pages, storage and worker.
const {chromium}=require('playwright');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');

(async()=>{
 const scratch=await fs.mkdtemp(path.join(os.tmpdir(),'meetscribe-language-'));let context;
 try{
  const extension=path.join(scratch,'extension');await fs.cp(path.join(root,'extension'),extension,{recursive:true});
  const manifest=JSON.parse(await fs.readFile(extension+'/manifest.json','utf8'));
  manifest.host_permissions=['https://meet.google.com/*','https://app.zoom.us/*'];
  await fs.writeFile(extension+'/manifest.json',JSON.stringify(manifest));
  const profile=path.join(scratch,'profile');await fs.mkdir(profile+'/Default',{recursive:true});
  await fs.writeFile(profile+'/Default/Preferences',JSON.stringify({download:{default_directory:path.join(scratch,'downloads'),prompt_for_download:false}}));
  context=await chromium.launchPersistentContext(profile,{headless:true,channel:'chromium',viewport:{width:1440,height:960},acceptDownloads:true,
   args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
  const base=worker.url().replace('/background.js','');
  const errors=[];context.on('page',page=>page.on('pageerror',e=>errors.push(e.message)));
  await context.route('https://meet.google.com/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><title>Meet - Nguyên bản &lt;img&gt;</title><div aria-label="Phụ đề" id="caps" style="position:fixed;bottom:60px;left:500px;width:400px;height:100px">Lan: Giữ nguyên tiếng Việt &lt;script&gt;</div><button aria-label="Leave">Leave</button>'}));
  const meeting=await context.newPage();await meeting.goto('https://meet.google.com/language-fixture');
  const cdp=await context.newCDPSession(meeting);await cdp.send('Browser.setDownloadBehavior',{behavior:'default'});
  const settings=await context.newPage();await settings.goto(base+'/settings.html');
  const library=await context.newPage();await library.goto(base+'/library.html');
  await settings.locator('#languageInput').waitFor();assert.equal(await settings.locator('#languageInput').inputValue(),'vi');
  await settings.getByRole('heading',{name:'Cài đặt MeetScribe',exact:true}).waitFor();
  await library.evaluate(async()=>{const [tab]=await chrome.tabs.query({url:'https://meet.google.com/*'});await (await import('./install.mjs')).installToolbar(chrome,tab.id);});
  await meeting.getByRole('button',{name:'Bắt đầu ghi',exact:true}).click();
  await meeting.getByRole('button',{name:'Dừng và lưu',exact:true}).waitFor();
  await library.locator('#refresh').click();await library.locator('.session-title').waitFor();
  const originalTitle=await library.locator('.session-title').textContent();
  const originalFolder=await library.locator('.path').textContent();
  async function choose(language){
   await settings.locator('#languageInput').selectOption(language);await settings.locator('#saveBtn').click();
   await settings.waitForFunction(language=>document.documentElement.lang===language,language);
   await library.waitForFunction(language=>document.documentElement.lang===language,language);
   await settings.waitForFunction(language=>chrome.storage.local.get('meetscribe_setting_language').then(x=>x.meetscribe_setting_language===language),language);
  }
  await choose('en');
  await meeting.getByRole('button',{name:'Stop and save',exact:true}).waitFor();
  await settings.getByRole('heading',{name:'MeetScribe settings',exact:true}).waitFor();
  assert.match(await settings.title(),/Settings/i);
  assert.match(await library.title(),/Meeting library/i);
  assert.equal(await library.locator('.session-title').textContent(),originalTitle);
  assert.equal(await library.locator('.path').textContent(),originalFolder);
  await library.waitForFunction(()=>chrome.action.getTitle({}).then(value=>value==='Open MeetScribe'));
  let response=await library.evaluate(async()=>{const {listSessions}=await import('./store.mjs');return chrome.runtime.sendMessage({scope:'meetscribe',target:'worker',type:'rename',sid:(await listSessions())[0].id,title:''});});
  assert.equal(response.ok,false);assert.equal(response.errorCode,'system.invalidTitle');assert.equal(response.error,'Invalid title');
  await meeting.locator('#caps').evaluate(el=>el.textContent='Minh: Nội dung sau chuyển English <img onerror=alert(1)>');
  await meeting.getByRole('button',{name:'Mark',exact:true}).click();
  await meeting.waitForFunction(()=>document.querySelector('meetscribe-toolbar').shadowRoot.getElementById('metrics').textContent.startsWith('2 captions'));
  assert.match(await meeting.locator('meetscribe-toolbar').evaluate(el=>el.shadowRoot.getElementById('message').textContent),/Caption marker saved/);
  await choose('vi');await meeting.getByRole('button',{name:'Dừng và lưu',exact:true}).waitFor();
  await meeting.evaluate(()=>{document.getElementById('caps').textContent='Lan: Dòng cuối không dịch <script>';document.querySelector('meetscribe-toolbar').shadowRoot.getElementById('stop').click();});
  await meeting.waitForFunction(()=>document.querySelector('meetscribe-toolbar').shadowRoot.getElementById('status').textContent==='Đã dừng');
  const stored=await library.evaluate(async()=>{const store=await import('./store.mjs');const [s]=await store.listSessions();const files=await store.allSessionFiles(s.id);return {s,entries:files.filter(f=>f.name.endsWith('.jsonl')).flatMap(f=>f.data.trim().split('\n').map(JSON.parse))};});
  assert.equal(stored.s.title,originalTitle);assert.equal(stored.s.status,'completed');
  assert.deepEqual(stored.entries.map(x=>x.text),['Lan: Giữ nguyên tiếng Việt <script>','Minh: Nội dung sau chuyển English <img onerror=alert(1)>','Lan: Dòng cuối không dịch <script>']);
  assert.deepEqual(stored.entries.map(x=>x.sequence),[1,2,3]);
  await choose('en');await settings.reload();await settings.locator('#languageInput').waitFor();
  await settings.waitForFunction(()=>document.documentElement.lang==='en');assert.equal(await settings.locator('#languageInput').inputValue(),'en');
  await library.locator('#refresh').click();await library.getByRole('button',{name:'Download ZIP for AI',exact:true}).waitFor();
  const zip=await library.evaluate(sid=>chrome.runtime.sendMessage({scope:'meetscribe',target:'worker',type:'export-zip',sid,destination:'downloads'}),stored.s.id);
  assert.equal(zip.ok,true,zip.error);
  const [download]=await worker.evaluate(id=>chrome.downloads.search({id}),zip.downloadId);assert.equal(download.state,'complete');
  execFileSync('python3',['-c',`import zipfile,sys,json
with zipfile.ZipFile(sys.argv[1]) as z:
 assert z.testzip() is None
 assert 'Meeting capture:' in z.read('transcript.md').decode()
 assert 'AI meeting summary guide' in z.read('README-for-AI.md').decode()
 entries=[json.loads(row) for n in z.namelist() if n.endswith('.jsonl') for row in z.read(n).decode().splitlines()]
 assert entries[-1]['text']=='Lan: Dòng cuối không dịch <script>'
`,download.filename]);
  await settings.locator('#resetBtn').click();
  await settings.waitForFunction(()=>document.documentElement.lang==='vi');
  await library.waitForFunction(()=>document.documentElement.lang==='vi');
  await meeting.getByRole('button',{name:'Bắt đầu ghi',exact:true}).waitFor();
  assert.equal(await settings.locator('#languageInput').inputValue(),'vi');
  assert.deepEqual(errors,[]);
  console.log('PASS unpacked extension: persisted VI/EN/reset across open Settings/Library/toolbar, active capture and final drain, structured worker errors, English ZIP helpers with untouched raw captions.');
 }finally{if(context)await context.close();await fs.rm(scratch,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
