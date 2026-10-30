// Exercises live toolbar updates against the production scripts. Only Chrome's
// extension message/storage boundary is replaced; DOM observers remain real.
const {chromium}=require('playwright');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const extension=path.resolve(__dirname,'../extension');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.MEETSCRIBE_TEST_CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<html><title>Meet - Tiêu đề &lt;script&gt;</title><body><div id="caps" aria-label="Phụ đề" style="position:fixed;right:20px;bottom:30px;width:320px;height:80px">Alice: Xin chào English</div><div id="shareRegion" style="position:fixed;right:20px;top:100px;width:300px;height:200px">User slide</div></body></html>');
  await page.evaluate(()=>{
   window.handlers=[];window.storageHandlers=[];window.saved={meetscribe_settings:{language:'en'},meetscribe_setting_language:'vi'};window.persisted=[];window.startCount=0;
   const session={id:'language-toolbar',title:'Tiêu đề <script>',folder:'MeetScribe/ngày/cuộc họp',status:'recording',count:0,images:2,pendingExports:0,createdAt:new Date().toISOString(),lastSequence:0,visual:'not-selected',destination:'customDirectory',destinationName:'Thư mục <img>'};
   window.cmd=(type,data={})=>new Promise(resolve=>handlers[0]({scope:'meetscribe',target:'content',type,...data},{id:'fixture'},resolve));
   window.setPreferences=async changes=>{Object.assign(saved,changes);for(const fn of storageHandlers)fn(Object.fromEntries(Object.entries(changes).map(([key,newValue])=>[key,{newValue}])),'local');await new Promise(r=>setTimeout(r,0));};
   window.chrome={storage:{local:{get(keys,cb){cb({...saved});},set:async values=>setPreferences(values)},onChanged:{addListener(fn){storageHandlers.push(fn);},removeListener(){}}},runtime:{id:'fixture',onMessage:{addListener(fn){handlers.push(fn);},removeListener(){}},async sendMessage(msg){
    if(msg.type==='open-settings'&&window.nextError)return {ok:false,...window.nextError};
    if(msg.type==='start'){startCount++;await cmd('begin',{session});return {ok:true,session};}
    if(msg.type==='visual-start'){session.visual='ready';return {ok:true,session};}
    if(msg.type==='caption'){persisted.push(...msg.entries);session.count=persisted.length;return {ok:true,count:session.count};}
    if(msg.type==='mark')return {ok:true,message:'Đã đánh dấu thời điểm hiện tại.'};
    if(msg.type==='stop'){await cmd('end');session.status='completed';return {ok:true,session};}
    return {ok:true,session};
   }}};
  });
  for(const name of ['i18n.js','i18n-ui.js','i18n-toolbar.js','i18n-system.js','captions.js','content.js']){
   await page.addScriptTag({path:path.join(extension,name)});
  }
  await page.evaluate(css=>cmd('mount',{css}),await fs.readFile(extension+'/overlay.css','utf8'));
  await page.getByRole('button',{name:'Vùng caption',exact:true}).click();await page.locator('#caps').hover();await page.locator('#caps').click();
  await page.getByRole('button',{name:'Bắt đầu ghi',exact:true}).click();
  await page.getByRole('button',{name:'Dừng và lưu',exact:true}).waitFor();
  await page.getByRole('button',{name:'Vùng share',exact:true}).click();await page.locator('#shareRegion').hover();await page.locator('#shareRegion').click();
  await page.getByRole('button',{name:'Vùng caption',exact:true}).click();
  await page.evaluate(()=>setPreferences({meetscribe_setting_language:'en'}));
  await page.getByRole('button',{name:'Stop and save',exact:true}).waitFor({timeout:2000});
  assert.match(await page.locator('html').innerText(),/Select the caption region/);
  assert.equal(await page.getByRole('button',{name:'Share region',exact:true}).getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('meetscribe-toolbar').evaluate(el=>el.shadowRoot.getElementById('title').textContent),'Tiêu đề <script>');
  assert.equal(await page.locator('meetscribe-toolbar').evaluate(el=>el.shadowRoot.getElementById('path').textContent),'MeetScribe/ngày/cuộc họp');
  assert.equal(await page.locator('meetscribe-toolbar').evaluate(el=>el.shadowRoot.getElementById('storage').textContent),'Automatically saving to Thư mục <img>');
  assert.equal(await page.locator('meetscribe-toolbar').evaluate(el=>el.shadowRoot.getElementById('metrics').textContent),'0 captions · 2 images');
  assert.equal(await page.locator('meetscribe-toolbar').getAttribute('lang'),'en');
  assert.equal(await page.getByRole('button',{name:'Move recording controls',exact:true}).getAttribute('title'),'Drag or use arrow keys to move');
  await page.keyboard.press('Escape');
  assert.match(await page.locator('meetscribe-toolbar').evaluate(el=>el.shadowRoot.textContent),/Region selection cancelled/);
  await page.locator('#caps').evaluate(el=>el.textContent='Bao: caption sau đổi ngôn ngữ');
  await page.getByRole('button',{name:'Mark',exact:true}).click();
  await page.evaluate(()=>setPreferences({meetscribe_setting_language:'vi'}));
  await page.getByRole('button',{name:'Dừng và lưu',exact:true}).waitFor();
  assert.match(await page.locator('meetscribe-toolbar').evaluate(el=>el.shadowRoot.textContent),/Đã đánh dấu thời điểm hiện tại/);
  await page.evaluate(()=>{document.getElementById('caps').textContent='Bao: final drain <img onerror=alert(1)>';document.querySelector('meetscribe-toolbar').shadowRoot.getElementById('stop').click();});
  await page.waitForFunction(()=>document.querySelector('meetscribe-toolbar').shadowRoot.getElementById('status').textContent==='Đã dừng');
  const data=await page.evaluate(()=>({persisted,startCount}));assert.equal(data.startCount,1);
  assert.deepEqual(data.persisted.map(e=>e.text),['Alice: Xin chào English','Bao: caption sau đổi ngôn ngữ','Bao: final drain <img onerror=alert(1)>']);
  assert.deepEqual(data.persisted.map(e=>e.sequence),[1,2,3]);
  await page.evaluate(()=>setPreferences({meetscribe_setting_language:'invalid',meetscribe_settings:{language:'en'}}));
  await page.getByRole('button',{name:'Bắt đầu ghi',exact:true}).waitFor();
  await page.evaluate(()=>{delete saved.meetscribe_setting_language;return setPreferences({meetscribe_settings:{language:'en'}});});
  await page.getByRole('button',{name:'Start recording',exact:true}).waitFor();
  await page.evaluate(()=>{window.nextError={};});
  await page.getByRole('button',{name:'MeetScribe settings',exact:true}).click();
  assert.equal(await page.locator('meetscribe-toolbar').evaluate(el=>el.shadowRoot.getElementById('message').textContent),'Data saving has not been acknowledged.');
  await page.evaluate(()=>{window.nextError={error:'Chưa nhận xác nhận lưu dữ liệu.'};});
  await page.getByRole('button',{name:'MeetScribe settings',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('meetscribe-toolbar').shadowRoot.getElementById('message').textContent==='Data saving has not been acknowledged.');
  await page.evaluate(()=>setPreferences({meetscribe_setting_language:'vi'}));
  await page.waitForFunction(()=>document.querySelector('meetscribe-toolbar').shadowRoot.getElementById('message').textContent==='Chưa nhận xác nhận lưu dữ liệu.');
  await page.evaluate(()=>{window.nextError={error:'FILE_FAILED: Thư mục <img>'};});
  await page.getByRole('button',{name:'Cài đặt MeetScribe',exact:true}).click();
  await page.evaluate(()=>setPreferences({meetscribe_setting_language:'en'}));
  await page.waitForFunction(()=>document.querySelector('meetscribe-toolbar').shadowRoot.getElementById('message').textContent==='FILE_FAILED: Thư mục <img>');
  assert.equal(await page.locator('meetscribe-toolbar').evaluate(el=>el.shadowRoot.querySelectorAll('img,script').length),0);
  await page.evaluate(()=>cmd('status',{session:{id:'language-toolbar',status:'completed',count:3,images:2,pendingExports:5}}));
  assert.equal(await page.locator('meetscribe-toolbar').evaluate(el=>el.shadowRoot.getElementById('storage').textContent),'5 files awaiting export · backed up');
  await page.evaluate(()=>setPreferences({meetscribe_setting_language:'vi'}));
  assert.equal(await page.locator('meetscribe-toolbar').evaluate(el=>el.shadowRoot.getElementById('storage').textContent),'5 file đang chờ xuất · đã dự phòng');
  assert.deepEqual(errors,[]);
  console.log('PASS live toolbar VI→EN→VI, picker/share selection, safe user data, marking, final drain, dedicated priority and legacy language');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
