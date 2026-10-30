const {chromium}=require('playwright');
const http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../extension');
(async()=>{
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
 await ui.addScriptTag({path:root+'/content.js'});
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
 await zoom.addScriptTag({path:root+'/content.js'});await zoom.evaluate(css=>zcmd('mount',{css}),css);
 await zoom.getByRole('button',{name:'Bắt đầu ghi',exact:true}).click();
 await zoom.locator('.live-transcription-subtitle__box').evaluate(el=>el.innerText='Bao: Zoom caption cuối');
 await zoom.getByRole('button',{name:'Dừng và lưu',exact:true}).click();
 assert.equal(await zoom.evaluate(()=>zsaved.some(e=>e.text==='Bao: Zoom caption cuối')),true);
 passed++;console.log('PASS Zoom subtitle container auto-discovery and Stop drain');await zoom.close();
 console.log(`${passed} browser checks passed`);
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
