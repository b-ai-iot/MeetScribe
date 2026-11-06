// Split archive behavior. Browser APIs alone are supplied; page code and rendering are real.
const {chromium}=require('playwright');
const http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'../extension');
 const server=http.createServer(async(req,res)=>{try{const file=path.join(root,new URL(req.url,'http://test').pathname);res.setHeader('Content-Type',/\.(m?js)$/.test(file)?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':'text/html');res.end(await fs.readFile(file));}catch{res.writeHead(404).end();}}).listen(0,'127.0.0.1');
 await new Promise(r=>server.once('listening',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.MEETSCRIBE_TEST_CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000},timezoneId:'Asia/Ho_Chi_Minh'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   const listeners=[];let language='en';window.calls=[];window.detailResolvers={};window.zipResolvers={};window.pendingMutations={};
   window.sessions=[
    {id:'old',title:'Customer discovery · Research',createdAt:'2026-11-04T08:00:00Z',folder:'MeetScribe/2026-11-04/Customer-discovery',status:'completed',count:46,images:0,lastDownloadId:2},
    {id:'latest',title:'Product planning · Roadmap & delivery',createdAt:'2026-11-06T02:30:00Z',folder:'MeetScribe/2026-11-06/Product-planning',status:'completed',count:128,images:2,pendingExports:2,exportError:'Native folder error <detail>',destination:'customDirectory',destinationName:'Product research',destinationId:'directory'},
    {id:'active',title:'Design review · Live',createdAt:'2026-11-05T08:00:00Z',folder:'MeetScribe/2026-11-05/Design-review',status:'recording',count:8,images:0}
   ];
   window.changeLanguage=next=>{language=next;listeners.forEach(fn=>fn({meetscribe_setting_language:{newValue:next}},'local'));};
   window.resolveDetails=(id,text=id+' raw caption <literal>')=>{const resolvers=window.detailResolvers[id]||[];window.detailResolvers[id]=[];resolvers.forEach(resolve=>resolve({ok:true,backupBytes:4096,captionTail:text,images:id==='latest'?[{name:'Roadmap slide',data:'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#25274f"/><text x="42" y="80" fill="#c4bbff" font-size="22" font-family="sans-serif">PRODUCT PLANNING · DEMO</text><text x="42" y="154" fill="white" font-size="36" font-family="sans-serif">A clearer plan for the week.</text><rect x="42" y="210" width="160" height="85" rx="12" fill="#6554d9"/><rect x="220" y="210" width="160" height="85" rx="12" fill="#4b5292"/><rect x="398" y="210" width="190" height="85" rx="12" fill="#377f83"/></svg>')}]:[]}));};
   window.chrome={storage:{local:{get:async()=>({meetscribe_setting_language:language})},onChanged:{addListener:fn=>listeners.push(fn),removeListener:()=>{}}},runtime:{sendMessage:async req=>{
    window.calls.push(req);
    if(req.type==='list')return {ok:true,sessions:window.sessions};
    if(req.type==='session-details')return new Promise(resolve=>(window.detailResolvers[req.sid]??=[]).push(resolve));
    if(req.type==='export-zip')return new Promise(resolve=>window.zipResolvers[req.sid]=resolve);
    if(['rename','delete'].includes(req.type))return new Promise(resolve=>window.pendingMutations[req.type]=()=>{if(req.type==='rename')window.sessions=window.sessions.map(s=>s.id===req.sid?{...s,title:req.title}:s);else window.sessions=window.sessions.filter(s=>s.id!==req.sid);resolve({ok:true});});
    return {ok:true};
   }}};
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/library.html`);
  await page.waitForSelector('.session-row');
  assert.equal(await page.locator('.session-row').count(),3,'Compact index includes all sessions');
  assert.equal(await page.locator('.session').count(),1,'Only selected session has an inspector');
  assert.equal(await page.locator('.session-row[aria-pressed="true"]').getAttribute('data-sid'),'latest','Latest matching session is selected despite unsorted worker response');
  assert.deepEqual(await page.evaluate(()=>calls.filter(c=>c.type==='session-details').map(c=>c.sid)),['latest'],'Details are fetched only for selection');
  await page.locator('.session-row[data-sid="old"]').click();
  await page.evaluate(()=>resolveDetails('latest','STALE EXCERPT'));
  assert.equal(await page.locator('.preview-text').count(),0,'Late details cannot populate another selected inspector');
  await page.evaluate(()=>resolveDetails('old'));
  await page.waitForSelector('.preview-text');assert.equal(await page.locator('.preview-text').textContent(),'old raw caption <literal>');
  await page.locator('[data-filter="attention"]').click();
  assert.equal(await page.locator('.session-row').count(),1);assert.equal(await page.locator('.session').getAttribute('data-sid'),'latest');
  await page.evaluate(()=>resolveDetails('latest'));
  await page.locator('.thumb').waitFor();
  await page.locator('[data-filter="active"]').click();
  assert.equal(await page.locator('.session-row').count(),1);assert.equal(await page.locator('.session').getAttribute('data-sid'),'active');
  assert.equal(await page.locator('.stop-save-btn').count(),1);assert.equal(await page.locator('.delete-btn').count(),0,'Active meeting cannot be deleted');
  await page.locator('[data-filter="all"]').click();
  await page.locator('#searchInput').fill('missing query');
  assert.equal(await page.locator('.session').count(),0,'No stale inspector remains after an empty search');
  assert.equal(await page.locator('.session-row').count(),0);assert.match(await page.locator('#sessions').textContent(),/missing query/);
  await page.locator('#clearSearch').click();await page.locator('.session-row[data-sid="latest"]').click();
  await page.evaluate(()=>resolveDetails('latest'));
  await page.locator('.zip-dest-select').selectOption('saveAs');await page.locator('.zip-btn').click();
  await page.locator('.session-row[data-sid="old"]').click();
  assert.equal(await page.locator('.zip-btn').isDisabled(),false,'Another selected meeting remains exportable');
  await page.locator('.session-row[data-sid="latest"]').click();
  assert.equal(await page.locator('.zip-btn').isDisabled(),true,'Busy export belongs to its session across selection');
  assert.equal(await page.locator('.zip-dest-select').inputValue(),'saveAs');
  await page.evaluate(()=>changeLanguage('vi'));
  assert.equal(await page.locator('.zip-btn').isDisabled(),true);assert.match(await page.locator('.zip-status').textContent(),/Đang đóng gói/);
  await page.evaluate(()=>zipResolvers.latest({ok:false,error:'ZIP failed <native>'}));await page.waitForFunction(()=>!document.querySelector('.zip-btn').disabled);
  assert.match(await page.locator('.card-error').textContent(),/ZIP failed <native>/);
  await page.locator('.session-row[data-sid="old"]').click();await page.locator('.session-row[data-sid="latest"]').click();
  assert.match(await page.locator('.card-error').textContent(),/ZIP failed <native>/,'Session error survives leaving and returning');
  await page.evaluate(()=>changeLanguage('en'));assert.match(await page.locator('.zip-status').textContent(),/ZIP export error: ZIP failed <native>/);
  assert.deepEqual(await page.evaluate(()=>calls.filter(c=>c.type==='export-zip').map(({sid,saveAs,destination})=>({sid,saveAs,destination}))),[{sid:'latest',saveAs:true,destination:'downloads'}]);
  page.once('dialog',d=>d.accept('Renamed planning · Kế hoạch sản phẩm, priorities, owners & delivery milestones <literal>'));await page.locator('.rename-btn').click();
  await page.locator('.session-row[data-sid="old"]').click();await page.evaluate(()=>pendingMutations.rename());
  await page.waitForFunction(()=>document.querySelector('.session-row[data-sid="latest"]')?.textContent.includes('Renamed planning'));
  assert.equal(await page.locator('.session').getAttribute('data-sid'),'old','Rename completion preserves the user’s newer selection');
  assert.equal(await page.evaluate(()=>document.activeElement.dataset.sid),'old','Async list refresh retains focus on the newer selected row');
  assert.equal(await page.evaluate(()=>calls.find(c=>c.type==='rename').sid),'latest');
  await page.locator('.open-folder-btn').click();assert.equal(await page.evaluate(()=>calls.find(c=>c.type==='show-folder').sid),'old');
  page.once('dialog',d=>d.accept());await page.locator('.delete-btn').click();await page.locator('.session-row[data-sid="active"]').click();await page.evaluate(()=>pendingMutations.delete());
  await page.waitForFunction(()=>!document.querySelector('.session-row[data-sid="old"]'));
  assert.equal(await page.locator('.session').getAttribute('data-sid'),'active');assert.equal(await page.evaluate(()=>calls.find(c=>c.type==='delete').sid),'old');
  await page.locator('.stop-save-btn').click();await page.waitForFunction(()=>calls.some(c=>c.type==='stop'));assert.equal(await page.evaluate(()=>calls.find(c=>c.type==='stop').sid),'active');
  await page.locator('.zip-save-as-btn').click();
  await page.locator('.session-row[data-sid="latest"]').click();
  await page.evaluate(()=>zipResolvers.active({ok:true,filename:'active-demo.zip'}));
  await page.waitForFunction(()=>calls.filter(c=>c.type==='list').length>=5);
  assert.equal(await page.locator('.session').getAttribute('data-sid'),'latest','Stopping ZIP completion preserves newer selection');
  assert.deepEqual(await page.evaluate(()=>{const c=calls.find(c=>c.type==='export-zip'&&c.sid==='active');return {sid:c.sid,stopFirst:c.stopFirst,saveAs:c.saveAs,destination:c.destination};}),{sid:'active',stopFirst:true,saveAs:true,destination:'downloads'});
  await page.locator('.recovery-actions .retry').click();await page.waitForFunction(()=>calls.some(c=>c.type==='retry'));assert.equal(await page.evaluate(()=>calls.find(c=>c.type==='retry').sid),'latest');
  const popupPromise=page.waitForEvent('popup');await page.locator('.repair-btn').click();const popup=await popupPromise;assert.match(popup.url(),/settings\.html\?destinationId=directory$/);await popup.close();
  await page.locator('.session-row[data-sid="active"]').click();
  await page.setViewportSize({width:390,height:844});await page.locator('#backToMeetings').click();
  assert.equal(await page.locator('#sessions').isVisible(),true);assert.equal(await page.locator('#inspector').isVisible(),false);
  assert.equal(await page.evaluate(()=>document.activeElement.dataset.sid),'active','Back restores focus to selected index row');
  await page.keyboard.press('Enter');assert.equal(await page.locator('#inspector').isVisible(),true);assert.equal(await page.locator('#sessions').isVisible(),false);
  await page.locator('#backToMeetings').click();await page.locator('.session-row[data-sid="latest"]').click();await page.evaluate(()=>resolveDetails('latest','Lan: We agreed on the priorities for the week. Each task will have a clear owner and deadline.\nMinh: Let’s share the revised roadmap after the review.'));
  for(const language of ['en','vi']){
   await page.evaluate(value=>changeLanguage(value),language);
   for(const width of [1440,1024,768,390,375]){
    await page.setViewportSize({width,height:1000});
    const metrics=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,index:document.querySelector('.archive-index').getBoundingClientRect().width,filterHeight:document.querySelector('.archive-filters').getBoundingClientRect().height,controls:[...document.querySelectorAll('button,select,nav a,input')].filter(n=>n.getBoundingClientRect().width).map(n=>({text:n.textContent,height:n.getBoundingClientRect().height}))}));
    assert.equal(metrics.overflow,false,`${language} ${width}: no horizontal page overflow`);
    if(width===1440)assert.ok(metrics.index>=320&&metrics.index<=360,'Desktop index stays compact');
    if(width>780)assert.ok(metrics.filterHeight<=44,`${language} ${width}: compact filters stay in one row`);
    for(const c of metrics.controls)assert.ok(c.height>=44,`${language} ${width}: ${c.text} under 44px`);
    if(process.env.MEETSCRIBE_SCREENSHOTS){await fs.mkdir(process.env.MEETSCRIBE_SCREENSHOTS,{recursive:true});await page.screenshot({path:path.join(process.env.MEETSCRIBE_SCREENSHOTS,`archive-${language}-${width}.png`),fullPage:true});}
   }
  }
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await page.locator('.zip-btn').evaluate(n=>getComputedStyle(n).transitionDuration),'0s','Reduced motion disables animated control transitions');
  await page.reload();await page.waitForSelector('.session-row');
  assert.equal(await page.locator('#sessions').isVisible(),true,'Mobile opens on the index');assert.equal(await page.locator('#inspector').isVisible(),false,'Mobile details wait for explicit selection');
  for(const language of ['en','vi']){
   await page.evaluate(value=>changeLanguage(value),language);await page.waitForFunction(value=>document.documentElement.lang===value,language);
   if(process.env.MEETSCRIBE_SCREENSHOTS)await page.screenshot({path:path.join(process.env.MEETSCRIBE_SCREENSHOTS,`archive-index-${language}-375.png`),fullPage:true});
  }
  await page.locator('[data-filter="active"]').click();assert.equal(await page.locator('.session-row').count(),1);
  await page.evaluate(()=>{sessions=sessions.map(s=>({...s,status:'completed'}));});await page.locator('#refresh').click();
  await page.waitForFunction(()=>!document.querySelector('.session-row'));
  assert.equal(await page.locator('.session').count(),0,'Filter that becomes empty clears selection');
  assert.match(await page.locator('#sessions').textContent(),/bộ lọc/,'Empty filter explains there are no matching meetings');
  assert.deepEqual(errors,[]);
  console.log('PASS archive selection, selected-only details, stale replies, real filters, empty state, per-session ZIP state, mutation identity, VI/EN, mobile Back focus and 375–1440px layout');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
