// Real extension UI, synthetic meeting content, disposable browser profile.
const {chromium} = require('playwright');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'docs', 'images');
const fixture = `<!doctype html><html lang="en"><meta charset="utf-8">
<title>Meet — Weekly planning · demo</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#131b22;color:#eaf2f4;font:16px/1.5 system-ui}
header{padding:28px 36px;border-bottom:1px solid #334450;display:flex;justify-content:space-between}
.badge{color:#8ae8ca;font-size:13px}main{margin:36px 36px 36px 420px}
.slide{background:#f4f7f7;color:#203a3c;border-radius:20px;padding:42px;min-height:460px}
.eyebrow{color:#55726c;font-size:12px;letter-spacing:2px}h1{font-size:40px;margin:14px 0 24px}
.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.card{padding:22px;background:#e2eeea;border-radius:14px}
.card b{display:block;font-size:26px;color:#24644f;margin-bottom:10px}.note{color:#647f83;font-size:14px;margin-top:32px}
#caps{position:fixed;bottom:112px;left:450px;right:80px;padding:20px 26px;border:1px solid #425866;background:#24343f;border-radius:15px}
#caps small{display:block;color:#8ae8ca;margin-bottom:7px}.controls{position:fixed;bottom:26px;left:450px;right:36px;display:flex;justify-content:space-between;color:#a2b8c1;font-size:14px}
button{background:#313f49;color:#edf4f7;border:1px solid #54616b;border-radius:10px;padding:10px 20px}
</style>
<header><strong>Weekly planning <span class="badge">· DEMO</span></strong><span class="badge">Synthetic meeting · no live call</span></header>
<main><div class="slide"><div class="eyebrow">SAMPLE SHARED CONTENT</div><h1>A clear plan for the week.</h1>
<div class="cards"><div class="card"><b>01</b>Review feedback</div><div class="card"><b>02</b>Agree on priorities</div><div class="card"><b>03</b>Assign next steps</div></div>
<p class="note">MeetScribe documentation fixture. All names, captions and content are fictional.</p></div></main>
<div id="caps" aria-label="Captions"><small>LIVE CAPTIONS · DEMO DATA</small><div>Lan: Chúng ta sẽ chốt danh sách ưu tiên và phân công công việc trong tuần.</div></div>
<div class="controls"><span>Demo captions enabled</span><button aria-label="Leave call">Leave demo</button></div></html>`;

(async () => {
  const scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'meetscribe-docs-'));
  let context;
  try {
    const extension = path.join(scratch, 'extension');
    await fs.cp(path.join(root, 'extension'), extension, {recursive:true});
    const manifest = JSON.parse(await fs.readFile(path.join(extension, 'manifest.json'), 'utf8'));
    // Only the throwaway fixture has a host grant; the shipped manifest is untouched.
    manifest.host_permissions = ['https://meet.google.com/*'];
    await fs.writeFile(path.join(extension, 'manifest.json'), JSON.stringify(manifest));
    const profile = path.join(scratch, 'profile');
    await fs.mkdir(path.join(profile, 'Default'), {recursive:true});
    await fs.writeFile(path.join(profile, 'Default', 'Preferences'), JSON.stringify({
      download:{default_directory:path.join(scratch, 'downloads'), prompt_for_download:false}
    }));
    await fs.mkdir(out, {recursive:true});
    context = await chromium.launchPersistentContext(profile, {
      headless:true, channel:'chromium', viewport:{width:1440,height:960},
      timezoneId:'Asia/Ho_Chi_Minh', deviceScaleFactor:1,
      args:[`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
      acceptDownloads:true
    });
    await context.route('https://meet.google.com/**', route => route.fulfill({contentType:'text/html',body:fixture}));
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    const meeting = await context.newPage();
    const errors = [];
    meeting.on('pageerror', error => errors.push(error.message));
    await meeting.goto('https://meet.google.com/docs-demo-only');
    const dev = await context.newCDPSession(meeting);
    await dev.send('Browser.setDownloadBehavior', {behavior:'default'});
    const css = await fs.readFile(path.join(extension, 'overlay.css'), 'utf8');
    await worker.evaluate(async css => {
      const [tab] = await chrome.tabs.query({url:'https://meet.google.com/*'});
      await chrome.scripting.executeScript({target:{tabId:tab.id},files:['captions.js','content.js']});
      await chrome.tabs.sendMessage(tab.id,{scope:'meetscribe',target:'content',type:'mount',css});
    }, css);
    await meeting.getByRole('button',{name:'Bắt đầu ghi',exact:true}).click();
    await meeting.getByRole('button',{name:'Dừng và lưu',exact:true}).waitFor();
    await meeting.getByRole('button',{name:'Đánh dấu',exact:true}).click();
    await meeting.waitForFunction(() => document.querySelector('meetscribe-toolbar').shadowRoot.getElementById('metrics').textContent.startsWith('1 caption'));
    await meeting.screenshot({path:path.join(out, 'toolbar.png')});
    await meeting.locator('#caps div').evaluate(el => {el.textContent='Minh: Mỗi nhiệm vụ cần có người phụ trách và thời hạn rõ ràng.';});
    await meeting.getByRole('button',{name:'Dừng và lưu',exact:true}).click();
    await meeting.waitForFunction(() => document.querySelector('meetscribe-toolbar').shadowRoot.getElementById('status').textContent==='Đã dừng');

    const base = worker.url().replace('/background.js', '');
    const library = await context.newPage();
    await library.goto(base + '/library.html');
    // Seed a second completed session using the actual journal, including a demo slide.
    const slide = await meeting.locator('.slide').screenshot();
    await library.evaluate(async slide => {
      const store = await import('./store.mjs');
      const id = 'documentation-design-review';
      await store.createSession({id,title:'Design review · demo',folder:'MeetScribe/2026-10-29/Design-review--demo',status:'recording',
        count:0,lastSequence:0,createdAt:'2026-10-29T08:00:00.000Z',destination:'downloads',platform:'meet',version:'1.2.0'});
      await store.appendCaptions(id,[{sequence:1,timestamp:'2026-10-29T08:02:00.000Z',text:'Lan: Đây là nội dung minh họa cho tài liệu MeetScribe.',speaker:null}]);
      await store.saveImage(id,{name:'slide-demo.png',data:'data:image/png;base64,'+slide,bytes:Math.floor(slide.length*0.75),event:{timestamp:'2026-10-29T08:02:00.000Z',reason:'documentation-demo'}});
      await store.finalizeSession(id,{reason:'documentation-demo',endedAt:'2026-10-29T08:20:00.000Z'});
    }, slide.toString('base64'));
    await library.reload();
    await library.locator('.session').nth(1).waitFor();
    await library.locator('.backup-size').nth(1).waitFor();
    await library.locator('.thumb').waitFor();
    await library.screenshot({path:path.join(out,'library.png'),fullPage:true});
    await library.setViewportSize({width:390,height:844});
    await library.screenshot({path:path.join(out,'library-mobile.png'),fullPage:true});

    const settings = await context.newPage();
    await settings.goto(base + '/settings.html');
    await settings.locator('#opacityInput').fill('80');
    await settings.locator('#opacityInput').dispatchEvent('input');
    await settings.screenshot({path:path.join(out,'settings.png'),fullPage:true});
    if (errors.length) throw Error(errors.join('\n'));
    console.log('Generated 4 PNG screenshots from the unpacked extension with synthetic demo data.');
  } finally {
    if (context) await context.close();
    await fs.rm(scratch, {recursive:true,force:true});
  }
})().catch(error => {console.error(error);process.exitCode=1;});
