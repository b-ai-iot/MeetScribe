(() => {
 const i18n=globalThis.__meetScribeI18n;
 // Never retain a collector whose callbacks captured an absent/partial translator.
 // A later install can safely retry after loading the dependencies.
 if(!['t','applyTranslations','setLanguage','getLanguage','errorMessage','translateMessage'].every(key=>typeof i18n?.[key]==='function'))return {ok:false,error:'MeetScribe translation dependencies are not ready'};
 const t=(key,params={})=>i18n.t('toolbar.'+key,params);
 const prior=globalThis.__meetScribe;
 if(prior?.valid())return;
 const recovered=prior?.dispose()||[];
 let caption=null,share=null,captionSource='auto',observer=null,picker=null,session=null,running=false,starting=false,stopping=false,lost=false;
 let buffer=recovered,sequence=0,last='',flushTimer=null,flight=null,healthBusy=false,pendingBytes=0;
 let host=null,root=null,collapsed=true,notice='',noticeKind='info',healthTimer,refreshPicker=null;
 const visible = el => {
  if (globalThis.__meetScribeCaptions?.isElementVisible) {
   return globalThis.__meetScribeCaptions.isElementVisible(el);
  }
  if (!el || !el.isConnected) return false;
  let curr = el;
  while (curr && curr.nodeType !== 9) {
   if (curr.style && (curr.style.display === 'none' || curr.style.visibility === 'hidden' || curr.style.opacity === '0')) return false;
   if (typeof getComputedStyle === 'function') {
    try {
     const s = getComputedStyle(curr);
     if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return false;
    } catch {}
   }
   curr = curr.parentElement;
  }
  if (typeof el.getBoundingClientRect === 'function') {
   try {
    const r = el.getBoundingClientRect();
    if (r && typeof r.width === 'number' && typeof r.height === 'number') {
     if (r.width === 0 || r.height === 0) return false;
    }
   } catch {}
  }
  return true;
 };
 const $=id=>root?.getElementById(id);
 const icons={note:'<path d="M8 3h8l4 4v14H4V3h4m8 0v5h5M8 12h8M8 16h5"/>',play:'<path d="m9 5 11 7-11 7Z"/>',stop:'<rect x="6" y="6" width="12" height="12" rx="2"/>',caption:'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 10H7v4h3m7-4h-3v4h3"/>',screen:'<rect x="3" y="3" width="18" height="14" rx="2"/><path d="M8 21h8m-4-4v4m-4-12 4-4 4 4m-4-4v9"/>',mark:'<path d="M6 21V3m0 1h12l-3 5 3 5H6"/>',folder:'<path d="M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/>',minus:'<path d="M6 12h12"/>',move:'<path d="M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3m12-6 3 3-3 3"/>',arrow:'<path d="M8 5h11v11m0-11L5 19"/>',download:'<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>',settings:'<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>'};
 const brand=placement=>`<svg class="brand-mark" width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true"><defs><linearGradient id="brand-mint-${placement}" x1="4" y1="2" x2="28" y2="30" gradientUnits="userSpaceOnUse"><stop stop-color="#A5F3D4"/><stop offset="1" stop-color="#36B99B"/></linearGradient></defs><rect width="32" height="32" rx="9" fill="url(#brand-mint-${placement})"/><path d="M8 7.5h16v13H14l-6 5v-18Z" stroke="#154E40" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 12v3m4-5v7m4-5v3" stroke="#154E40" stroke-width="1.8" stroke-linecap="round"/></svg>`;
 const icon=name=>`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
 function setSession(value,begin=false){
  if(!value)return;
  if(session&&!begin){if(session.id!==value.id)return;if(['completed','interrupted'].includes(session.status)&&['recording','stopping'].includes(value.status))return;}
  session=value;
 }
 function connected(){try{return !lost&&!!chrome.runtime.id;}catch{return false;}}
 function fault(message){
  notice=message;noticeKind='error';running=false;observer?.disconnect();clearTimeout(flushTimer);flushTimer=null;
  if(/context invalidated|receiving end|message port closed|extension.*reload/i.test(message)){lost=true;clearInterval(healthTimer);picker?.();}
  render();
 }
 async function send(type,data={}){
  try{
   const result=await chrome.runtime.sendMessage({scope:'meetscribe',target:'worker',type,sid:session?.id,...data});
   if(!result?.ok)throw Error(result?.errorCode||result?.error||result?.message?i18n.errorMessage(result):t('noAcknowledgement'));return result;
  }catch(e){if(/context invalidated/i.test(e.message)){lost=true;clearInterval(healthTimer);fault(t('reloaded'));}throw e;}
 }
 function discover(){
  if(globalThis.__meetScribeCaptions?.findCaptionContainer){
   const res=globalThis.__meetScribeCaptions.findCaptionContainer(document);
   return res.container;
  }
  return [...document.querySelectorAll('#live-transcription-subtitle,.live-transcription-subtitle__box,.live-transcription-subtitle,.transcript-container__transcripts,.transcript-container,[role="log"][aria-label*="transcript" i],div[aria-label="Phụ đề"],div[aria-label="Captions"],[role="log"][aria-label*="caption" i]')].find(visible)||null;
 }
 function reacquireIfNeeded(){
  if(captionSource==='manual'){
   return visible(caption)?caption:null;
  }
  if(visible(caption))return caption;
  const next=discover();
  if(next&&next!==caption){
   caption=next;captionSource='auto';
   if(running)bind(false);
  }
  return visible(caption)?caption:null;
 }
 function snapshot(){
  if(!running)return;
  if(!visible(caption))reacquireIfNeeded();
  if(!visible(caption))return;
  const text=caption.innerText?.trim();if(!text)return;if(text===last)return;
  if(text.length>2000000||buffer.length>=20000||pendingBytes+text.length*2>128*1024*1024){fault(t('bufferLimit'));return;}
  last=text;buffer.push({sequence:++sequence,timestamp:new Date().toISOString(),text,speaker:null});pendingBytes+=text.length*2;
  if(!flushTimer)flushTimer=setTimeout(()=>{flushTimer=null;flush().catch(e=>fault(e.message));},10000);
  if(buffer.length>=100)flush().catch(e=>fault(e.message));
 }
 function bind(resetLast=true){observer?.disconnect();if(resetLast)last='';if(running&&caption){observer=new MutationObserver(snapshot);observer.observe(caption,{subtree:true,characterData:true,childList:true});snapshot();}}
 async function flush(){
  if(flight){await flight;if(buffer.length)return flush();return;}
  clearTimeout(flushTimer);flushTimer=null;
  flight=(async()=>{
   while(buffer.length){
    let size=0,n=0;while(n<Math.min(100,buffer.length)&&(n===0||size+buffer[n].text.length*2<8*1024*1024)){size+=buffer[n].text.length*2;n++;}
    const entries=buffer.slice(0,n);let ack,error;
    for(let attempt=0;attempt<3;attempt++){
     try{ack=await send('caption',{entries});break;}catch(e){error=e;if(lost||!connected())break;await new Promise(r=>setTimeout(r,500*(attempt+1)));}
    }
    if(!ack)throw error;
    buffer.splice(0,entries.length);pendingBytes=Math.max(0,pendingBytes-size);
    if(session)session.count=ack.count??session.count;render();
   }
  })();
  try{await flight;}finally{flight=null;}
 }
 function rectangle(){
  if(!visible(share))return null;const r=share.getBoundingClientRect();
  const x=Math.max(0,r.left),y=Math.max(0,r.top),right=Math.min(innerWidth,r.right),bottom=Math.min(innerHeight,r.bottom);
  if(right<=x||bottom<=y)return null;
  return {x:x/innerWidth,y:y/innerHeight,w:(right-x)/innerWidth,h:(bottom-y)/innerHeight,key:share.tagName+':'+Math.round(r.width)+':'+Math.round(r.height),confirmedBy:'user-selection'};
 }
 function inspect(){reacquireIfNeeded();return {sid:session?.id,directChild:window.parent===window.top,sourcePath:location.origin+location.pathname,captionAvailable:visible(caption),shareAvailable:!!rectangle(),rect:rectangle()};}
 function pick(kind){
  picker?.();let target=null;
  const frame=document.createElement('div'),tip=document.createElement('div');
  frame.style.cssText='position:fixed;z-index:2147483646;pointer-events:none;border:3px solid #59e2c0;border-radius:8px;background:#59e2c012;';
  tip.style.cssText='position:fixed;z-index:2147483647;top:16px;left:16px;max-width:calc(100vw - 48px);padding:14px 18px;border-radius:12px;background:#142c29;color:#f0fdfa;font:14px/1.5 system-ui;pointer-events:none;box-shadow:0 8px 32px #0005';
  let tipKey=kind==='caption'?'pickCaption':'pickShare';
  refreshPicker=()=>{tip.textContent=t(tipKey);};refreshPicker();
  document.documentElement.append(frame,tip);
  const draw=()=>{if(!target)return;const r=target.getBoundingClientRect();Object.assign(frame.style,{left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'});};
  const move=e=>{if(e.composedPath().includes(host))return;target=e.target;draw();};
  const wheel=e=>{e.preventDefault();if(target?.parentElement){target=target.parentElement;draw();}};
  const key=e=>{if(e.key==='Escape'){e.stopImmediatePropagation();cleanup();noticeKind='info';notice=t('pickCancelled');render();}};
  const cleanup=()=>{for(const [name,fn] of [['pointermove',move],['click',click],['keydown',key],['wheel',wheel]])document.removeEventListener(name,fn,true);frame.remove();tip.remove();picker=null;refreshPicker=null;render();if(host?.isConnected)$(collapsed?'compact':kind==='caption'?'caption':'share').focus({preventScroll:true});};
  const click=e=>{
   if(e.composedPath().includes(host))return;
   e.preventDefault();e.stopImmediatePropagation();
   if(!target||target===document.body||target===document.documentElement){tipKey='pickSmaller';refreshPicker();return;}
   if(kind==='caption'){caption=target;captionSource='manual';bind();cleanup();noticeKind='info';notice=t('captionSelected');render();}
   else {share=target;cleanup();action(async()=>{if(!running)throw Error(t('startBeforeShare'));const result=await send('visual-start');setSession(result.session);notice=t('shareSelected');});}
  };
  document.addEventListener('pointermove',move,true);document.addEventListener('wheel',wheel,{capture:true,passive:false});document.addEventListener('click',click,true);document.addEventListener('keydown',key,true);picker=cleanup;render();
 }
 function rescue(){
  const blob=new Blob([buffer.map(e=>JSON.stringify(e)).join('\n')+'\n'],{type:'application/x-ndjson'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='MeetScribe-caption-recovery-'+new Date().toISOString().replace(/[:.]/g,'-')+'.jsonl';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
  notice=t('rescued',{count:buffer.length});render();
 }
 async function action(fn){try{notice='';noticeKind='info';await fn();}catch(e){notice=e.message;noticeKind='error';}finally{render();}}
 function render(){
  if(!root)return;
  const active=running||starting||stopping;
  $('expanded').hidden=collapsed||!!picker;$('compact').hidden=false;$('compact').setAttribute('aria-expanded',String(!$('expanded').hidden));
  $('start').hidden=running||stopping;$('stop').hidden=!running&&!stopping&&!['recording','stopping'].includes(session?.status);
  $('start').disabled=starting||stopping||lost||buffer.length>0&&!running;
  $('stop').disabled=stopping;
  $('retry').hidden=lost||running||!['recording','stopping'].includes(session?.status);$('retry').disabled=stopping;
  i18n.applyTranslations(root);refreshPicker?.();
  $('startLabel').textContent=t(starting?'preparingEllipsis':'start');
  $('stopLabel').textContent=t(stopping?'savingEllipsis':'stop');
  $('caption').disabled=lost||stopping;$('share').disabled=!running||stopping||lost;$('mark').disabled=!running||lost||stopping;
  $('rescue').hidden=!notice&&!lost||buffer.length===0&&!lost;
  const status=t(lost?'reconnect':notice&&noticeKind==='error'?'check':stopping?'saving':starting?'preparing':running?(visible(caption)?(session?.count?'recording':'waitingCaption'):'lostCaptionStatus'):session?.status==='completed'?'stopped':session?.status==='interrupted'?'interrupted':'ready');
  $('status').textContent=status;$('compactText').textContent=status;
  const captionMissing=running&&!visible(caption),shareMissing=running&&session?.visual==='ready'&&!rectangle(),imagesUnavailable=running&&session?.visual==='unavailable';
  const errorState=lost||notice&&noticeKind==='error'||captionMissing||shareMissing||imagesUnavailable||session?.exportError;
  $('dot').dataset.state=errorState?'error':running?'live':'idle';$('compactDot').dataset.state=$('dot').dataset.state;
  if(!lost&&!(notice&&noticeKind==='error')&&!captionMissing){
   if(shareMissing)$('compactText').textContent=t('lostShareStatus');
   else if(imagesUnavailable)$('compactText').textContent=t('visualUnavailableStatus');
   else if(session?.exportError&&!notice)$('compactText').textContent=t('check');
  }
  const healthWarning=captionMissing?t('lostCaption'):shareMissing?t('lostShare'):imagesUnavailable?t('visualUnavailable'):'';
  const translatedNotice=i18n.translateMessage(notice);
  $('message').textContent=(noticeKind==='error'&&notice?translatedNotice:healthWarning||translatedNotice)||t(running?(session?.visual==='unavailable'?'visualUnavailable':session?.visual==='ready'&&!rectangle()?'lostShare':session?.visual==='ready'?'visualReady':'captionOnly'):'initialHint');
  $('metrics').textContent=t('metrics',{captions:session?.count||0,images:session?.images||0});
  const isCustomDest=session?.destination==='customDirectory';
  const customTarget=session?.destinationName||t('selectedFolder');
  $('storage').textContent=session?.exportError?t('exportError'):session?.pendingExports?t('pendingExports',{count:session.pendingExports}):session?.count?(isCustomDest?t('exportedCustom',{folder:customTarget}):t('exportedDownloads')):(isCustomDest?t('saveCustom',{folder:customTarget}):t('saveDownloads'));
  $('path').textContent=session?.folder||t('defaultPath');
  $('title').textContent=session?.title||document.title.replace(/^(?:Meet|Zoom)\s*[-–—]\s*/,'')||t('defaultTitle');
  $('share').setAttribute('aria-pressed',String(!!rectangle()));$('clearShare').hidden=!share;
  $('liveBadge').textContent=t(active?'liveBadge':'privateBadge');
  updateClock();
  const compactStatus=$('compactText').textContent;
  const detail=errorState?$('message').textContent+(session?.exportError?' · '+t('exportError'):''):t('moveHint');
  $('compact').setAttribute('aria-label',`${t($('expanded').hidden?'expand':'collapse')} · ${compactStatus}${session?' · '+$('compactElapsed').textContent:''}`);
  $('compact').title=`${compactStatus} · ${detail}`;$('compact').setAttribute('aria-description',detail);
  $('launcherStatus').title=detail;
  clamp();
 }
 // Host coordinates always describe the 60px launcher, independent of panel size.
 // Keep the popover in the larger vertical space and scroll its content when needed.
 function defaultPosition(){return {x:Math.max(12,innerWidth-84),y:Math.max(12,innerHeight-144)};}
 function clamp(){
  if(!host)return;
  const margin=12,size=60,gap=12;
  const x=Math.min(Math.max(margin,parseFloat(host.style.left)||margin),Math.max(margin,innerWidth-size-margin));
  const y=Math.min(Math.max(margin,parseFloat(host.style.top)||margin),Math.max(margin,innerHeight-size-margin));
  host.style.left=x+'px';host.style.top=y+'px';
  const panel=$('expanded'),width=Math.min(344,innerWidth-margin*2);
  panel.style.width=width+'px';
  panel.style.left=(Math.max(margin,Math.min(innerWidth-margin-width,x+size-width))-x)+'px';
  const above=y-margin-gap,below=innerHeight-y-size-margin-gap;
  const upward=above>=below,available=Math.max(0,upward?above:below);
  panel.style.maxHeight=available+'px';
  panel.style.top=(upward?-Math.min(panel.scrollHeight,available)-gap:size+gap)+'px';
  const status=$('launcherStatus'),leftSpace=x-margin-gap,rightSpace=innerWidth-x-size-margin-gap;
  const useLeft=leftSpace>=rightSpace,statusWidth=Math.min(184,Math.max(leftSpace,rightSpace));
  status.style.width=Math.max(0,statusWidth)+'px';status.style.left=(useLeft?-statusWidth-gap:size+gap)+'px';
 }
 function updateClock(){
  if(!root)return;
  const seconds=session?.createdAt?Math.max(0,Math.floor(((session.endedAt?Date.parse(session.endedAt):Date.now())-Date.parse(session.createdAt))/1000)):0;
  const elapsed=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
  $('elapsed').textContent=elapsed;$('compactElapsed').textContent=elapsed;$('compactElapsed').hidden=!session;
  $('compact').setAttribute('aria-label',`${t($('expanded').hidden?'expand':'collapse')} · ${$('compactText').textContent}${session?' · '+elapsed:''}`);
 }
 let drag=null,suppressClick=false;
 function finishDrag(persist=true){
  if(!drag)return;
  const current=drag;drag=null;
  if(current.moved)suppressClick=true;
  try{if(current.target.hasPointerCapture(current.id))current.target.releasePointerCapture(current.id);}catch{}
  host.removeAttribute('data-dragging');
  if(current.moved&&persist)savePosition();
 }
 function bindMovement(target){
  target.onkeydown=e=>{
   const movement={ArrowLeft:[-24,0],ArrowRight:[24,0],ArrowUp:[0,-24],ArrowDown:[0,24]}[e.key];
   if(!movement)return;e.preventDefault();e.stopPropagation();
   const r=host.getBoundingClientRect(),step=e.shiftKey?2:1;host.style.left=r.x+movement[0]*step+'px';host.style.top=r.y+movement[1]*step+'px';clamp();savePosition();
  };
  target.onpointerdown=e=>{
   if(e.button!==0||e.isPrimary===false||drag)return;
   suppressClick=false;
   const r=host.getBoundingClientRect();drag={id:e.pointerId,target,x:e.clientX,y:e.clientY,left:r.x,top:r.y,moved:false};
   try{target.setPointerCapture(e.pointerId);}catch{}
  };
  target.onpointermove=e=>{
   if(!drag||drag.id!==e.pointerId)return;
   const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
   if(!drag.moved&&Math.hypot(dx,dy)<6)return;
   drag.moved=true;e.preventDefault();host.setAttribute('data-dragging','');
   host.style.left=drag.left+dx+'px';host.style.top=drag.top+dy+'px';clamp();
  };
  target.onpointerup=e=>{if(drag?.id===e.pointerId)finishDrag();};
  target.onpointercancel=e=>{if(drag?.id===e.pointerId)finishDrag();};
  target.onlostpointercapture=()=>finishDrag();
 }
 function dismissPanel(e){if(e.key==='Escape'&&root&&!collapsed&&!picker){e.preventDefault();e.stopPropagation();setCollapsed(true,true);}}
 function setCollapsed(value,focus=false){
  collapsed=value;saveCollapsedState(value);render();
  if(focus)$(value?'compact':'collapse').focus({preventScroll:true});
 }
 function applyVisualSettings(s){
  i18n.setLanguage(s?.language);
  if(host)host.setAttribute('lang',i18n.getLanguage());
  if(!host)return;
  const op=typeof s?.opacity==='number'?Math.min(100,Math.max(40,Math.round(s.opacity))):96;
  const fs=typeof s?.fontSize==='number'?Math.min(18,Math.max(12,Math.round(s.fontSize))):14;
  host.style.setProperty('--surface',`rgba(20,28,34,${(op/100).toFixed(2)})`);
  host.style.setProperty('--font-size',`${fs}px`);
  if(s?.toolbarPosition&&Number.isFinite(s.toolbarPosition.x)&&Number.isFinite(s.toolbarPosition.y)){
   host.style.left=Math.round(s.toolbarPosition.x)+'px';host.style.top=Math.round(s.toolbarPosition.y)+'px';
  } else {
   const position=defaultPosition();host.style.left=position.x+'px';host.style.top=position.y+'px';
  }
  if(typeof s?.collapsed==='boolean')collapsed=s.collapsed;
  clamp();
 }
 // UI preferences are best effort; an invalidated context may throw before returning a promise.
 function savePreference(values){
  try{chrome.storage.local.set(values).catch(()=>{});}catch{}
 }
 function savePosition(){
  if(!host)return;
  const r=host.getBoundingClientRect();
  const pos={x:Math.round(r.left),y:Math.round(r.top)};
  savePreference({meetscribe_setting_toolbarPosition:pos});
 }
 function saveCollapsedState(val){
  savePreference({meetscribe_setting_collapsed:Boolean(val)});
 }
 let storageListener=null;
 function mount(css){
  if(host){host.hidden=false;render();return;}
  host=document.createElement('meetscribe-toolbar');host.style.cssText='position:fixed;width:60px;height:60px;z-index:2147483645;';const position=defaultPosition();host.style.left=position.x+'px';host.style.top=position.y+'px';
  root=host.attachShadow({mode:'open'});const style=document.createElement('style');style.textContent=css;root.append(style);
  const box=document.createElement('div');box.innerHTML=`
  <section id="expanded" class="panel" aria-label="MeetScribe · Bộ điều khiển ghi họp" data-i18n-aria-label="toolbar.controls">
   <header><span class="brand">${brand('panel')}<strong>MeetScribe</strong></span><span id="liveBadge" class="badge">LOCAL · PRIVATE</span><button id="collapse" data-i18n-aria-label="toolbar.collapse" data-i18n-title="toolbar.collapse" class="icon" aria-label="Thu nhỏ" title="Thu nhỏ">${icon('minus')}</button></header>
   <div class="meeting"><p class="eyebrow" data-i18n="toolbar.currentMeeting">CUỘC HỌP HIỆN TẠI</p><h2 id="title"></h2></div>
   <div class="statusline"><span id="dot" class="dot"></span><strong id="status" role="status"></strong><time id="elapsed">00:00</time></div>
   <div class="primary"><button id="start" class="start">${icon('play')}<span id="startLabel">Bắt đầu ghi</span></button><button id="stop" class="stop" hidden>${icon('stop')}<span id="stopLabel">Dừng và lưu</span></button></div>
   <div class="tools"><button id="caption">${icon('caption')}<span data-i18n="toolbar.captionRegion">Vùng caption</span></button><button id="share" aria-pressed="false">${icon('screen')}<span data-i18n="toolbar.shareRegion">Vùng share</span></button><button id="mark">${icon('mark')}<span data-i18n="toolbar.mark">Đánh dấu</span></button></div>
   <p id="message" class="hint" role="status"></p><button id="clearShare" data-i18n="toolbar.clearShare" class="textbutton" hidden>Ngừng chụp vùng share</button>
   <button id="retry" data-i18n="toolbar.retry" class="rescue" hidden>Thử lưu và tiếp tục</button><button id="rescue" class="rescue" hidden>${icon('download')} <span data-i18n="toolbar.rescue">Cứu caption đang chờ</span></button>
   <div class="saved"><span id="metrics">0 caption · 0 ảnh</span><span id="storage"></span></div>
   <footer><span id="path" data-i18n-title="toolbar.storageFolder" title="Thư mục lưu"></span><button id="settings" data-i18n-aria-label="toolbar.settings" data-i18n-title="toolbar.settings" class="icon" aria-label="Cài đặt MeetScribe" title="Cài đặt MeetScribe">${icon('settings')}</button><button id="library" data-i18n-aria-label="toolbar.library" data-i18n-title="toolbar.library" class="icon" aria-label="Thư viện phiên họp" title="Thư viện phiên họp">${icon('folder')}</button><button id="move" data-i18n-aria-label="toolbar.move" data-i18n-title="toolbar.moveHint" class="icon" aria-label="Di chuyển thanh điều khiển" title="Kéo hoặc dùng phím mũi tên để di chuyển">${icon('move')}</button></footer>
   <div class="position-actions"><button id="resetPosition" class="reset-position" data-i18n="toolbar.resetPosition">Đặt lại vị trí</button><span data-i18n="toolbar.moveHint">Kéo hoặc dùng phím mũi tên để di chuyển</span></div>
  </section><button id="compact" class="compact" aria-label="Mở rộng MeetScribe" aria-controls="expanded" aria-expanded="false" aria-describedby="launcherStatus">${brand('launcher')}<span id="compactDot" class="dot" aria-hidden="true"></span></button><div id="launcherStatus" class="launcher-status"><span id="compactText">Sẵn sàng</span><time id="compactElapsed" hidden>00:00</time></div>`;root.append(box);document.documentElement.append(host);
  $('collapse').onclick=()=>setCollapsed(true,true);
  $('compact').onclick=e=>{if(suppressClick){suppressClick=false;if(e.detail!==0)return;}if(picker){picker();return;}setCollapsed(!collapsed,true);};
  window.addEventListener('keydown',dismissPanel);
  $('resetPosition').onclick=()=>{const position=defaultPosition();host.style.left=position.x+'px';host.style.top=position.y+'px';clamp();savePosition();$('compact').focus({preventScroll:true});};
  $('start').onclick=()=>action(async()=>{
   if(starting||running)return;starting=true;render();
   try{caption=visible(caption)?caption:discover();if(!caption){pick('caption');throw Error(t('chooseCaption'));}
    const result=await send('start');setSession(result.session);
   }finally{starting=false;}
  });
  $('stop').onclick=()=>action(async()=>{if(stopping)return;stopping=true;render();try{const result=await send('stop');setSession(result.session);}finally{stopping=false;}});
  $('caption').onclick=()=>{
   if(visible(caption)&&globalThis.__meetScribeCaptions?.highlightCaptionRegion){
    globalThis.__meetScribeCaptions.highlightCaptionRegion(caption,2000);
   }
   pick('caption');
  };
  $('share').onclick=()=>pick('share');
  $('mark').onclick=()=>action(async()=>{snapshot();await flush();const result=await send('mark');notice=result.message;});
  $('clearShare').onclick=()=>action(async()=>{share=null;await send('clear-share');if(session)session.visual='not-selected';});
  $('retry').onclick=()=>action(async()=>{await flush();if(session?.status==='recording'){running=true;bind();}notice=t('resumed');});
  $('settings').onclick=()=>action(()=>send('open-settings'));
  $('library').onclick=()=>action(()=>send('open-library'));$('rescue').onclick=rescue;
  bindMovement($('move'));bindMovement($('compact'));
  try{if(chrome?.storage?.local){
   const load=()=>{chrome.storage.local.get(['meetscribe_settings','meetscribe_setting_opacity','meetscribe_setting_fontSize','meetscribe_setting_toolbarPosition','meetscribe_setting_collapsed','meetscribe_setting_language'],res=>{
    const s={language:res.meetscribe_setting_language!==undefined?res.meetscribe_setting_language:res.meetscribe_settings?.language,opacity:res.meetscribe_setting_opacity??res.meetscribe_settings?.opacity,fontSize:res.meetscribe_setting_fontSize??res.meetscribe_settings?.fontSize,toolbarPosition:res.meetscribe_setting_toolbarPosition!==undefined?res.meetscribe_setting_toolbarPosition:res.meetscribe_settings?.toolbarPosition,collapsed:res.meetscribe_setting_collapsed??res.meetscribe_settings?.collapsed};
    applyVisualSettings(s);render();
   });};
   load();
   storageListener=(ch,a)=>{if(a==='local'&&Object.keys(ch).some(k=>k.startsWith('meetscribe_setting')))load();};
   chrome.storage.onChanged.addListener(storageListener);
  }}catch{}
  caption=discover();render();
 }
 const handler=(msg,sender,reply)=>{
  if(sender.id!==chrome.runtime.id||msg?.scope!=='meetscribe'||msg.target!=='content')return;
  (async()=>{
   if(msg.type==='mount'){mount(msg.css);return {};}
   if(msg.type==='inspect')return inspect();
   if(msg.type==='begin'){
    if(running&&session?.id===msg.session.id)return {};
    if(buffer.length)throw Error(t('rescueBeforeStart'));
    setSession(msg.session,true);sequence=session.lastSequence||0;running=true;lost=false;notice='';last='';bind(true);render();return {};
   }
   if(msg.type==='end'){reacquireIfNeeded();snapshot();running=false;observer?.disconnect();picker?.();await flush();render();return {};}
   if(msg.type==='status'){setSession(msg.session);if(!['recording','stopping'].includes(session?.status)){running=false;observer?.disconnect();}render();return {};}
   if(msg.type==='highlight-caption'){
    if(visible(caption)&&globalThis.__meetScribeCaptions?.highlightCaptionRegion){
     globalThis.__meetScribeCaptions.highlightCaptionRegion(caption,msg.durationMs||2000);
    }
    return {ok:true,captionAvailable:visible(caption)};
   }
   throw Error(t('unknownCommand'));
  })().then(data=>reply({ok:true,...data})).catch(e=>{notice=e.message;render();reply({ok:false,error:e.message});});return true;
 };
 chrome.runtime.onMessage.addListener(handler);
 healthTimer=setInterval(()=>{
  if(!running||healthBusy||lost)return;healthBusy=true;
  const info=inspect();
  const texts=[...document.querySelectorAll('[role="status"],[role="alert"],[role="dialog"] h1,[role="dialog"] h2,[role="dialog"] p,.zm-modal-body,.zm-modal-body-title,h1,h2')].filter(el=>visible(el)&&el!==caption&&!caption?.contains(el)&&!el.contains(caption)&&!el.closest('meetscribe-toolbar')).map(el=>el.innerText?.trim()).filter(Boolean);
  const hasLeave=[...document.querySelectorAll('button,[role="button"]')].some(el=>visible(el)&&/leave|rời khỏi|rời cuộc họp|kết thúc cuộc họp|end meeting/i.test(el.getAttribute('aria-label')||el.innerText||''));
  send('health',{...info,texts,hasLeave}).then(result=>{if(result.session)setSession(result.session);render();}).catch(e=>fault(e.message)).finally(()=>healthBusy=false);
 },5000);
 const clockTimer=setInterval(updateClock,1000);
 const resize=()=>clamp();window.addEventListener('resize',resize);
 const unload=e=>{if(running||buffer.length||stopping){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',unload);
 globalThis.__meetScribe={bootstrapReady:true,valid:connected,dispose(){clearInterval(healthTimer);clearInterval(clockTimer);clearTimeout(flushTimer);observer?.disconnect();picker?.();finishDrag(false);host?.remove();try{chrome.runtime.onMessage.removeListener(handler);}catch{}try{if(storageListener)chrome.storage.onChanged.removeListener(storageListener);}catch{}window.removeEventListener('keydown',dismissPanel);window.removeEventListener('resize',resize);window.removeEventListener('beforeunload',unload);return buffer;}};
})();
