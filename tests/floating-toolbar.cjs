// Real shadow DOM, pointer input and caption observer; only the extension boundary is substituted.
const {chromium}=require('playwright');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const extension=path.resolve(__dirname,'../extension');
const cases=[];const check=(name,run)=>cases.push({name,run});
let browser,css;
async function fixture(preferences={},viewport={width:1440,height:900}){
 const page=await browser.newPage({viewport});
 await page.setContent('<html><title>Meet - Weekly planning</title><body><div aria-label="Captions" id="caps" style="position:fixed;left:10px;bottom:15px;width:220px;height:70px">Alice: first caption</div></body></html>');
 await page.evaluate(preferences=>{
  window.handlers=[];window.storageHandlers=[];window.saved=preferences;window.persisted=[];window.commandLog=[];
  window.windowListeners=new Map();
  const add=window.addEventListener.bind(window),remove=window.removeEventListener.bind(window);
  window.addEventListener=(type,fn,options)=>{if(!windowListeners.has(type))windowListeners.set(type,new Set());windowListeners.get(type).add(fn);add(type,fn,options);};
  window.removeEventListener=(type,fn,options)=>{windowListeners.get(type)?.delete(fn);remove(type,fn,options);};
  const session={id:'floating',title:'Weekly planning',folder:'MeetScribe/test',status:'recording',count:0,images:0,pendingExports:0,createdAt:new Date(Date.now()-65000).toISOString(),lastSequence:0,visual:'not-selected',destination:'downloads'};
  window.cmd=(type,data={})=>new Promise(resolve=>handlers[0]({scope:'meetscribe',target:'content',type,...data},{id:'fixture'},resolve));
  window.setPreferences=async values=>{Object.assign(saved,values);for(const fn of storageHandlers)fn(Object.fromEntries(Object.entries(values).map(([key,newValue])=>[key,{newValue}])),'local');await new Promise(r=>setTimeout(r,0));};
  window.chrome={storage:{local:{get(keys,cb){cb({...saved});},set:async values=>setPreferences(values)},onChanged:{addListener(fn){storageHandlers.push(fn);},removeListener(fn){const i=storageHandlers.indexOf(fn);if(i>=0)storageHandlers.splice(i,1);}}},runtime:{id:'fixture',onMessage:{addListener(fn){handlers.push(fn);},removeListener(fn){const i=handlers.indexOf(fn);if(i>=0)handlers.splice(i,1);}},async sendMessage(msg){
   commandLog.push(msg.type);
   if(msg.type==='open-settings'&&window.failSettings)return {ok:false,error:'FILE_FAILED: local backup preserved'};
   if(msg.type==='start'){await cmd('begin',{session});return {ok:true,session};}
   if(msg.type==='visual-start'){session.visual='ready';return {ok:true,session};}
   if(msg.type==='health'&&window.nextVisual)session.visual=window.nextVisual;
   if(msg.type==='caption'){persisted.push(...msg.entries);session.count=persisted.length;return {ok:true,count:session.count};}
   if(msg.type==='stop'){await cmd('end');session.status='completed';return {ok:true,session};}
   return {ok:true,session};
  }}};
 },preferences);
 for(const file of ['i18n.js','i18n-ui.js','i18n-toolbar.js','i18n-system.js','captions.js','content.js'])await page.addScriptTag({path:file==='content.js'&&process.env.MEETSCRIBE_FLOATING_CONTENT?process.env.MEETSCRIBE_FLOATING_CONTENT:path.join(extension,file)});
 await page.evaluate(css=>cmd('mount',{css}),css);
 return page;
}
const el=(page,id)=>page.locator('meetscribe-toolbar').locator('#'+id);
const read=(page,fn)=>page.locator('meetscribe-toolbar').evaluate(fn);
async function open(page){if(!await el(page,'expanded').isVisible())await el(page,'compact').click();}
async function fit(page){
 const boxes=await read(page,host=>['compact','expanded','launcherStatus'].map(id=>{const el=host.shadowRoot.getElementById(id);if(!el||el.hidden)return null;const r=el.getBoundingClientRect();return {id,x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};}).filter(Boolean));
 const v=page.viewportSize();for(const b of boxes){assert.ok(b.x>=7&&b.y>=7&&b.right<=v.width-7&&b.bottom<=v.height-7,`${b.id} outside viewport: ${JSON.stringify(b)}`);}
}
check('fresh install has one connected status capsule; open keeps it visible and Escape restores focus',async()=>{
 const p=await fixture();try{
  assert.equal(await el(p,'expanded').isVisible(),false,'fresh install must start compact');
  const b=await el(p,'compact').boundingBox();assert.ok(b.width>=220&&b.width<=240&&b.height>=56&&b.height<=60);
  const status=await el(p,'launcherStatus').boundingBox();assert.ok(status.x>=b.x&&status.y>=b.y&&status.x+status.width<=b.x+b.width&&status.y+status.height<=b.y+b.height,'status belongs to the same capsule hit area');
  // A hidden header gradient must not make the always-visible launcher mark disappear.
  async function violetPixel(){
   const png=await el(p,'compact').locator('.brand-mark').screenshot();
   return p.evaluate(base64=>new Promise(resolve=>{const img=new Image();img.onload=()=>{const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);resolve({background:[...ctx.getImageData(4,16,1,1).data],glyph:[...ctx.getImageData(8,11,1,1).data]});};img.src='data:image/png;base64,'+base64;}),png.toString('base64'));
  }
  const compactPixel=await violetPixel();assert.ok(compactPixel.glyph.slice(0,3).every(c=>c>220),'caption glyph contrasts against violet background');assert.ok(compactPixel.background[0]>90&&compactPixel.background[2]>180,'collapsed capsule keeps visible violet brand background: '+compactPixel);

  await el(p,'compact').focus();await p.keyboard.press('Enter');assert.equal(await el(p,'expanded').isVisible(),true);assert.equal(await el(p,'compact').isVisible(),true,'launcher stays visible');
  const openPixel=await violetPixel();assert.ok(openPixel.background[0]>90&&openPixel.background[2]>180,'open capsule keeps visible violet brand background');
  await p.keyboard.press('Escape');assert.equal(await el(p,'expanded').isVisible(),false);assert.equal(await read(p,h=>h.shadowRoot.activeElement.id),'compact');
  await p.keyboard.press('Space');assert.equal(await el(p,'expanded').isVisible(),true);
  await p.locator('#caps').click();await p.keyboard.press('Escape');assert.equal(await el(p,'expanded').isVisible(),false,'Escape also closes after focus returns to meeting');
 }finally{await p.close();}
});
check('drag threshold prevents click while a small movement remains a click; arrows persist and reset is pointer accessible',async()=>{
 const p=await fixture({meetscribe_setting_collapsed:true});try{
  const b=await el(p,'compact').boundingBox();await p.mouse.move(b.x+30,b.y+30);await p.mouse.down();await p.mouse.move(b.x-100,b.y-100,{steps:8});await p.mouse.up();
  assert.equal(await el(p,'expanded').isVisible(),false,'drag must not open panel');const moved=await el(p,'compact').boundingBox();assert.ok(moved.x<b.x-50,'launcher moves');
  await el(p,'compact').focus();await p.keyboard.press('ArrowLeft');const key=await el(p,'compact').boundingBox();assert.ok(key.x<moved.x);assert.equal(await p.evaluate(()=>saved.meetscribe_setting_toolbarPosition.x),Math.round(key.x));
  await p.mouse.move(key.x+30,key.y+30);await p.mouse.down();await p.mouse.move(key.x+32,key.y+31);await p.mouse.up();assert.equal(await el(p,'expanded').isVisible(),true,'movement below threshold clicks');
  await el(p,'details').locator('summary').click();await el(p,'resetPosition').click();const reset=await el(p,'compact').boundingBox();assert.ok(reset.x>1100);assert.equal(await el(p,'compact').isVisible(),true);await fit(p);
 }finally{await p.close();}
});
check('explicit preferences, corners and resize keep popover usable at maximum font',async()=>{
 const p=await fixture({meetscribe_setting_collapsed:false,meetscribe_setting_fontSize:18,meetscribe_setting_opacity:40,meetscribe_setting_toolbarPosition:{x:0,y:0},meetscribe_setting_language:'en'});try{
  assert.equal(await el(p,'expanded').isVisible(),true);assert.equal(await el(p,'compact').isVisible(),true);
  assert.equal(await read(p,h=>h.style.getPropertyValue('--font-size')),'18px');assert.match(await read(p,h=>h.style.getPropertyValue('--surface')),/0\.40/);
  await el(p,'details').locator('summary').click();
  for(const language of ['en','vi']){
   await p.evaluate(language=>setPreferences({meetscribe_setting_language:language}),language);
  for(const v of [{width:375,height:500},{width:390,height:350},{width:768,height:600},{width:1440,height:900}]){
   await p.setViewportSize(v);
   for(const position of [{x:0,y:0},{x:v.width,y:0},{x:0,y:v.height},{x:v.width,y:v.height}]){
    await p.evaluate(position=>setPreferences({meetscribe_setting_toolbarPosition:position}),position);await fit(p);
    await el(p,'library').scrollIntoViewIfNeeded();assert.equal(await el(p,'library').isVisible(),true);
   }
  }
  }
  await p.evaluate(()=>cmd('mount',{css:''}));assert.equal(await p.locator('meetscribe-toolbar').count(),1);assert.equal(await p.evaluate(()=>storageHandlers.length),1);
 }finally{await p.close();}
});
check('capture survives toggles; compact shows timer and error plus recoverable detail',async()=>{
 const p=await fixture({meetscribe_setting_collapsed:false,meetscribe_setting_language:'en'});try{
  await el(p,'start').click();await el(p,'stop').waitFor();await el(p,'collapse').click();
  await p.waitForFunction(()=>document.querySelector('meetscribe-toolbar').shadowRoot.getElementById('compactElapsed')?.textContent.startsWith('01:'),null,{timeout:3000});
  assert.match(await el(p,'compact').getAttribute('aria-label'),/Waiting for captions|Recording/);
  await p.locator('#caps').evaluate(n=>n.textContent='Bao: while collapsed');await p.waitForTimeout(30);await open(p);await el(p,'collapse').click();await open(p);
  await p.evaluate(()=>{window.failSettings=true;});await el(p,'settings').click();await el(p,'collapse').click();
  assert.match(await el(p,'compactText').textContent(),/Needs attention/);assert.match(await el(p,'compact').getAttribute('title'),/FILE_FAILED/);
  await open(p);assert.match(await el(p,'message').textContent(),/FILE_FAILED/);await el(p,'stop').click();
  await p.waitForFunction(()=>document.querySelector('meetscribe-toolbar').shadowRoot.getElementById('status').textContent==='Stopped');
  assert.deepEqual(await p.evaluate(()=>persisted.map(e=>e.text)),['Alice: first caption','Bao: while collapsed']);
  assert.equal(await p.evaluate(()=>commandLog.filter(x=>x==='start').length),1);assert.equal(await p.evaluate(()=>commandLog.filter(x=>x==='stop').length),1);
 }finally{await p.close();}
});
check('compact exposes lost or unavailable share images while caption capture continues',async()=>{
 const p=await fixture({meetscribe_setting_collapsed:false,meetscribe_setting_language:'en'});try{
  await p.evaluate(()=>{const region=document.createElement('div');region.id='slide';region.style.cssText='position:fixed;left:250px;top:50px;width:300px;height:200px';region.textContent='Shared slide';document.body.append(region);});
  await el(p,'start').click();await el(p,'stop').waitFor();await el(p,'share').click();await p.locator('#slide').hover();await p.locator('#slide').click();await el(p,'collapse').click();
  await p.locator('#slide').evaluate(n=>n.remove());
  await p.evaluate(async()=>cmd('status',{session:(await chrome.runtime.sendMessage({type:'health'})).session}));
  assert.match(await el(p,'compactText').textContent(),/Share region lost/);
  assert.equal(await el(p,'compactDot').getAttribute('data-state'),'error');
  assert.match(await el(p,'compact').getAttribute('title'),/caption recording continues/);assert.match(await el(p,'compact').getAttribute('aria-description'),/caption recording continues/);
  assert.match(await el(p,'compact').getAttribute('aria-label'),/Share region lost/);
  await p.evaluate(async()=>{window.nextVisual='unavailable';await cmd('status',{session:(await chrome.runtime.sendMessage({type:'health'})).session});});
  assert.match(await el(p,'compactText').textContent(),/Images unavailable/);
  assert.match(await el(p,'compact').getAttribute('title'),/Captions are being saved/);
  await p.evaluate(()=>setPreferences({meetscribe_setting_language:'vi'}));assert.match(await el(p,'compactText').textContent(),/Chưa có ảnh share/);assert.match(await el(p,'compact').getAttribute('title'),/Caption đang lưu/);
  await p.evaluate(()=>setPreferences({meetscribe_setting_language:'en'}));
  await p.locator('#caps').evaluate(n=>n.textContent='Bao: captions continue after image loss');await p.waitForTimeout(30);
  await open(p);await el(p,'stop').click();
  await p.waitForFunction(()=>document.querySelector('meetscribe-toolbar').shadowRoot.getElementById('status').textContent==='Stopped');
  assert.deepEqual(await p.evaluate(()=>persisted.map(e=>e.text)),['Alice: first caption','Bao: captions continue after image loss']);
 }finally{await p.close();}
});
check('region picker releases an overlapping panel and restores it on selection or Escape',async()=>{
 const p=await fixture({meetscribe_setting_collapsed:false,meetscribe_setting_language:'en'},{width:900,height:600});try{
  await p.evaluate(()=>{const region=document.createElement('div');region.id='slide';region.style.cssText='position:fixed;right:10px;top:100px;width:300px;height:200px';region.textContent='Overlapping shared slide';document.body.append(region);});
  await el(p,'start').click();await el(p,'stop').waitFor();
  const before=await el(p,'expanded').boundingBox(),slide=await p.locator('#slide').boundingBox();assert.ok(before.x<slide.x+slide.width&&before.x+before.width>slide.x&&before.y<slide.y+slide.height&&before.y+before.height>slide.y,'fixture reproduces overlapping target');
  await el(p,'share').click();assert.equal(await el(p,'expanded').isVisible(),false,'picker hides panel to expose target');assert.equal(await el(p,'compact').isVisible(),false,'picker hides the whole capsule hit area');assert.equal(await el(p,'compact').getAttribute('aria-expanded'),'false');
  await p.locator('#slide').hover({timeout:2000});await p.locator('#slide').click({timeout:2000});
  await el(p,'stop').waitFor();assert.equal(await el(p,'share').getAttribute('aria-pressed'),'true');assert.equal(await el(p,'expanded').isVisible(),true);assert.equal(await read(p,h=>h.shadowRoot.activeElement.id),'share');
  await el(p,'caption').click();assert.equal(await el(p,'expanded').isVisible(),false);
  await p.evaluate(()=>setPreferences({meetscribe_setting_language:'vi'}));assert.match(await p.locator('html').innerText(),/Chọn khung phụ đề/);
  await p.evaluate(()=>setPreferences({meetscribe_setting_language:'en'}));assert.match(await p.locator('html').innerText(),/Select the caption region/);await p.keyboard.press('Escape');
  assert.equal(await el(p,'expanded').isVisible(),true);assert.equal(await read(p,h=>h.shadowRoot.activeElement.id),'caption');assert.equal(await el(p,'stop').isVisible(),true);
  assert.equal(await p.evaluate(()=>saved.meetscribe_setting_collapsed),false,'picker visibility never changes persisted expanded preference');
  await p.locator('#caps').evaluate(n=>n.textContent='Bao: still capturing after selection');await p.waitForTimeout(30);await el(p,'stop').click();
  await p.waitForFunction(()=>document.querySelector('meetscribe-toolbar').shadowRoot.getElementById('status').textContent==='Stopped');
  assert.deepEqual(await p.evaluate(()=>persisted.map(e=>e.text)),['Alice: first caption','Bao: still capturing after selection']);
  await el(p,'collapse').click();await el(p,'caption').evaluate(button=>button.click());await p.keyboard.press('Escape');
  assert.equal(await el(p,'expanded').isVisible(),false,'picker begun compact returns compact after Escape');assert.equal(await read(p,h=>h.shadowRoot.activeElement.id),'compact');
  await el(p,'caption').evaluate(button=>button.click());await p.locator('#caps').hover();await p.locator('#caps').click();assert.equal(await el(p,'expanded').isVisible(),false,'picker begun compact returns compact after selection');
  assert.equal(await p.evaluate(()=>saved.meetscribe_setting_collapsed),true);

 }finally{await p.close();}
});
check('picker exposes underlying capsule area and Cancel restores focus without changing preferences',async()=>{
 const p=await fixture({meetscribe_setting_collapsed:false,meetscribe_setting_language:'en'});try{
  await el(p,'start').click();await el(p,'stop').waitFor();const capsule=await el(p,'compact').boundingBox();
  await p.evaluate(b=>{const region=document.createElement('div');region.id='behindCapsule';region.style.cssText=`position:fixed;left:${b.x}px;top:${b.y}px;width:${b.width}px;height:${b.height}px`;region.textContent='Slide behind recording controls';document.body.append(region);},capsule);
  await el(p,'share').click();assert.equal(await el(p,'compact').isVisible(),false);
  await p.locator('#behindCapsule').hover();await p.locator('#behindCapsule').click();
  assert.equal(await el(p,'share').getAttribute('aria-pressed'),'true');assert.equal(await read(p,h=>h.shadowRoot.activeElement.id),'share');
  await el(p,'caption').click();await p.setViewportSize({width:390,height:350});
  const cancelButton=p.getByRole('button',{name:'Cancel selection',exact:true});const strip=await cancelButton.locator('..').boundingBox();assert.ok(strip.x>=8&&strip.x+strip.width<=382,'picker strip fits narrow viewport without clipping Cancel');await cancelButton.click();
  assert.equal(await el(p,'expanded').isVisible(),true);assert.equal(await read(p,h=>h.shadowRoot.activeElement.id),'caption');
  assert.equal(await p.evaluate(()=>saved.meetscribe_setting_collapsed),false);
 }finally{await p.close();}
});
check('Vietnamese context invalidation cancels picker and exposes buffered caption rescue',async()=>{
 const p=await fixture({meetscribe_setting_collapsed:false,meetscribe_setting_language:'vi'});const errors=[];p.on('pageerror',e=>errors.push(e.message));try{
  await el(p,'start').click();await el(p,'stop').waitFor();await el(p,'share').click();
  await p.evaluate(()=>{chrome.runtime.sendMessage=()=>{throw Error('Extension context invalidated.');};document.querySelector('meetscribe-toolbar').shadowRoot.getElementById('settings').click();});
  await p.waitForFunction(()=>document.querySelector('meetscribe-toolbar').shadowRoot.getElementById('compactText').textContent==='Cần kết nối lại');
  assert.equal(await p.getByRole('button',{name:'Hủy chọn vùng',exact:true}).count(),0,'localized invalidation removes picker listeners and cancel strip');
  assert.equal(await el(p,'expanded').isVisible(),true,'previous expanded preference restored');assert.equal(await el(p,'rescue').isVisible(),true);
  assert.match(await el(p,'message').textContent(),/Extension đã được nạp lại/);assert.deepEqual(errors,[]);
  assert.deepEqual(await p.evaluate(()=>__meetScribe.dispose().map(e=>e.text)),['Alice: first caption']);
 }finally{await p.close();}
});
check('invalidated extension disposal returns pending captions and cleans up a moved drag without preference writes',async()=>{
 const p=await fixture({meetscribe_setting_collapsed:false,meetscribe_setting_language:'en'});try{
  await el(p,'start').click();await el(p,'stop').waitFor();
  await p.locator('#caps').evaluate(n=>n.textContent='Bao: pending when extension reloads');await p.waitForTimeout(30);
  assert.deepEqual(await p.evaluate(()=>persisted),[],'captions are still waiting for acknowledgement');
  const b=await el(p,'compact').boundingBox();await p.mouse.move(b.x+30,b.y+30);await p.mouse.down();await p.mouse.move(b.x-100,b.y-80,{steps:8});
  assert.ok((await el(p,'compact').boundingBox()).x<b.x-50,'disposal interrupts a real moved drag');
  const disposed=await p.evaluate(()=>{
   window.preferenceAttempts=0;
   chrome.storage.local.set=()=>{preferenceAttempts++;throw Error('Extension context invalidated.');};
   Object.defineProperty(chrome.runtime,'id',{get(){throw Error('Extension context invalidated.');}});
   const valid=__meetScribe.valid();let entries,error;
   try{entries=__meetScribe.dispose();}catch(e){error=e.message;}
   return {valid,error,entries,attempts:preferenceAttempts,hosts:document.querySelectorAll('meetscribe-toolbar').length,handlers:handlers.length,storageHandlers:storageHandlers.length,listeners:['keydown','resize','beforeunload'].map(type=>[type,windowListeners.get(type)?.size||0])};
  });
  assert.equal(disposed.error,undefined,'invalidated preferences must not abort disposal');
  assert.equal(disposed.valid,false);
  assert.deepEqual(disposed.entries.map(e=>e.text),['Alice: first caption','Bao: pending when extension reloads'],'unacknowledged caption entries are returned intact');
  assert.equal(disposed.attempts,0,'disposal does not persist UI preferences');
  assert.equal(disposed.hosts,0);assert.equal(disposed.handlers,0);assert.equal(disposed.storageHandlers,0);
  assert.deepEqual(disposed.listeners,[['keydown',0],['resize',0],['beforeunload',0]]);
  await p.mouse.up();
 }finally{await p.close();}
});
check('failing preference persistence still opens and focuses compact recovery controls',async()=>{
 const p=await fixture({meetscribe_setting_collapsed:false,meetscribe_setting_language:'en'});const errors=[];p.on('pageerror',e=>errors.push(e.message));try{
  await el(p,'start').click();await el(p,'stop').waitFor();await el(p,'collapse').click();
  await p.evaluate(()=>{
   chrome.storage.local.set=()=>{throw Error('Extension context invalidated.');};
   chrome.runtime.sendMessage=()=>{throw Error('Extension context invalidated.');};
   Object.defineProperty(chrome.runtime,'id',{get(){throw Error('Extension context invalidated.');}});
  });
  await el(p,'settings').evaluate(n=>n.click());
  await p.waitForFunction(()=>document.querySelector('meetscribe-toolbar').shadowRoot.getElementById('compactText').textContent==='Reconnect required');
  // Completing an ordinary moved drag also tolerates synchronous preference failure.
  const b=await el(p,'compact').boundingBox();await p.mouse.move(b.x+30,b.y+30);await p.mouse.down();await p.mouse.move(b.x-80,b.y-60,{steps:8});await p.mouse.up();
  assert.equal(await p.locator('meetscribe-toolbar').getAttribute('data-dragging'),null);
  await el(p,'compact').focus();await p.keyboard.press('Enter');
  assert.equal(await el(p,'expanded').isVisible(),true,'persistence failure must not strand recovery controls in compact mode');
  assert.equal(await read(p,h=>h.shadowRoot.activeElement.id),'collapse','opening still moves focus into the panel');
  assert.equal(await el(p,'rescue').isVisible(),true,'pending caption recovery remains available');
  await p.keyboard.press('Escape');assert.equal(await el(p,'expanded').isVisible(),false);assert.equal(await read(p,h=>h.shadowRoot.activeElement.id),'compact');
  assert.deepEqual(errors,[],'failed UI preference writes never escape browser event handlers');
 }finally{await p.close();}
});
check('pointer cancellation releases movement and does not toggle',async()=>{
 const p=await fixture({meetscribe_setting_collapsed:true});try{
  const b=await el(p,'compact').boundingBox();const cdp=await p.context().newCDPSession(p);
  const touch=(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchCancel'||type==='touchEnd'?[]:[{x,y,id:9}]});
  await touch('touchStart',b.x+30,b.y+30);await touch('touchMove',b.x-40,b.y-40);
  const moved=await el(p,'compact').boundingBox();assert.ok(moved.x<b.x-40,'touch movement actually repositions launcher');
  await touch('touchCancel');const cancelled=await el(p,'compact').boundingBox();await p.mouse.move(30,30);
  const after=await el(p,'compact').boundingBox();assert.equal(after.x,cancelled.x);assert.equal(after.y,cancelled.y);assert.equal(await el(p,'expanded').isVisible(),false);
  assert.equal(await p.locator('meetscribe-toolbar').getAttribute('data-dragging'),null);
  await el(p,'compact').click();assert.equal(await el(p,'expanded').isVisible(),true,'cancelled touch leaves next click usable');
 }finally{await p.close();}
});
check('reduced motion keeps controls immediate and exports real controller screenshots when requested',async()=>{
 const p=await fixture({meetscribe_setting_collapsed:false,meetscribe_setting_language:'en'});try{
  await p.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await el(p,'expanded').evaluate(el=>getComputedStyle(el).animationName),'none');
  await el(p,'start').click();await el(p,'stop').waitFor();await fit(p);
  if(process.env.MEETSCRIBE_CONTROLLER_SCREENSHOTS){
   await fs.mkdir(process.env.MEETSCRIBE_CONTROLLER_SCREENSHOTS,{recursive:true});
   await p.evaluate(()=>{
    document.body.style.cssText='margin:0;background:#eef0f7;font:16px system-ui;color:#293149';
    const stage=document.createElement('main');stage.innerHTML='<div style="padding:32px;color:#656b83;font-size:13px">SYNTHETIC MEETING · PRODUCT REVIEW</div><div style="margin:0 5%;height:55vh;border-radius:24px;background:#fff;box-shadow:0 12px 60px #3942690d;padding:8%;box-sizing:border-box"><div style="font-size:12px;letter-spacing:2px;color:#6c60a8">WEEKLY PLANNING</div><h1 style="font-size:clamp(20px,3vw,44px);line-height:1.15;font-weight:500">Make room for<br>the conversation.</h1><p style="color:#798198;font-size:14px">A synthetic meeting preview for controller review.</p></div>';
    document.body.prepend(stage);
   });
   for(const item of [{name:'1440-en',width:1440,height:900,language:'en',fontSize:14},{name:'1024-en',width:1024,height:768,language:'en',fontSize:14},{name:'768-vi',width:768,height:800,language:'vi',fontSize:14},{name:'390-vi',width:390,height:844,language:'vi',fontSize:14},{name:'375-vi-font18',width:375,height:667,language:'vi',fontSize:18},{name:'390-short-font18',width:390,height:350,language:'vi',fontSize:18}]){
    await p.setViewportSize({width:item.width,height:item.height});
    await p.evaluate(item=>setPreferences({meetscribe_setting_language:item.language,meetscribe_setting_fontSize:item.fontSize,meetscribe_setting_toolbarPosition:{x:item.width-256,y:item.height-76}}),item);await fit(p);
    await p.screenshot({path:path.join(process.env.MEETSCRIBE_CONTROLLER_SCREENSHOTS,'controller-'+item.name+'.png')});
   }
   await p.evaluate(()=>setPreferences({meetscribe_setting_collapsed:true}));
   await p.screenshot({path:path.join(process.env.MEETSCRIBE_CONTROLLER_SCREENSHOTS,'controller-collapsed-short.png')});
   await p.evaluate(()=>setPreferences({meetscribe_setting_collapsed:false}));await el(p,'caption').click();
   await p.screenshot({path:path.join(process.env.MEETSCRIBE_CONTROLLER_SCREENSHOTS,'controller-picker-short.png')});await p.keyboard.press('Escape');
  }
 }finally{await p.close();}
});
(async()=>{
 browser=await chromium.launch({headless:true,executablePath:process.env.MEETSCRIBE_TEST_CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});css=await fs.readFile(extension+'/overlay.css','utf8');let failures=0;
 try{for(const {name,run}of cases){if(process.env.MEETSCRIBE_FLOATING_CASE&&!name.includes(process.env.MEETSCRIBE_FLOATING_CASE))continue;try{await run();console.log('PASS',name);}catch(e){failures++;console.error('FAIL',name,e.message);}}}finally{await browser.close();}
 if(failures)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
