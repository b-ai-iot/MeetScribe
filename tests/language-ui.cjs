// Missing locale binding, discarded pending state, or translated user data must fail this test.
const {chromium}=require('playwright');
const http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'../extension');
 const server=http.createServer(async(req,res)=>{try{const file=path.join(root,new URL(req.url,'http://test').pathname);res.setHeader('Content-Type',/\.(m?js)$/.test(file)?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(await fs.readFile(file));}catch{res.writeHead(404).end();}}).listen(0,'127.0.0.1');
 await new Promise(r=>server.once('listening',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.MEETSCRIBE_TEST_CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 try{
  const context=await browser.newContext();
  await context.addInitScript(()=>{
   const listeners=[];const read=()=>JSON.parse(localStorage.getItem('test-settings') || '{"meetscribe_setting_language":"vi"}');
   const publish=data=>{const previous=read();localStorage.setItem('test-settings',JSON.stringify({...previous,...data}));for(const fn of listeners)fn(Object.fromEntries(Object.entries(data).map(([k,v])=>[k,{oldValue:previous[k],newValue:v}])),'local');};
   addEventListener('storage',event=>{if(event.key==='test-settings'){const before=JSON.parse(event.oldValue || '{}'),after=JSON.parse(event.newValue || '{}');for(const fn of listeners)fn(Object.fromEntries(Object.entries(after).filter(([k,v])=>JSON.stringify(v)!==JSON.stringify(before[k])).map(([k,v])=>[k,{oldValue:before[k],newValue:v}])),'local');}});
   window.changeLanguage=async language=>publish({meetscribe_setting_language:language});
   window.chrome={storage:{local:{get:async keys=>{const values=read();if(typeof keys==='string')return {[keys]:values[keys]};return {...values};},set:async data=>publish(data),remove:async()=>{}},onChanged:{addListener:fn=>listeners.push(fn),removeListener:()=>{}}},runtime:{sendMessage:async req=>{
    if(req.type==='list')return {ok:true,sessions:[{id:'raw',title:'Cuộc họp <img src=x onerror=alert(1)>',createdAt:'2026-10-29T13:14:00Z',folder:'MeetScribe/Đã dừng',status:'completed',count:12345,images:2,destination:'customDirectory',destinationName:'Thư mục Việt',destinationId:'dir',pendingExports:1,exportError:'Thư mục lưu cục bộ chưa được cấp quyền ghi. Mở Cài đặt để cấp lại quyền.'}]};
    if(req.type==='session-details')return {ok:true,backupBytes:1536,captionTail:'Đang thu: raw caption',images:[]};
    if(req.type==='export-zip')return new Promise(resolve=>window.finishZip=()=>resolve({ok:false,error:'Unknown native detail <img>'}));
    return {ok:true};
   }}};
  });
  const settings=await context.newPage();await settings.goto(`http://127.0.0.1:${server.address().port}/settings.html`);
  assert.equal(await settings.locator('#languageInput').count(),1,'Settings exposes the persisted language selector');
  await settings.locator('#languageInput').selectOption('en');
  assert.equal(await settings.locator('html').getAttribute('lang'),'vi','Language changes only after Save');
  await settings.locator('#saveBtn').click();await settings.waitForFunction(()=>document.documentElement.lang==='en');
  assert.equal(await settings.locator('h1').textContent(),'MeetScribe settings');
  assert.match(await settings.locator('#statusBanner').textContent(),/saved/i);
  await settings.reload();await settings.waitForFunction(()=>document.documentElement.lang==='en');
  assert.equal(await settings.locator('#languageInput').inputValue(),'en','Saved language survives reload');
  const library=await context.newPage();await library.goto(`http://127.0.0.1:${server.address().port}/library.html`);await library.waitForSelector('.session');
  await settings.locator('#opacityInput').fill('55');
  await library.evaluate(()=>window.changeLanguage('vi'));
  await settings.waitForFunction(()=>document.documentElement.lang==='vi');
  assert.equal(await settings.locator('#languageInput').inputValue(),'vi','External changes update language selector');
  assert.equal(await settings.locator('#opacityInput').inputValue(),'55','External language changes preserve unsaved appearance');
  await library.locator('#searchInput').fill('Cuộc họp');await library.locator('.zip-dest-select').selectOption('saveAs');await library.locator('.zip-btn').click();
  await settings.locator('#languageInput').selectOption('en');await settings.locator('#saveBtn').click();await library.waitForFunction(()=>document.documentElement.lang==='en');
  assert.equal(await library.locator('#searchInput').inputValue(),'Cuộc họp');
  assert.equal(await library.locator('.zip-dest-select').inputValue(),'saveAs');
  assert.equal(await library.locator('.zip-btn').isDisabled(),true);
  assert.match(await library.locator('.zip-status').textContent(),/Packaging/);
  assert.equal(await library.locator('.session-title').textContent(),'Cuộc họp <img src=x onerror=alert(1)>');
  assert.equal(await library.locator('.preview-text').textContent(),'Đang thu: raw caption');
  assert.equal(await library.locator('.path').textContent(),'MeetScribe/Đã dừng');
  assert.match(await library.locator('.dest-meta').textContent(),/Thư mục Việt/);
  assert.equal(await library.locator('.session-title img').count(),0);
  assert.match(await library.locator('.meta').first().textContent(),/12,345 captions · 2 images/);
  assert.match(await library.locator('.meta').first().textContent(),/10\/29\/2026/);
  assert.match(await library.locator('.session-info > .meta.warning').first().textContent(),/Save error: The local folder does not have write permission/);
  await library.evaluate(()=>window.finishZip());await library.waitForFunction(()=>!document.querySelector('.zip-btn').disabled);
  assert.match(await library.locator('.card-error').textContent(),/ZIP export error: Unknown native detail <img>/);
  await library.evaluate(()=>window.changeLanguage('vi'));await library.waitForFunction(()=>document.documentElement.lang==='vi');
  assert.match(await library.locator('.card-error').textContent(),/Lỗi xuất ZIP: Unknown native detail <img>/);
  assert.equal(await library.locator('#searchInput').inputValue(),'Cuộc họp');
  assert.match(await library.locator('.meta').first().textContent(),/29\/10\/2026.*12\.345 caption/);
  assert.match(await library.locator('.session-info > .meta.warning').first().textContent(),/Lỗi lưu: Thư mục lưu cục bộ chưa được cấp quyền ghi/);
  await settings.locator('#resetBtn').click();await settings.waitForFunction(()=>document.documentElement.lang==='vi');
  // A long English action row must never steal the reading area or escape its card.
  for (const language of ['en','vi']) {
    await library.evaluate(value=>window.changeLanguage(value),language);
    await library.waitForFunction(value=>document.documentElement.lang===value,language);
    await library.locator('.session-title').evaluate(node=>node.textContent='Weekly planning · demo');
    for (const width of [1440,768,390]) {
      await library.setViewportSize({width,height:1100});
      const layout=await library.evaluate(()=>{
        const info=document.querySelector('.session-info').getBoundingClientRect();
        const title=document.querySelector('.session-title').getBoundingClientRect();
        const card=document.querySelector('.session').getBoundingClientRect();
        const controls=[...document.querySelectorAll('.session .actions button,.session .actions select')].filter(node=>!node.hidden).map(node=>{const rect=node.getBoundingClientRect();return {text:node.textContent,left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,width:rect.width,height:rect.height};});
        return {infoWidth:info.width,titleWidth:title.width,cardLeft:card.left,cardRight:card.right,cardBottom:card.bottom,overflow:document.documentElement.scrollWidth>innerWidth,controls};
      });
      if(width===1440){
        assert.ok(layout.infoWidth>=560,`${language}: desktop reading area was squeezed to ${layout.infoWidth}px`);
        assert.ok(layout.titleWidth>=160,`${language}: desktop title wraps one word per line`);
      }
      if(width===768)assert.ok(layout.infoWidth>=500,`${language}: tablet reading area was squeezed to ${layout.infoWidth}px`);
      assert.equal(layout.overflow,false,`${language} ${width}: page has horizontal overflow`);
      for(const control of layout.controls){
        assert.ok(control.width>0&&control.height>=32,`${language} ${width}: hidden action ${control.text}`);
        assert.ok(control.left>=layout.cardLeft&&control.right<=layout.cardRight&&control.bottom<=layout.cardBottom,`${language} ${width}: action escapes card: ${control.text}`);
      }
    }
  }
  console.log('PASS Settings Save/reset and Library live VI/EN preserve search, raw data, pending export, selected destination and retained errors');
  console.log('PASS VI/EN Library reading area and all actions fit 1440px, 768px and 390px viewports');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
