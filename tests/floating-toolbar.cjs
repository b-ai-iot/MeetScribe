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
  const session={id:'floating',title:'Weekly planning',folder:'MeetScribe/test',status:'recording',count:0,images:0,pendingExports:0,createdAt:new Date(Date.now()-65000).toISOString(),lastSequence:0,visual:'not-selected',destination:'downloads'};
  window.cmd=(type,data={})=>new Promise(resolve=>handlers[0]({scope:'meetscribe',target:'content',type,...data},{id:'fixture'},resolve));
  window.setPreferences=async values=>{Object.assign(saved,values);for(const fn of storageHandlers)fn(Object.fromEntries(Object.entries(values).map(([key,newValue])=>[key,{newValue}])),'local');await new Promise(r=>setTimeout(r,0));};
  window.chrome={storage:{local:{get(keys,cb){cb({...saved});},set:async values=>setPreferences(values)},onChanged:{addListener(fn){storageHandlers.push(fn);},removeListener(){}}},runtime:{id:'fixture',onMessage:{addListener(fn){handlers.push(fn);},removeListener(){}},async sendMessage(msg){
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
check('fresh install has a 60px launcher; open keeps it visible and Escape restores focus',async()=>{
 const p=await fixture();try{
  assert.equal(await el(p,'expanded').isVisible(),false,'fresh install must start compact');
  const b=await el(p,'compact').boundingBox();assert.ok(b.width>=56&&b.width<=60&&b.height>=56&&b.height<=60);
  // A hidden header gradient must not make the always-visible launcher mark disappear.
  async function mintPixel(){
   const png=await el(p,'compact').locator('.brand-mark').screenshot();
   return p.evaluate(base64=>new Promise(resolve=>{const img=new Image();img.onload=()=>{const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);resolve([...ctx.getImageData(4,16,1,1).data]);};img.src='data:image/png;base64,'+base64;}),png.toString('base64'));
  }
  const compactPixel=await mintPixel();assert.ok(compactPixel[1]>140&&compactPixel[0]>40,'collapsed launcher keeps visible mint brand background: '+compactPixel);

  await el(p,'compact').focus();await p.keyboard.press('Enter');assert.equal(await el(p,'expanded').isVisible(),true);assert.equal(await el(p,'compact').isVisible(),true,'launcher stays visible');
  const openPixel=await mintPixel();assert.ok(openPixel[1]>140&&openPixel[0]>40,'open launcher keeps visible mint brand background');
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
  await el(p,'resetPosition').click();const reset=await el(p,'compact').boundingBox();assert.ok(reset.x>1200);assert.equal(await el(p,'compact').isVisible(),true);await fit(p);
 }finally{await p.close();}
});
check('explicit preferences, corners and resize keep popover usable at maximum font',async()=>{
 const p=await fixture({meetscribe_setting_collapsed:false,meetscribe_setting_fontSize:18,meetscribe_setting_opacity:40,meetscribe_setting_toolbarPosition:{x:0,y:0},meetscribe_setting_language:'en'});try{
  assert.equal(await el(p,'expanded').isVisible(),true);assert.equal(await el(p,'compact').isVisible(),true);
  assert.equal(await read(p,h=>h.style.getPropertyValue('--font-size')),'18px');assert.match(await read(p,h=>h.style.getPropertyValue('--surface')),/0\.40/);
  for(const v of [{width:375,height:500},{width:390,height:350},{width:768,height:600},{width:1440,height:900}]){
   await p.setViewportSize(v);
   for(const position of [{x:0,y:0},{x:v.width,y:0},{x:0,y:v.height},{x:v.width,y:v.height}]){
    await p.evaluate(position=>setPreferences({meetscribe_setting_toolbarPosition:position}),position);await fit(p);
    await el(p,'library').scrollIntoViewIfNeeded();assert.equal(await el(p,'library').isVisible(),true);
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
  await el(p,'share').click();assert.equal(await el(p,'expanded').isVisible(),false,'picker hides panel to expose target');assert.equal(await el(p,'compact').isVisible(),true);assert.equal(await el(p,'compact').getAttribute('aria-expanded'),'false');
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
check('dragging launcher preserves picker and keyboard activation survives cancelled touch',async()=>{
 const p=await fixture({meetscribe_setting_collapsed:false,meetscribe_setting_language:'en'});try{
  await el(p,'start').click();await el(p,'stop').waitFor();await el(p,'share').click();
  let b=await el(p,'compact').boundingBox();await p.mouse.move(b.x+30,b.y+30);await p.mouse.down();await p.mouse.move(b.x-100,b.y-80,{steps:8});await p.mouse.up();
  assert.equal(await el(p,'expanded').isVisible(),false,'generated post-drag click must leave picker active');assert.match(await p.locator('html').innerText(),/Select the shared-screen content/);
  await el(p,'compact').focus();await p.keyboard.press('Enter');assert.equal(await el(p,'expanded').isVisible(),true,'keyboard activation can cancel picker after drag');
  await el(p,'share').click();b=await el(p,'compact').boundingBox();const cdp=await p.context().newCDPSession(p);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+30,y:b.y+30,id:9}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:b.x-40,y:b.y-40,id:9}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
  assert.equal(await el(p,'expanded').isVisible(),false,'cancelled touch leaves selection active');await el(p,'compact').focus();await p.keyboard.press('Enter');
  assert.equal(await el(p,'expanded').isVisible(),true,'keyboard click is not swallowed by stale drag suppression');assert.equal(await el(p,'stop').isVisible(),true);
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
(async()=>{
 browser=await chromium.launch({headless:true,executablePath:process.env.MEETSCRIBE_TEST_CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});css=await fs.readFile(extension+'/overlay.css','utf8');let failures=0;
 try{for(const {name,run}of cases){if(process.env.MEETSCRIBE_FLOATING_CASE&&!name.includes(process.env.MEETSCRIBE_FLOATING_CASE))continue;try{await run();console.log('PASS',name);}catch(e){failures++;console.error('FAIL',name,e.message);}}}finally{await browser.close();}
 if(failures)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
