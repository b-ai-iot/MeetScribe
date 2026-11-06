// Real settings page and destination flows; only unavailable extension/native APIs are supplied.
// Catches false dirty state, missing pending/error feedback, draft loss and partial preview scaling.
const {chromium}=require('playwright');
const http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'../extension');
 const server=http.createServer(async(req,res)=>{try{const file=path.join(root,new URL(req.url,'http://test').pathname);res.setHeader('Content-Type',/\.(m?js)$/.test(file)?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':'text/html');res.end(await fs.readFile(file));}catch{res.writeHead(404).end();}}).listen(0,'127.0.0.1');
 await new Promise(r=>server.once('listening',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.MEETSCRIBE_TEST_CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1100}});
  // File-system handles cannot be created without the OS picker. Keep destination.mjs real,
  // and provide only the handle-store boundary and native handle methods.
  await context.route('**/store.mjs',route=>route.fulfill({contentType:'text/javascript',body:`export async function getDirectoryHandle(id){return id ? window.nativeRepairHandle : window.nativeActiveHandle;} export async function saveDirectoryHandle(handle,id){window.nativeActiveHandle=handle;window.savedDirectoryId=id;} export async function markExported(){}`}));
  await context.addInitScript(()=>{
   const listeners=[];let values={meetscribe_setting_language:'en'},mode='normal';
   window.settingsValues=()=>values;
   window.saveMode=value=>mode=value;
   window.changeLanguage=language=>{values.meetscribe_setting_language=language;listeners.forEach(fn=>fn({meetscribe_setting_language:{newValue:language}},'local'));};
   window.chrome={storage:{local:{get:async()=>{if(new URLSearchParams(location.search).has('delayInit')&&!window.initialReadDone){await new Promise(resolve=>window.finishInitialRead=resolve);window.initialReadDone=true;}return {...values};},set:async data=>{if(mode==='error')throw Error('Native write <detail>');if(mode==='hold')await new Promise((resolve,reject)=>window.finishSave=(error)=>error?reject(Error(error)):resolve());values={...values,...data};listeners.forEach(fn=>fn(Object.fromEntries(Object.entries(data).map(([k,v])=>[k,{newValue:v}])),'local'));},remove:async()=>{}},onChanged:{addListener:fn=>listeners.push(fn),removeListener:()=>{}}}};
   window.nativeWrites=[];window.nativePermission='denied';
   const makeHandle=name=>({name,queryPermission:async()=>window.nativePermission,requestPermission:async()=>{window.nativePermission='granted';return 'granted';},getFileHandle:async(name,options)=>{window.nativeWrites.push({name,options});return {createWritable:async()=>({write:async data=>window.nativeWrites.push(data),close:async()=>window.nativeWrites.push('closed')})};},removeEntry:async name=>window.nativeWrites.push({removed:name})});
   window.nativeActiveHandle=makeHandle('Client notes <raw>');window.nativeRepairHandle=makeHandle('Archived folder <raw>');
   window.showDirectoryPicker=async options=>{window.pickerOptions=options;if(window.pickerCancel)throw new DOMException('Picker cancelled','AbortError');return makeHandle('Chosen folder <raw>');};
  });
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/settings.html?destinationId=archive&delayInit=1`);
  assert.ok(await page.locator('#saveBtn').isDisabled(),'Save waits for initial settings and bound listeners');
  assert.ok(await page.locator('#resetBtn').isDisabled(),'Reset waits for initialization');
  await page.evaluate(()=>window.finishInitialRead());
  await page.waitForFunction(()=>document.querySelector('#repairDirName').textContent==='Archived folder <raw>');
  assert.ok(await page.locator('#sessionRepairSection').isVisible());
  assert.ok(await page.locator('#sessionRepairSection').evaluate(n=>n.getBoundingClientRect().top<document.querySelector('.language-card').getBoundingClientRect().top),'Deep linked repair precedes general preferences');
  await page.locator('#opacityInput').fill('55');
  assert.match(await page.locator('#formStatus').textContent(),/unsaved/i);
  await page.locator('#opacityInput').fill('96');
  assert.doesNotMatch(await page.locator('#formStatus').textContent(),/unsaved/i,'Restoring all original values clears dirty feedback');
  await page.locator('#fontSizeInput').fill('18');await page.locator('#opacityInput').fill('40');
  assert.equal(await page.locator('#previewPanel').evaluate(n=>getComputedStyle(n).fontSize),'18px');
  for(const selector of ['.preview-primary','.preview-row-label'])assert.equal(await page.locator(selector).first().evaluate(n=>getComputedStyle(n).fontSize),'18px','Every principal preview control follows selected font');
  assert.equal(await page.locator('.preview-state span').evaluate(n=>getComputedStyle(n).fontSize),'15.3px');
  assert.equal(await page.locator('#previewPanel').evaluate(n=>getComputedStyle(n).backgroundColor),'rgba(20, 28, 34, 0.4)');
  await page.evaluate(()=>window.saveMode('hold'));await page.locator('#saveBtn').click();
  await page.waitForFunction(()=>document.querySelector('#settingsForm').dataset.state==='saving');
  assert.match(await page.locator('#formStatus').textContent(),/saving/i);assert.ok(await page.locator('#saveBtn').isDisabled());assert.ok(await page.locator('#resetBtn').isDisabled());
  await page.evaluate(()=>window.finishSave());await page.waitForFunction(()=>document.querySelector('#settingsForm').dataset.state==='saved');
  assert.match(await page.locator('#formStatus').textContent(),/saved/i);
  assert.equal(await page.evaluate(()=>window.settingsValues().meetscribe_setting_fontSize),18);
  await page.locator('#opacityInput').fill('66');await page.evaluate(()=>window.saveMode('error'));await page.locator('#saveBtn').click();
  await page.waitForFunction(()=>document.querySelector('#settingsForm').dataset.state==='error');
  assert.match(await page.locator('#statusBanner').textContent(),/Native write <detail>/);assert.equal(await page.locator('#statusBanner detail').count(),0);
  await page.locator('#resetBtn').click();assert.equal(await page.locator('#opacityInput').inputValue(),'66','Failed reset preserves draft');assert.match(await page.locator('#statusBanner').textContent(),/Native write <detail>/);
  await page.evaluate(()=>window.changeLanguage('vi'));assert.equal(await page.locator('#opacityInput').inputValue(),'66');assert.match(await page.locator('#statusBanner').textContent(),/Native write <detail>/);
  assert.equal(await page.locator('#customDirName').textContent(),'Client notes <raw>');
  await page.locator('input[value="customDirectory"]').check();assert.ok(await page.locator('#customDirSection').isVisible());
  await page.locator('#reauthorizeDirBtn').click();await page.waitForFunction(()=>document.querySelector('#customDirStatus').classList.contains('granted'));
  assert.ok(await page.locator('#reauthorizeDirBtn').isHidden());
  await page.locator('#reauthorizeSessionDirBtn').click();await page.waitForFunction(()=>document.querySelector('#repairDirStatus').classList.contains('granted'));
  await page.evaluate(()=>{window.saveMode('normal');window.pickerCancel=true;});await page.locator('#chooseDirBtn').click();assert.equal(await page.locator('#customDirName').textContent(),'Client notes <raw>','Cancelled picker retains existing folder');
  await page.evaluate(()=>window.pickerCancel=false);await page.locator('#chooseDirBtn').click();await page.waitForFunction(()=>document.querySelector('#customDirName').textContent==='Chosen folder <raw>');
  const native=await page.evaluate(()=>({options:window.pickerOptions,writes:window.nativeWrites,destination:window.settingsValues().meetscribe_setting_destination}));
  assert.deepEqual(native.options,{mode:'readwrite'});assert.ok(native.writes.includes('verify'));assert.ok(native.writes.includes('closed'));assert.ok(native.writes.some(x=>x.removed?.startsWith('.meetscribe-verify-')));assert.equal(native.destination,'customDirectory');
  await page.locator('#resetBtn').click();await page.waitForFunction(()=>document.querySelector('#settingsForm').dataset.state==='saved');
  assert.equal(await page.locator('#opacityInput').inputValue(),'96');assert.equal(await page.locator('#fontSizeInput').inputValue(),'14');assert.equal(await page.locator('#languageInput').inputValue(),'vi');assert.ok(await page.locator('input[value="downloads"]').isChecked());
  await fs.mkdir(path.resolve(__dirname,'../.work/lucian/settings-screenshots'),{recursive:true});
  for(const language of ['vi','en']){
   await page.evaluate(lang=>window.changeLanguage(lang),language);
   for(const width of [1440,1024,768,390]){
    await page.setViewportSize({width,height:1100});await page.evaluate(()=>scrollTo(0,0));
    const geometry=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,small:[...document.querySelectorAll('button,select,input[type="range"],.radio-option,nav a')].filter(n=>n.getBoundingClientRect().height>0&&n.getBoundingClientRect().height<44).map(n=>n.id||n.className),preview:document.querySelector('.appearance-preview').getBoundingClientRect().toJSON(),controls:document.querySelector('.preferences-column').getBoundingClientRect().toJSON()}));
    assert.equal(geometry.overflow,false,`${language} ${width}: no horizontal overflow`);assert.deepEqual(geometry.small,[],`${language} ${width}: 44px targets`);
    if(width>=1200)assert.ok(geometry.preview.left>=geometry.controls.right,'Desktop stage stands beside preferences');else assert.ok(geometry.preview.top>=geometry.controls.top,'Stacked preview stays in content flow');
    for(const control of await page.locator('button:visible,select:visible,input[type=range]:visible').all()){await control.focus();assert.ok(await control.evaluate(n=>{const r=n.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===n||n.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),`${language} ${width}: focused ${await control.getAttribute('id')} is unobscured`);}
    await page.locator('#saveBtn').focus();assert.ok(await page.evaluate(()=>{const n=document.activeElement,r=n.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')===n;}),'Save remains unobscured');
    await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.resolve(__dirname,`../.work/lucian/settings-screenshots/settings-${language}-${width}.png`),fullPage:true});
   }
  }
  await page.locator('#fontSizeInput').fill('18');await page.locator('#opacityInput').fill('40');assert.ok(await page.locator('#statusBanner').isHidden(),'Editing a saved draft clears the stale success confirmation');for(const language of ['en','vi']){await page.evaluate(lang=>window.changeLanguage(lang),language);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Maximum font has no horizontal overflow');await page.screenshot({path:path.resolve(__dirname,`../.work/lucian/settings-screenshots/settings-${language}-390-font18-opacity40.png`),fullPage:true});}
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.save-area').evaluate(n=>getComputedStyle(n).transitionDuration),'0s');
  assert.deepEqual(errors,[]);console.log('PASS settings studio: truthful dirty/saving/saved/error; full preview; native folder/repair; VI/EN draft/raw-error retention; 1440/1024/768/390 layouts, 44px targets and focus.');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
