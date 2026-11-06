// Real page behavior with only unavailable extension APIs supplied by the fixture.
const {chromium}=require('playwright');
const http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'../extension');
 const server=http.createServer(async(req,res)=>{try{const file=path.join(root,new URL(req.url,'http://test').pathname);res.setHeader('Content-Type',/\.(m?js)$/.test(file)?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':'text/html');res.end(await fs.readFile(file));}catch{res.writeHead(404).end();}}).listen(0,'127.0.0.1');
 await new Promise(r=>server.once('listening',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.MEETSCRIBE_TEST_CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 try{
  const context=await browser.newContext();
  await context.addInitScript(()=>{
   const listeners=[];let values={meetscribe_setting_language:'vi'};
   window.changeLanguage=language=>{values.meetscribe_setting_language=language;listeners.forEach(fn=>fn({meetscribe_setting_language:{newValue:language}},'local'));};
   window.chrome={storage:{local:{get:async()=>({...values}),set:async data=>{values={...values,...data};for(const fn of listeners)fn(Object.fromEntries(Object.entries(data).map(([k,v])=>[k,{newValue:v}])),'local');},remove:async()=>{}},onChanged:{addListener:fn=>listeners.push(fn),removeListener:()=>{}}},runtime:{sendMessage:async req=>{
    if(req.type==='list')return {ok:true,sessions:[{id:'demo',title:'Weekly planning · Product & Operations',createdAt:'2026-11-05T02:30:00Z',folder:'MeetScribe/2026-11-05/Weekly planning',status:'completed',count:128,images:6,lastDownloadId:2,pendingExports:1,exportError:'Native folder error <detail>',destination:'customDirectory',destinationName:'Project notes',destinationId:'directory'}]};
    if(req.type==='session-details')return {ok:true,backupBytes:1536,captionTail:'We have agreed the priorities and owners for next week.',images:[]};
    if(req.type==='export-zip')return new Promise(resolve=>window.finishZip=()=>resolve({ok:false,error:'Native export error <detail>'}));
    return {ok:true};
   }}};
  });
  const settings=await context.newPage(),library=await context.newPage();
  const base=`http://127.0.0.1:${server.address().port}`;
  await settings.goto(base+'/settings.html');await library.goto(base+'/library.html');await library.waitForSelector('.session');
  assert.equal(await library.locator('h1').textContent(),'Kho cuộc họp','The library heading identifies the workspace');
  assert.equal(await settings.locator('nav [aria-current="page"]').count(),1,'Settings navigation identifies the current page');
  assert.equal(await library.locator('nav [aria-current="page"]').count(),1,'Library navigation identifies the current page');
  for(const page of [library,settings]){
   assert.equal(await page.locator('.brand img[src="icons/brand.svg"]').count(),1,'The shared navigation uses the canonical brand');
   assert.equal(await page.locator('nav a[href="library.html"]').count(),2,'Brand and library navigation remain reachable');
   assert.equal(await page.locator('nav a[href="settings.html"]').count(),1,'Settings navigation remains reachable');
  }
  for(const [selected,status] of [['18','15.3px'],['12','10.2px'],['14','11.9px']]){
   await settings.locator('#fontSizeInput').fill(selected);
   assert.equal(await settings.locator('#previewPanel').evaluate(n=>getComputedStyle(n).fontSize),selected+'px','expanded preview follows selected font');
   assert.equal(await settings.locator('.preview-state span').evaluate(n=>getComputedStyle(n).fontSize),status,'compact preview follows live status font scaling');
   assert.equal(await settings.locator('.preview-state time').evaluate(n=>getComputedStyle(n).fontSize),'12px','compact timer keeps its readable fixed size');
  }
  await settings.locator('#opacityInput').fill('55');
  assert.match(await settings.locator('#formStatus').textContent(),/chưa lưu/i,'Unsaved changes get persistent feedback');
  await settings.evaluate(()=>window.changeLanguage('en'));
  assert.equal(await settings.locator('#opacityInput').inputValue(),'55');
  assert.match(await settings.locator('#formStatus').textContent(),/unsaved/i);
  await settings.locator('#saveBtn').click();
  assert.match(await settings.locator('#statusBanner').textContent(),/saved/i);
  assert.ok(await library.locator('.session .actions > button').first().evaluate(node=>node.classList.contains('zip-btn')), 'Primary ZIP follows reading order for keyboard users');
  await library.locator('.zip-dest-select').selectOption('saveAs');
  await library.locator('.zip-btn').click();
  for(const language of ['vi','en']){
   await library.evaluate(value=>window.changeLanguage(value),language);await settings.evaluate(value=>window.changeLanguage(value),language);
   assert.equal(await library.locator('h1').textContent(),language==='vi'?'Kho cuộc họp':'Meeting archive');
   assert.equal(await library.locator('.zip-dest-select').inputValue(),'saveAs');
   assert.equal(await library.locator('.zip-btn').isDisabled(),true);
   assert.equal(await library.locator('.zip-btn svg[aria-hidden="true"]').count(),1,'Localized pending buttons retain decorative icons');
   for(const width of [375,768,1440]){
    for(const [name,page] of [['library',library],['settings',settings]]){
     await page.setViewportSize({width,height:1000});
     if(name==='library'&&width<=780&&await page.locator('.archive-index').isVisible())await page.locator('.session-row').click();
     const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,controls:[...document.querySelectorAll('button,select,nav a,input[type="range"],.radio-option')].filter(n=>n.getBoundingClientRect().width&&n.getBoundingClientRect().height).map(n=>({height:n.getBoundingClientRect().height,label:n.textContent})),nav:document.querySelector('nav').getBoundingClientRect().toJSON(),main:document.querySelector('main').getBoundingClientRect().toJSON()}));
     assert.equal(layout.overflow,false,`${name} ${language} ${width}: horizontal overflow`);
     for(const control of layout.controls)assert.ok(control.height>=44,`${name} ${language} ${width}: control under 44px: ${control.label}`);
     if(width===1440)assert.ok(layout.nav.right<=layout.main.left,`${name}: desktop navigation occupies its own sidebar`);
     else assert.ok(layout.nav.bottom<=layout.main.top,`${name}: responsive navigation sits above content`);
     await page.locator(name==='settings'?'#saveBtn':'#refresh').focus();
     await page.keyboard.press('Shift+Tab');await page.keyboard.press('Tab');
     assert.ok(await page.evaluate(()=>getComputedStyle(document.activeElement).outlineStyle!=='none'),'Keyboard focus is visible');
     assert.ok(await page.evaluate(()=>{const n=document.activeElement,r=n.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')===n;}),'Focused action is visible and unobscured');
     if(name==='settings'){const positions=await page.evaluate(()=>({controls:document.querySelector('.preferences-column').getBoundingClientRect().toJSON(),preview:document.querySelector('.appearance-preview').getBoundingClientRect().toJSON()}));if(width===1440)assert.ok(positions.preview.left>=positions.controls.right,'Desktop preview sits beside the controls');else assert.ok(positions.preview.top>=positions.controls.bottom,'Narrow preview stacks below controls');}
     if(process.env.MEETSCRIBE_SCREENSHOTS){await page.evaluate(()=>scrollTo(0,0));await fs.mkdir(process.env.MEETSCRIBE_SCREENSHOTS,{recursive:true});await page.screenshot({path:path.join(process.env.MEETSCRIBE_SCREENSHOTS,`${name}-${language}-${width}.png`),fullPage:true});}
    }
   }
  }
  await library.evaluate(()=>window.finishZip());await library.waitForFunction(()=>!document.querySelector('.zip-btn').disabled);
  assert.match(await library.locator('.card-error').textContent(),/Native export error <detail>/);
  assert.equal(await library.locator('.zip-btn svg').count(),1);
  for(const selector of ['.rename-btn','.retry','.zip-btn','.zip-save-as-btn','.delete-btn','.zip-dest-select'])assert.ok(await library.locator(selector).first().isVisible(),`Retained library action ${selector}`);
  console.log('PASS shared navigation, pending settings, icons across VI/EN export state, 44px controls, focus and 375/768/1440 layouts');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
