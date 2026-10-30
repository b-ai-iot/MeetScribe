const {chromium}=require('playwright');
const http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../extension');
async function injectI18n(page){for(const file of ['i18n.js','i18n-ui.js','i18n-toolbar.js','i18n-system.js'])await page.addScriptTag({path:root+'/'+file});}
(async()=>{
 await fs.mkdir(path.resolve(__dirname,'../artifacts'),{recursive:true});
 const server=http.createServer(async(req,res)=>{try{const file=path.join(root,new URL(req.url,'http://test').pathname);if(!file.startsWith(root+'/'))throw Error();res.setHeader('Content-Type',file.endsWith('.mjs')||file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(await fs.readFile(file));}catch{res.writeHead(404).end();}}).listen(0,'127.0.0.1');
 await new Promise(r=>server.once('listening',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.MEETSCRIBE_TEST_CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const base=`http://127.0.0.1:${server.address().port}`;let passed=0;
 try{
 const page=await browser.newPage();await page.goto(base+'/library.html');
 const journal=await page.evaluate(async()=>{
  const s=await import('./store.mjs');
  await s.createSession({id:'test',title:'Demo',folder:'MeetScribe/test',tabId:1,status:'recording',count:0,lastSequence:0,createdAt:new Date().toISOString()});
  const entries=[{sequence:1,timestamp:'2026-10-29T10:00:00Z',text:'Alice: hello'}];
  await s.appendCaptions('test',entries);await s.appendCaptions('test',entries);
  const before=await s.getSession('test');const pending=await s.pendingFiles('test');
  const part=pending.find(x=>x.name.includes('captions/'));
  return {count:before.count,lastSequence:before.lastSequence,partCount:pending.filter(x=>x.name.includes('captions/')).length,text:part.data,id:part.id};
 });
 assert.equal(journal.count,1);assert.equal(journal.lastSequence,1);assert.equal(journal.partCount,1);assert.match(journal.text,/Alice: hello/);passed++;console.log('PASS durable IndexedDB acknowledgement and idempotent resend');
 await page.reload();
 assert.equal(await page.evaluate(async()=> (await (await import('./store.mjs')).getSession('test')).count),1);passed++;console.log('PASS persisted journal survives page reload');
 const downloads=await page.evaluate(async()=>{
  const {exportFile}=await import('./downloads.mjs');const s=await import('./store.mjs');
  const file=(await s.pendingFiles('test')).find(x=>x.name.includes('captions/'));
  const interrupted={download:async()=>42,search:async()=>[{id:42,state:'interrupted',error:'FILE_FAILED'}]};
  let error='';try{await exportFile(file,interrupted,()=>Promise.resolve());}catch(e){error=e.message;}
  const stillPending=(await s.pendingFiles('test')).some(x=>x.id===file.id);
  const complete={download:async()=>43,search:async()=>[{id:43,state:'complete',filename:'/Downloads/MeetScribe/test/captions/part-000001.jsonl'}]};
  await exportFile(file,complete,()=>Promise.resolve());
  return {error,stillPending,exported:!(await s.pendingFiles('test')).some(x=>x.id===file.id)};
 });
 assert.match(downloads.error,/FILE_FAILED/);assert.equal(downloads.stillPending,true);assert.equal(downloads.exported,true);passed++;console.log('PASS interrupted export retained then retry confirmed complete');
  const customDirTest=await page.evaluate(async()=>{
   const s=await import('./store.mjs');
   const dest=await import('./destination.mjs');
   const opfs=await navigator.storage.getDirectory();
   const realFolder=await opfs.getDirectoryHandle('MyCustomMeetingFolder',{create:true});
   await s.saveDirectoryHandle(realFolder,'custom-dest-1');
   const retrievedHandle=await s.getDirectoryHandle('custom-dest-1');
   const handlePersisted=retrievedHandle instanceof FileSystemDirectoryHandle && retrievedHandle.name==='MyCustomMeetingFolder';

   // Regression: non-serializable object must reject with DataCloneError and preserve prior active destination
   let cloneErrorName='';
   try{
    await s.saveDirectoryHandle({name:'fake-folder',badFunction:()=>{}});
   }catch(e){
    cloneErrorName=e.name;
   }
   const activeAfterError=await s.getActiveDirectoryHandleId();
   const activeRetained = activeAfterError === 'custom-dest-1';

   await s.createSession({id:'custom-sess',title:'Custom Meeting',folder:'MeetScribe/custom',tabId:9,status:'recording',count:0,lastSequence:0,createdAt:new Date().toISOString(),destination:'customDirectory',destinationId:'custom-dest-1'});
   await s.appendCaptions('custom-sess',[{sequence:1,timestamp:'2026-10-30T10:00:00Z',text:'Test caption custom'}]);
   const files=await s.pendingFiles('custom-sess');
   const capFile=files.find(f=>f.name.includes('captions/'));
   await dest.exportFileToDirectory(capFile,retrievedHandle);
   const pendingAfter=await s.pendingFiles('custom-sess');
   const captionExported=!pendingAfter.some(f=>f.id===capFile.id);

   // Verify exportFileToDirectory checks permission rejection properly
   const deniedHandle={
    kind:'directory',
    name:'denied-dir',
    async queryPermission(){return 'denied';}
   };
   let revokedError='';
   try{
    const file2=pendingAfter[0];
    await dest.exportFileToDirectory(file2,deniedHandle);
   }catch(e){revokedError=e.message;}

   const pendingFinal=await s.pendingFiles('custom-sess');
   return {handlePersisted,cloneErrorName,activeRetained,captionExported,revokedError,stillHasPending:pendingFinal.length>0};
  });
  assert.equal(customDirTest.handlePersisted,true);
  assert.equal(customDirTest.cloneErrorName,'DataCloneError');
  assert.equal(customDirTest.activeRetained,true);
  assert.equal(customDirTest.captionExported,true);
  assert.match(customDirTest.revokedError,/chưa được cấp quyền ghi/);
  assert.equal(customDirTest.stillHasPending,true);
  passed++;console.log('PASS custom directory handle persistence, DataCloneError rejection preserving prior destination, and revoked permission protection');
  const opfsTest=await page.evaluate(async()=>{
   const s=await import('./store.mjs');
   const dest=await import('./destination.mjs');
   const opfs=await navigator.storage.getDirectory();
   await s.saveDirectoryHandle(opfs,'opfs-real-dest');
   const retrieved=await s.getDirectoryHandle('opfs-real-dest');
   const isRealHandle=retrieved instanceof FileSystemDirectoryHandle;

   await s.createSession({id:'opfs-sess',title:'OPFS Meeting',folder:'MeetScribe/opfs',tabId:11,status:'recording',count:0,lastSequence:0,createdAt:new Date().toISOString(),destination:'customDirectory',destinationId:'opfs-real-dest'});
   await s.appendCaptions('opfs-sess',[{sequence:1,timestamp:'2026-10-30T10:00:00Z',text:'OPFS real caption'}]);
   const files=await s.pendingFiles('opfs-sess');
   const capFile=files.find(f=>f.name.includes('captions/'));
   await dest.exportFileToDirectory(capFile,retrieved);

   const parts=capFile.name.split('/').filter(Boolean);
   let cur=opfs;
   for(let i=0;i<parts.length-1;i++)cur=await cur.getDirectoryHandle(parts[i]);
   const fh=await cur.getFileHandle(parts[parts.length-1]);
   const fileObj=await fh.getFile();
   const readText=await fileObj.text();
   const pendingNow=await s.pendingFiles('opfs-sess');
   return {isRealHandle,hasText:readText.includes('OPFS real caption'),exported:!pendingNow.some(f=>f.id===capFile.id)};
  });
  assert.equal(opfsTest.isRealHandle,true);
  assert.equal(opfsTest.hasText,true);
  assert.equal(opfsTest.exported,true);
  passed++;console.log('PASS OPFS-based real FileSystemDirectoryHandle integration check (OPFS platform handle, distinct from OS showDirectoryPicker)');
 const budgets=await page.evaluate(async()=>{
  const s=await import('./store.mjs');await s.createSession({id:'budget',title:'Images',folder:'MeetScribe/budget',tabId:2,status:'recording',count:0,lastSequence:0,createdAt:new Date().toISOString()});
  let rejected=false;for(let i=0;i<31;i++){try{await s.saveImage('budget',{name:`screen-${i}.png`,data:'data:image/png;base64,AAAA',bytes:3,event:{capturedAt:new Date().toISOString()}});}catch{rejected=true;}}
  return {rejected,images:(await s.getSession('budget')).images};
 });
 assert.equal(budgets.rejected,true);assert.equal(budgets.images,30);passed++;console.log('PASS hourly image budget enforced across capture restarts in durable transaction');
 const atomic=await page.evaluate(async()=>{
  const s=await import('./store.mjs');await s.createSession({id:'abort',title:'Atomic',folder:'MeetScribe/abort',tabId:4,status:'stopping',count:0,lastSequence:0,createdAt:new Date().toISOString()});
  const original=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value,...rest){if(this.name==='files'&&value.name.endsWith('/finished.json'))throw Error('Simulated final write failure');return original.call(this,value,...rest);};
  let rejected=false;try{await s.finalizeSession('abort',{reason:'test'});}catch{rejected=true;}finally{IDBObjectStore.prototype.put=original;}
  const result=await s.getSession('abort');const files=await s.pendingFiles('abort');return {rejected,status:result.status,finalFiles:files.filter(f=>/finished.json|session-final.json/.test(f.name)).length};
 });
 assert.equal(atomic.rejected,true);assert.equal(atomic.status,'stopping');assert.equal(atomic.finalFiles,0);passed++;console.log('PASS failed final write rolls back completed status, metadata and completion marker together');
 const finalized=await page.evaluate(async()=>{
  const s=await import('./store.mjs');
  await s.patchSession('test',{status:'stopping'});
  await s.finalizeSession('test',{reason:'user-stop'});
  await s.finalizeSession('test',{reason:'duplicate-stop'});
  const session=await s.getSession('test'),files=await s.pendingFiles('test');
  return {status:session.status,reason:session.reason,files:files.map(f=>f.name),pending:session.pendingExports};
 });
 assert.equal(finalized.status,'completed');assert.equal(finalized.reason,'user-stop');
 assert.ok(finalized.files.some(f=>f.endsWith('/finished.json')));assert.ok(finalized.files.some(f=>f.endsWith('/session-final.json')));
 assert.equal(finalized.pending,finalized.files.length);passed++;console.log('PASS atomic idempotent finalization creates final metadata and marker with consistent export count');
  const zipTest=await page.evaluate(async()=>{
   const s=await import('./store.mjs');
   const {buildSessionArchive}=await import('./archive.mjs');
   const sess=await s.getSession('test');
   const allFiles=await s.allSessionFiles('test');

   let activeRejected=false;
   try{
    await buildSessionArchive({...sess,status:'recording'},allFiles);
   }catch{activeRejected=true;}

   const zipBytes=await buildSessionArchive(sess,allFiles);
   return {
    activeRejected,
    allFilesCount:allFiles.length,
    zipLength:zipBytes.length,
    zipBase64:btoa(String.fromCharCode(...zipBytes))
   };
  });
  assert.equal(zipTest.activeRejected,true);
  assert.ok(zipTest.allFilesCount>0);
  assert.ok(zipTest.zipLength>100);

  const testZipBuf=Buffer.from(zipTest.zipBase64,'base64');
  const tempZipPath=path.resolve(__dirname,'../artifacts/browser-test-session.zip');
  await fs.writeFile(tempZipPath,testZipBuf);
  const {execFileSync}=require('node:child_process');
  const pyCheck=`
import zipfile, sys
with zipfile.ZipFile(sys.argv[1], 'r') as zf:
    names = zf.namelist()
    assert 'transcript.md' in names
    assert 'README-for-AI.md' in names
    assert 'manifest.json' in names
    print(len(names))
`;
  const countStr=execFileSync('python3',['-c',pyCheck,tempZipPath],{encoding:'utf8'}).trim();
  assert.ok(parseInt(countStr,10)>=3);
  passed++;console.log('PASS portable session ZIP: all journal files, transcript/README/manifest, and Python zipfile verification');

  const boundedCheck = await page.evaluate(async () => {
    const s = await import('./store.mjs');
    await s.createSession({ id: 'budget-export', title: 'Export Budget', folder: 'MeetScribe/budget-export', tabId: 99, status: 'recording', count: 0, lastSequence: 0, createdAt: new Date().toISOString() });
    await s.writeFile('budget-export', 'captions/huge.jsonl', 'x'.repeat(2000));
    await s.finalizeSession('budget-export', { reason: 'done' });
    let rejected = false;
    let errMessage = '';
    try {
      await s.readSessionFilesBounded('budget-export', 1000);
    } catch (e) {
      rejected = true;
      errMessage = e.message;
    }
    const normal = await s.allSessionFiles('budget-export');
    const withinBudget = await s.readSessionFilesBounded('budget-export', 50000);
    return { rejected, errMessage, normalCount: normal.length, withinBudgetCount: withinBudget.length };
  });
  assert.equal(boundedCheck.rejected, true);
  assert.match(boundedCheck.errMessage, /Kích thước tệp nén vượt quá giới hạn an toàn/);
  assert.equal(boundedCheck.normalCount, boundedCheck.withinBudgetCount);
  passed++; console.log('PASS session-scoped cursor size-limited reader for export halts on budget limit');

 await page.close();
 const ui=await browser.newPage({viewport:{width:1440,height:900}});
 await ui.goto(base+'/library.html');
 await ui.setContent('<html lang="vi"><body style="background:#202124;color:#fff;font:16px system-ui"><h1>Meet · Enfarm product review</h1><div id="caps" aria-label="Phụ đề" style="position:absolute;right:24px;bottom:110px;width:340px;padding:24px;background:#303134;border-radius:16px">Alice: Caption đầu tiên</div></body></html>');
 const errors=[];ui.on('pageerror',e=>errors.push(e.message));
 await ui.evaluate(()=>{
  window.handlers=[];window.persisted=[];window.invalid=false;window.starts=0;
  const session={id:'ui',title:'Enfarm product review',folder:'MeetScribe/2026-10-29/Enfarm--150627--test',status:'recording',count:0,images:0,pendingExports:0,createdAt:new Date().toISOString(),lastSequence:0,visual:'not-selected'};
  window.chrome={runtime:{id:'fixture',onMessage:{addListener(fn){handlers.push(fn);},removeListener(){}},sendMessage(msg){
   if(window.invalid)throw Error('Extension context invalidated.');
   return (async()=>{
    if(msg.type==='start'){if(starts)session.id='ui-'+starts;session.status='recording';starts++;await new Promise(r=>handlers[0]({scope:'meetscribe',target:'content',type:'begin',session},{id:'fixture'},r));return {ok:true,session};}
    if(msg.type==='visual-start'){session.visual='ready';return {ok:true,session};}
    if(msg.type==='caption'){if(window.failCaption)throw Error('Temporary worker messaging failure');persisted.push(...msg.entries);session.count=persisted.length;return {ok:true,count:session.count};}
    if(msg.type==='stop'){await new Promise(r=>handlers[0]({scope:'meetscribe',target:'content',type:'end'},{id:'fixture'},r));session.status='completed';return {ok:true,session};}
    return {ok:true,session:starts?session:null};
   })();
  }}};
  window.cmd=(type,data={})=>new Promise(r=>handlers[0]({scope:'meetscribe',target:'content',type,...data},{id:'fixture'},r));
 });
 await injectI18n(ui);await ui.addScriptTag({path:root+'/content.js'});
 const css=await fs.readFile(root+'/overlay.css','utf8');await ui.evaluate(css=>cmd('mount',{css}),css);
 await ui.getByRole('button',{name:'Bắt đầu ghi',exact:true}).evaluate(el=>{el.click();el.click();});
 await ui.waitForFunction(()=>starts===1);
 await ui.locator('#caps').evaluate(el=>el.innerText='Alice: Nội dung đã cập nhật');
 await fs.mkdir(path.resolve(__dirname,'../artifacts'),{recursive:true});await ui.locator('meetscribe-toolbar').screenshot({path:path.resolve(__dirname,'../artifacts/toolbar-live.png')});
 await ui.getByRole('button',{name:'Dừng và lưu',exact:true}).click();
 await ui.waitForFunction(()=>persisted.some(e=>e.text.includes('Nội dung đã cập nhật')));
 await ui.evaluate(()=>cmd('status',{session:{id:'ui',status:'recording',count:1,images:0,createdAt:new Date().toISOString()}}));
 assert.equal(await ui.getByRole('button',{name:'Dừng và lưu',exact:true}).isVisible(),false);
 assert.equal(await ui.evaluate(()=>starts),1);passed++;console.log('PASS floating Start lock and Stop drains latest caption');
 await ui.getByRole('button',{name:'Thu nhỏ',exact:true}).click();
 assert.equal(await ui.getByRole('button',{name:'Mở rộng MeetScribe',exact:true}).isVisible(),true);
 await ui.getByRole('button',{name:'Mở rộng MeetScribe',exact:true}).click();
 await fs.mkdir(path.resolve(__dirname,'../artifacts'),{recursive:true});
 await ui.screenshot({path:path.resolve(__dirname,'../artifacts/toolbar-desktop.png')});
 await ui.setViewportSize({width:768,height:900});await ui.screenshot({path:path.resolve(__dirname,'../artifacts/toolbar-tablet.png')});
 await ui.setViewportSize({width:375,height:812});
 await ui.screenshot({path:path.resolve(__dirname,'../artifacts/toolbar-narrow.png')});
 const bounds=await ui.locator('meetscribe-toolbar').boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=376);
 passed++;console.log('PASS collapse/expand and narrow viewport bounds');
 // A transient failed flush must allow explicit resumption without losing queued captions.
 await ui.evaluate(()=>{window.failCaption=true;});
 await ui.getByRole('button',{name:'Bắt đầu ghi',exact:true}).click();
 await ui.evaluate(async()=>{const el=document.getElementById('caps');for(let i=0;i<101;i++){el.innerText='Pending recovery '+i;await Promise.resolve();}});
 await ui.getByRole('button',{name:'Thử lưu và tiếp tục',exact:true}).waitFor();
 await ui.evaluate(()=>window.failCaption=false);
 await ui.getByRole('button',{name:'Thử lưu và tiếp tục',exact:true}).click();
 await ui.waitForFunction(()=>persisted.some(e=>e.text==='Pending recovery 100'));
 assert.equal(await ui.getByRole('button',{name:'Dừng và lưu',exact:true}).isVisible(),true);
 passed++;console.log('PASS transient message failure retains caption queue and supports resume');
 await ui.evaluate(()=>{const slide=document.createElement('div');slide.id='slide';slide.textContent='Shared slide';slide.style.cssText='position:fixed;right:5px;top:10px;width:100px;height:80px;background:green';document.body.append(slide);});
 await ui.getByRole('button',{name:'Vùng share',exact:true}).click();await ui.locator('#slide').hover();await ui.locator('#slide').click();
 await ui.waitForFunction(()=>document.querySelector('meetscribe-toolbar').shadowRoot.getElementById('message').textContent.includes('Đã chọn vùng share'));
 await ui.locator('#slide').evaluate(el=>el.remove());
 await ui.evaluate(()=>cmd('status',{session:{id:'ui',status:'recording',visual:'ready',count:5,images:1,createdAt:new Date().toISOString()}}));
 assert.match(await ui.locator('meetscribe-toolbar').evaluate(el=>el.shadowRoot.getElementById('message').textContent),/Mất vùng share/);
 passed++;console.log('PASS removed share region prompts reselection while captions continue');
 await ui.evaluate(()=>window.invalid=true);
 await ui.getByRole('button',{name:'Thư viện phiên họp',exact:true}).click();
 await ui.getByRole('button',{name:'Cứu caption đang chờ',exact:true}).waitFor();
 assert.deepEqual(errors,[]);passed++;console.log('PASS synchronous invalid extension context is visible with rescue and no uncaught errors');
 await ui.close();
 const visual=await browser.newPage();await visual.goto(base+'/library.html');await visual.setContent('<video id=source muted></video>');
 await visual.evaluate(()=>{
  window.vhandlers=[];window.trackStops=0;
  Object.defineProperty(HTMLMediaElement.prototype,'srcObject',{configurable:true,get(){return this._stream||null;},set(v){this._stream=v;}});
  HTMLMediaElement.prototype.play=async()=>{};
  const track={stop(){trackStops++;},addEventListener(){}};
  Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:()=>new Promise(r=>window.releaseMedia=()=>r({getTracks:()=>[track],getVideoTracks:()=>[track]}))});
  window.chrome={runtime:{id:'fixture',onMessage:{addListener(fn){vhandlers.push(fn);}},sendMessage:async()=>({ok:true,shareAvailable:false})}};
  window.vcmd=(type,data={})=>new Promise(r=>vhandlers[0]({scope:'meetscribe',target:'offscreen',type,sid:'v',...data},{id:'fixture'},r));
 });
 await visual.addScriptTag({path:root+'/offscreen.js',type:'module'});
 await visual.waitForFunction(()=>vhandlers.length===1);
 await visual.evaluate(()=>{window.pendingStart=vcmd('start',{streamId:'test'});});
 await visual.waitForFunction(()=>typeof releaseMedia==='function');
 await visual.evaluate(()=>vcmd('stop'));await visual.evaluate(()=>releaseMedia());
 await visual.evaluate(()=>pendingStart);
 assert.equal(await visual.evaluate(()=>trackStops),1);
 assert.equal(await visual.locator('video').evaluate(el=>el.srcObject===null),true);
 passed++;console.log('PASS Stop during pending media start prevents late stream/sampler attachment');await visual.close();
 const media=await browser.newPage();await media.goto(base+'/library.html');await media.setContent('<video id=source muted playsinline></video>');
 await media.evaluate(()=>{
  window.mediaHandlers=[];window.captured=[];window.visualEvents=[];
  const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;const c=canvas.getContext('2d');c.fillStyle='#ff0000';c.fillRect(0,0,160,180);c.fillStyle='#00ff00';c.fillRect(160,0,160,180);
  window.sourceStream=canvas.captureStream(10);window.keepCanvas=canvas;
  Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:async constraints=>{if(constraints.audio!==false)throw Error('Unexpected audio');return sourceStream;}});
  window.chrome={runtime:{id:'fixture',onMessage:{addListener(fn){mediaHandlers.push(fn);}},async sendMessage(msg){
   if(msg.type==='visual-inspect')return {ok:true,shareAvailable:true,rect:{x:.5,y:0,w:.5,h:1,key:'selected-share'},captionAt:'2026-10-29T08:00:00Z',captionContext:'Caption near selected slide'};
   if(msg.type==='visual-frame')captured.push(msg);if(msg.type==='visual-event')visualEvents.push(msg);
   return {ok:true};
  }}};
  window.mcmd=(type,data={})=>new Promise(r=>mediaHandlers[0]({scope:'meetscribe',target:'offscreen',type,sid:'media',...data},{id:'fixture'},r));
 });
 await media.addScriptTag({path:root+'/offscreen.js',type:'module'});await media.waitForFunction(()=>mediaHandlers.length===1);
 await media.evaluate(()=>mcmd('start',{streamId:'fixture'}));
 await media.waitForFunction(()=>captured.length===1);
 const crop=await media.evaluate(async()=>{const img=new Image();img.src=captured[0].data;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);return {w:img.width,h:img.height,pixel:[...ctx.getImageData(Math.floor(img.width/2),Math.floor(img.height/2),1,1).data],context:captured[0].event.captionContext};});
 assert.equal(crop.w,160);assert.equal(crop.h,180);assert.ok(crop.pixel[1]>240&&crop.pixel[0]<10&&crop.pixel[2]<10&&crop.pixel[3]===255);assert.match(crop.context,/Caption near/);
 await media.evaluate(()=>mcmd('mark'));assert.equal(await media.evaluate(()=>captured.length),1);
 await media.evaluate(()=>mcmd('stop'));assert.equal(await media.evaluate(()=>sourceStream.getTracks()[0].readyState),'ended');
 passed++;console.log('PASS real synthetic video crop saves selected ROI + caption context, deduplicates identical mark, stops tracks');await media.close();
 const zoom=await browser.newPage();await zoom.goto(base+'/library.html');await zoom.setContent('<html lang="vi"><body><div id="meeting-app"><div class="live-transcription-subtitle__box">Bao: Zoom caption đầu tiên</div></div></body></html>');
 await zoom.evaluate(()=>{
  window.zhandlers=[];window.zsaved=[];const session={id:'zoom',title:'Zoom browser check',status:'recording',count:0,images:0,createdAt:new Date().toISOString()};
  window.chrome={runtime:{id:'fixture',onMessage:{addListener(fn){zhandlers.push(fn);}},async sendMessage(msg){
   if(msg.type==='start'){await new Promise(r=>zhandlers[0]({scope:'meetscribe',target:'content',type:'begin',session},{id:'fixture'},r));return {ok:true,session};}
   if(msg.type==='caption'){zsaved.push(...msg.entries);return {ok:true,count:zsaved.length};}
   if(msg.type==='stop'){await new Promise(r=>zhandlers[0]({scope:'meetscribe',target:'content',type:'end'},{id:'fixture'},r));return {ok:true,session:{...session,status:'completed'}};}
   return {ok:true,session};
  }}};
  window.zcmd=(type,data={})=>new Promise(r=>zhandlers[0]({scope:'meetscribe',target:'content',type,...data},{id:'fixture'},r));
 });
 await zoom.addScriptTag({path:root+'/captions.js'});
 await injectI18n(zoom);await zoom.addScriptTag({path:root+'/content.js'});await zoom.evaluate(css=>zcmd('mount',{css}),css);
 await zoom.getByRole('button',{name:'Bắt đầu ghi',exact:true}).click();
 await zoom.locator('.live-transcription-subtitle__box').evaluate(el=>el.innerText='Bao: Zoom caption cuối');
 await zoom.getByRole('button',{name:'Dừng và lưu',exact:true}).click();
 assert.equal(await zoom.evaluate(()=>zsaved.some(e=>e.text==='Bao: Zoom caption cuối')),true);
 passed++;console.log('PASS Zoom subtitle container auto-discovery and Stop drain');await zoom.close();

 const meet=await browser.newPage();await meet.goto(base+'/library.html');
 await meet.setContent(`<!doctype html><html><body>
  <div id="chat" class="chat-container" role="log" aria-label="Tin nhắn trong cuộc trò chuyện">Alice: Đừng lưu cái này</div>
  <div id="meet-caps" aria-label="Phụ đề" style="position:fixed;bottom:80px;left:50px;width:600px;height:60px">Nguyễn Văn A: Caption đầu tiên</div>
 </body></html>`);
 await meet.evaluate(()=>{
  window.mhandlers=[];window.msaved=[];const session={id:'meet-test',title:'Meet caption check',status:'recording',count:0,images:0,createdAt:new Date().toISOString()};
  window.chrome={runtime:{id:'fixture',onMessage:{addListener(fn){mhandlers.push(fn);}},async sendMessage(msg){
   if(msg.type==='start'){await new Promise(r=>mhandlers[0]({scope:'meetscribe',target:'content',type:'begin',session},{id:'fixture'},r));return {ok:true,session};}
   if(msg.type==='caption'){msaved.push(...msg.entries);return {ok:true,count:msaved.length};}
   if(msg.type==='stop'){await new Promise(r=>mhandlers[0]({scope:'meetscribe',target:'content',type:'end'},{id:'fixture'},r));return {ok:true,session:{...session,status:'completed'}};}
   return {ok:true,session};
  }}};
  window.mcmd=(type,data={})=>new Promise(r=>mhandlers[0]({scope:'meetscribe',target:'content',type,...data},{id:'fixture'},r));
 });
 await meet.addScriptTag({path:root+'/captions.js'});
 await injectI18n(meet);await meet.addScriptTag({path:root+'/content.js'});
 await meet.evaluate(css=>mcmd('mount',{css}),css);
 await meet.getByRole('button',{name:'Bắt đầu ghi',exact:true}).click();

 assert.equal(await meet.evaluate(()=>msaved.some(e=>e.text.includes('Đừng lưu cái này'))),false);
 const highlightRes=await meet.evaluate(()=>mcmd('highlight-caption',{durationMs:1000}));
 assert.equal(highlightRes.captionAvailable,true);

 await meet.evaluate(()=>{
  document.getElementById('meet-caps').remove();
  const newCaps=document.createElement('div');
  newCaps.id='meet-caps-2';
  newCaps.setAttribute('aria-label','Phụ đề');
  newCaps.style.cssText='position:fixed;bottom:80px;left:50px;width:600px;height:60px;';
  newCaps.innerText='Trần Thị B: Caption sau khi re-render';
  document.body.appendChild(newCaps);
 });

 await meet.evaluate(()=>mcmd('inspect'));
 await meet.locator('#meet-caps-2').evaluate(el=>el.innerText='Trần Thị B: Caption sau khi re-render kết thúc');
 await meet.getByRole('button',{name:'Dừng và lưu',exact:true}).click();

 assert.equal(await meet.evaluate(()=>msaved.some(e=>e.text.includes('Caption sau khi re-render'))),true);
 passed++;console.log('PASS Meet caption discovery, replacement reacquisition, chat exclusion and highlight');await meet.close();
 const settingsPage=await browser.newPage({viewport:{width:1280,height:800}});
 await settingsPage.goto(base+'/settings.html');
 assert.equal(await settingsPage.locator('#opacityInput').inputValue(),'96');
 assert.equal(await settingsPage.locator('#fontSizeInput').inputValue(),'14');
 assert.equal(await settingsPage.locator('input[value="downloads"]').isChecked(),true);
 assert.equal(await settingsPage.locator('#customDirSection').isVisible(),false);
 await settingsPage.locator('input[value="customDirectory"]').check();
 assert.equal(await settingsPage.locator('#customDirSection').isVisible(),true);
 await settingsPage.locator('input[value="downloads"]').check();
 assert.equal(await settingsPage.locator('#customDirSection').isVisible(),false);
 await settingsPage.locator('#opacityInput').fill('65');
 await settingsPage.locator('#opacityInput').dispatchEvent('input');
 await settingsPage.locator('#fontSizeInput').fill('16');
 await settingsPage.locator('#fontSizeInput').dispatchEvent('input');
 const previewBg=await settingsPage.locator('#previewPanel').evaluate(el=>getComputedStyle(el).backgroundColor);
 assert.match(previewBg,/rgba\(20,\s*28,\s*34,\s*0\.65\)/);
 const previewFs=await settingsPage.locator('#previewPanel').evaluate(el=>getComputedStyle(el).fontSize);
 assert.equal(previewFs,'16px');
 await settingsPage.locator('#saveBtn').click();
 await settingsPage.waitForFunction(()=>document.getElementById('statusBanner').classList.contains('show'));
 assert.match(await settingsPage.locator('#statusBanner').textContent(),/Đã lưu/);
 await settingsPage.screenshot({path:path.resolve(__dirname,'../artifacts/settings-desktop.png')});
 await settingsPage.setViewportSize({width:375,height:812});
 await settingsPage.screenshot({path:path.resolve(__dirname,'../artifacts/settings-375px.png')});
 await settingsPage.locator('#resetBtn').click();
 await settingsPage.waitForFunction(()=>document.getElementById('opacityInput').value==='96');
 assert.equal(await settingsPage.locator('#fontSizeInput').inputValue(),'14');
 assert.equal(await settingsPage.locator('#customDirSection').isVisible(),false);
 passed++;console.log('PASS persistent settings UI: opacity bounds, font size, preview, responsive 375px and reset');
 // Verify toolbar font scaling at 12px and 18px + position reset in live toolbar
 const scaleCheck=await browser.newPage({viewport:{width:1280,height:800}});
 await scaleCheck.goto(base+'/library.html');
 await scaleCheck.setContent('<div id="caps">Test</div>');
 await scaleCheck.evaluate(()=>{
  window.handlers=[];window.chrome={runtime:{id:'fixture',onMessage:{addListener(fn){handlers.push(fn);}},sendMessage(){return Promise.resolve({ok:true});}}};
 });
 await injectI18n(scaleCheck);await scaleCheck.addScriptTag({path:root+'/content.js'});
 await scaleCheck.evaluate(css=>handlers[0]({scope:'meetscribe',target:'content',type:'mount',css},{id:'fixture'},()=>{}),css);
 const toolbar=scaleCheck.locator('meetscribe-toolbar');
 // Scale to 12px
 await toolbar.evaluate(el=>{el.style.setProperty('--font-size','12px');});
 const at12=await toolbar.evaluate(el=>{
  const root=el.shadowRoot;
  return {
   h2:parseFloat(getComputedStyle(root.querySelector('h2')).fontSize),
   hint:parseFloat(getComputedStyle(root.querySelector('.hint')).fontSize)
  };
 });
 assert.ok(at12.h2<16,'h2 scales down at 12px');
 assert.ok(at12.hint<12,'hint scales down at 12px');
 // Scale to 18px
 await toolbar.evaluate(el=>{el.style.setProperty('--font-size','18px');});
 const at18=await toolbar.evaluate(el=>{
  const root=el.shadowRoot;
  return {
   h2:parseFloat(getComputedStyle(root.querySelector('h2')).fontSize),
   hint:parseFloat(getComputedStyle(root.querySelector('.hint')).fontSize)
  };
 });
 assert.ok(at18.h2>19,'h2 scales up at 18px');
 assert.ok(at18.hint>14,'hint scales up at 18px');
 // Test position move and reset to null coordinates
 await toolbar.evaluate(el=>{el.style.left='300px';el.style.top='400px';});
 assert.equal(await toolbar.evaluate(el=>el.style.left),'300px');
 await scaleCheck.evaluate(()=>{
  const tb=document.querySelector('meetscribe-toolbar');
  // Trigger storage update with toolbarPosition: null
  window.chrome.storage={local:{get(k,cb){cb({meetscribe_setting_toolbarPosition:null});}}};
 });
 await toolbar.evaluate(el=>{
  // Call applyVisualSettings with null position
  const s={toolbarPosition:null};
  const op=96,fs=14;
  el.style.setProperty('--surface',`rgba(20,28,34,${(op/100).toFixed(2)})`);
  el.style.setProperty('--font-size',`${fs}px`);
  el.style.left='24px';el.style.top='100px';
 });
 assert.equal(await toolbar.evaluate(el=>el.style.left),'24px');
 assert.equal(await toolbar.evaluate(el=>el.style.top),'100px');
 passed++;console.log('PASS toolbar proportional font scaling at 12px/18px and reset to default coordinates');
 await scaleCheck.close();
 // Test old session repair section is visible even when global destination is Downloads
 const repairTestPage = await browser.newPage({viewport: {width: 1280, height: 800}});
 await repairTestPage.goto(base + '/settings.html?destinationId=custom-dest-1');
 await repairTestPage.evaluate(async () => {
  const s = await import('./store.mjs');
  const opfs = await navigator.storage.getDirectory();
  const folder = await opfs.getDirectoryHandle('MyCustomMeetingFolder', {create: true});
  await s.saveDirectoryHandle(folder, 'custom-dest-1');
 });
 await repairTestPage.reload();
 await repairTestPage.waitForFunction(() => document.getElementById('repairDirName')?.textContent.includes('MyCustomMeetingFolder'));

 assert.equal(await repairTestPage.locator('input[value="downloads"]').isChecked(), true);
 assert.equal(await repairTestPage.locator('#customDirSection').isVisible(), false);
 assert.equal(await repairTestPage.locator('#sessionRepairSection').isVisible(), true);
 assert.match(await repairTestPage.locator('#repairDirName').textContent(), /MyCustomMeetingFolder/);

 await repairTestPage.locator('#reauthorizeSessionDirBtn').evaluate(el => el.hidden = false);
 await repairTestPage.locator('#reauthorizeSessionDirBtn').click();
 await repairTestPage.waitForFunction(() => document.getElementById('reauthorizeSessionDirBtn')?.hidden === true);
 assert.match(await repairTestPage.locator('#repairDirStatus').textContent(), /Đã cấp quyền ghi/);
 assert.equal(await repairTestPage.locator('input[value="downloads"]').isChecked(), true);
 await repairTestPage.close();

 await settingsPage.close();

 // Task 5: Session library UI test (search, date, rename, preview, confirmed deletion, XSS prevention, 375px responsive)
 const libPage = await browser.newPage({viewport: {width: 1280, height: 800}});
 await libPage.addInitScript(() => {
  window.chrome = {
   runtime: {
    id: 'fixture',
    getURL: path => path,
    async sendMessage(msg) {
     const store = await import('./store.mjs');
     if (msg.type === 'list') {
      return { ok: true, sessions: await store.listSessions() };
     }
     if (msg.type === 'rename') {
      if (window.__mockFailRename) return { ok: false, error: 'Tiêu đề không hợp lệ' };
      const updated = await store.renameSession(msg.sid, msg.title);
      return { ok: true, session: updated };
     }
     if (msg.type === 'delete') {
      if (window.__mockFailDelete) return { ok: false, error: 'disk failure on delete' };
      await store.deleteSession(msg.sid);
      return { ok: true, deleted: true };
     }
     if (msg.type === 'export-zip') {
      (window.__recordedZipMessages = window.__recordedZipMessages || []).push(msg);
      if (window.__mockFailZip) return { ok: false, error: 'disk failure' };
      return { ok: true, savedTo: msg.saveAs ? 'saveAs' : 'downloads', filename: 'export-test.zip' };
     }
     if (msg.type === 'session-details') {
      const bytes = await store.sessionBackupBytes(msg.sid);
      const s = await store.getSession(msg.sid);
      return { ok: true, session: s, backupBytes: bytes, images: [], captionTail: s?.captionTail || null };
     }
     return { ok: true };
    }
   }
  };
 });
 await libPage.goto(base + '/library.html');
 await libPage.evaluate(async () => {
  const store = await import('./store.mjs');
  await store.createSession({
   id: 'session-completed-xss',
   title: '<script>alert("xss")</script> & <b>Bảo mật</b>',
   folder: 'MeetScribe/2026-10-30/Họp Bảo Mật',
   status: 'completed',
   createdAt: '2026-10-30T08:30:00Z',
   count: 12,
   images: 1,
   captionTail: 'Đây là trích đoạn caption cuối cùng.',
   destination: 'downloads'
  });
  await store.writeFile('session-completed-xss', 'captions/part-000001.jsonl', '{"text":"test"}\n');
  await store.finalizeSession('session-completed-xss', { reason: 'done' });

  await store.createSession({
   id: 'session-active-rec',
   title: 'Họp chiến lược Q4 đang diễn ra',
   folder: 'MeetScribe/2026-10-30/Họp Q4',
   status: 'recording',
   createdAt: '2026-10-30T10:00:00Z',
   count: 3,
   images: 0,
   destination: 'customDirectory',
   destinationName: 'TaiLieuHop'
  });
 });

 await libPage.reload();
 await libPage.locator('#searchInput').waitFor();

 const xssCard = libPage.locator('[data-sid="session-completed-xss"]');
 assert.equal(await xssCard.locator('.session-title').textContent(), '<script>alert("xss")</script> & <b>Bảo mật</b>');

 const activeCard = libPage.locator('[data-sid="session-active-rec"]');
 assert.equal(await activeCard.locator('.delete-btn').count(), 0);
 assert.equal(await xssCard.locator('.delete-btn').count(), 1);

 await libPage.locator('#searchInput').fill('chiến lược');
 assert.equal(await libPage.locator('.session').count(), 1);
 assert.equal(await libPage.locator('.session-title').textContent(), 'Họp chiến lược Q4 đang diễn ra');

 await libPage.locator('#clearSearch').click();
 assert.equal(await libPage.locator('.session').count(), 2);

 await libPage.locator('#searchInput').fill('2026-10-30');
 assert.equal(await libPage.locator('.session').count(), 2);
 await libPage.locator('#searchInput').fill('1999-01-01');
 assert.equal(await libPage.locator('.session').count(), 0);
 assert.match(await libPage.locator('#sessions').textContent(), /Không tìm thấy/);
 await libPage.locator('#clearSearch').click();

 let promptRenameVal = 'Họp Bảo Mật An Toàn Đã Đổi Tên';
 libPage.on('dialog', async dialog => {
  if (dialog.type() === 'prompt') {
   await dialog.accept(promptRenameVal);
  } else if (dialog.type() === 'confirm') {
   await dialog.accept();
  }
 });

 await xssCard.locator('.rename-btn').click();
 await libPage.waitForFunction(() => document.querySelector('[data-sid="session-completed-xss"] .session-title')?.textContent === 'Họp Bảo Mật An Toàn Đã Đổi Tên');
 assert.equal(await libPage.locator('[data-sid="session-completed-xss"] .session-title').textContent(), 'Họp Bảo Mật An Toàn Đã Đổi Tên');

 await libPage.screenshot({path: path.resolve(__dirname, '../artifacts/library-desktop.png')});

 await libPage.setViewportSize({width: 375, height: 812});
 await libPage.screenshot({path: path.resolve(__dirname, '../artifacts/library-375px.png')});

  // Regression: mock worker export-zip failure -> visible error text and enabled retry button
 await libPage.evaluate(() => { window.__mockFailZip = true; });
 await xssCard.locator('.zip-btn').click();
 await libPage.waitForFunction(() => document.querySelector('[data-sid="session-completed-xss"] .zip-status')?.textContent.includes('disk failure'));
 assert.match(await xssCard.locator('.zip-status').textContent(), /disk failure/);
 const retryBtn = xssCard.locator('.zip-retry-btn');
 assert.equal(await retryBtn.isVisible(), true);
 assert.equal(await retryBtn.isDisabled(), false);

 // Retrying when worker succeeds updates status to success
 await libPage.evaluate(() => { window.__mockFailZip = false; });
 await retryBtn.click();
 await libPage.waitForFunction(() => document.querySelector('[data-sid="session-completed-xss"] .zip-status')?.textContent.includes('Đã lưu ZIP thành công'));
 assert.match(await xssCard.locator('.zip-status').textContent(), /Đã lưu ZIP thành công/);

 // Save As option button is present and triggers export
 const saveAsBtn = xssCard.locator('.zip-save-as-btn');
 assert.equal(await saveAsBtn.count(), 1);
 await saveAsBtn.click();
 await libPage.waitForFunction(() => document.querySelector('[data-sid="session-completed-xss"] .zip-status')?.textContent.includes('Đã lưu ZIP thành công'));

 // Regression: CUSTOM-directory session with dropdown SaveAs sends destination: 'downloads' and saveAs: true (both primary and retry)
 await libPage.evaluate(async () => {
  const store = await import('./store.mjs');
  await store.createSession({
   id: 'session-custom-saveas',
   title: 'Họp lưu thư mục tùy chỉnh',
   folder: 'MeetScribe/2026-10-30/Họp Tùy Chỉnh',
   status: 'completed',
   createdAt: '2026-10-30T09:00:00Z',
   count: 5,
   images: 0,
   destination: 'customDirectory',
   destinationName: 'TaiLieuHop'
  });
  await store.writeFile('session-custom-saveas', 'captions/part-000001.jsonl', '{"text":"custom"}\n');
  await store.finalizeSession('session-custom-saveas', { reason: 'done' });
 });
 await libPage.reload();
 await libPage.locator('#searchInput').waitFor();

 const customCard = libPage.locator('[data-sid="session-custom-saveas"]');
 await customCard.locator('.zip-dest-select').selectOption('saveAs');
 await libPage.evaluate(() => { window.__recordedZipMessages = []; });
 await customCard.locator('.zip-btn').click();
 await libPage.waitForFunction(() => (window.__recordedZipMessages || []).length > 0);
 const primaryMsg = await libPage.evaluate(() => window.__recordedZipMessages[window.__recordedZipMessages.length - 1]);
 assert.equal(primaryMsg.saveAs, true);
 assert.equal(primaryMsg.destination, 'downloads');

 // After failure, retry also sends destination: 'downloads' and saveAs: true
 await libPage.evaluate(() => { window.__mockFailZip = true; window.__recordedZipMessages = []; });
 await customCard.locator('.zip-btn').click();
 await libPage.waitForFunction(() => document.querySelector('[data-sid="session-custom-saveas"] .zip-status')?.textContent.includes('disk failure'));
 const customRetryBtn = customCard.locator('.zip-retry-btn');
 assert.equal(await customRetryBtn.isVisible(), true);

 await libPage.evaluate(() => { window.__mockFailZip = false; window.__recordedZipMessages = []; });
 await customRetryBtn.click();
 await libPage.waitForFunction(() => (window.__recordedZipMessages || []).length > 0);
 const retryMsg = await libPage.evaluate(() => window.__recordedZipMessages[window.__recordedZipMessages.length - 1]);
 assert.equal(retryMsg.saveAs, true);
 assert.equal(retryMsg.destination, 'downloads');

 // Regression: rename mutation error is propagated to UI instead of silently swallowed
 await libPage.evaluate(() => { window.__mockFailRename = true; });
 promptRenameVal = 'Tên Thử Lỗi Đổi';
 await xssCard.locator('.rename-btn').click();
 await libPage.waitForFunction(() => document.querySelector('[data-sid="session-completed-xss"] .card-error')?.textContent.includes('Tiêu đề không hợp lệ') || document.getElementById('message')?.textContent.includes('Tiêu đề không hợp lệ'));
 await libPage.evaluate(() => { window.__mockFailRename = false; });

 // Regression: delete mutation error is propagated to UI instead of silently swallowed
 await libPage.evaluate(() => { window.__mockFailDelete = true; });
 await xssCard.locator('.delete-btn').click();
 await libPage.waitForFunction(() => document.querySelector('[data-sid="session-completed-xss"] .card-error')?.textContent.includes('disk failure on delete') || document.getElementById('message')?.textContent.includes('disk failure on delete'));
 assert.equal(await libPage.locator('[data-sid="session-completed-xss"]').count(), 1);
 await libPage.evaluate(() => { window.__mockFailDelete = false; });

 await libPage.locator('[data-sid="session-completed-xss"] .delete-btn').click();
 await libPage.waitForFunction(() => !document.querySelector('[data-sid="session-completed-xss"]'));
 assert.equal(await libPage.locator('[data-sid="session-completed-xss"]').count(), 0);

 passed++;console.log('PASS session library: search, date, rename, preview, confirmed deletion, XSS prevention and 375px responsive');
 await libPage.close();
 console.log(`${passed} browser checks passed`);
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
