(() => {
 const prior=globalThis.__meetScribe;
 if(prior?.valid())return;
 const recovered=prior?.dispose()||[];
 let caption=null,share=null,observer=null,picker=null,session=null,running=false,starting=false,stopping=false,lost=false;
 let buffer=recovered,sequence=0,last='',flushTimer=null,flight=null,healthBusy=false,pendingBytes=0;
 let host=null,root=null,collapsed=false,notice='',noticeKind='info',healthTimer;
 const visible=el=>el?.isConnected&&el.getBoundingClientRect().width>0&&el.getBoundingClientRect().height>0&&getComputedStyle(el).visibility!=='hidden'&&getComputedStyle(el).display!=='none';
 const $=id=>root?.getElementById(id);
 const icons={note:'<path d="M8 3h8l4 4v14H4V3h4m8 0v5h5M8 12h8M8 16h5"/>',play:'<path d="m9 5 11 7-11 7Z"/>',stop:'<rect x="6" y="6" width="12" height="12" rx="2"/>',caption:'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 10H7v4h3m7-4h-3v4h3"/>',screen:'<rect x="3" y="3" width="18" height="14" rx="2"/><path d="M8 21h8m-4-4v4m-4-12 4-4 4 4m-4-4v9"/>',mark:'<path d="M6 21V3m0 1h12l-3 5 3 5H6"/>',folder:'<path d="M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/>',minus:'<path d="M6 12h12"/>',move:'<path d="M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3m12-6 3 3-3 3"/>',arrow:'<path d="M8 5h11v11m0-11L5 19"/>',download:'<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>',settings:'<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>'};
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
   if(!result?.ok)throw Error(result?.error||'Chưa nhận xác nhận lưu dữ liệu.');return result;
  }catch(e){if(/context invalidated/i.test(e.message)){lost=true;clearInterval(healthTimer);fault('Extension đã được nạp lại. Dữ liệu trước đó còn trong thư viện; cứu caption đang chờ rồi tải lại trang họp khi thuận tiện.');}throw e;}
 }
 function discover(){
  return [...document.querySelectorAll('#live-transcription-subtitle,.live-transcription-subtitle__box,.live-transcription-subtitle,.transcript-container__transcripts,.transcript-container,[role="log"][aria-label*="transcript" i],div[aria-label="Phụ đề"],div[aria-label="Captions"],[role="log"][aria-label*="caption" i]')].find(visible)||null;
 }
 function snapshot(){
  if(!running||!visible(caption))return;
  const text=caption.innerText?.trim();if(!text){last='';return;}if(text===last)return;
  if(text.length>2000000||buffer.length>=20000||pendingBytes+text.length*2>128*1024*1024){fault('Caption chờ lưu đã chạm giới hạn an toàn. Cứu dữ liệu đang chờ và kiểm tra thư viện.');return;}
  last=text;buffer.push({sequence:++sequence,timestamp:new Date().toISOString(),text,speaker:null});pendingBytes+=text.length*2;
  if(!flushTimer)flushTimer=setTimeout(()=>{flushTimer=null;flush().catch(e=>fault(e.message));},10000);
  if(buffer.length>=100)flush().catch(e=>fault(e.message));
 }
 function bind(){observer?.disconnect();last='';if(running&&caption){observer=new MutationObserver(snapshot);observer.observe(caption,{subtree:true,characterData:true,childList:true});snapshot();}}
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
 function inspect(){if(!visible(caption)&&!caption?.isConnected){const next=discover();if(next&&next!==caption){caption=next;bind();}}return {sid:session?.id,directChild:window.parent===window.top,sourcePath:location.origin+location.pathname,captionAvailable:visible(caption),shareAvailable:!!rectangle(),rect:rectangle()};}
 function pick(kind){
  picker?.();let target=null;
  const frame=document.createElement('div'),tip=document.createElement('div');
  frame.style.cssText='position:fixed;z-index:2147483646;pointer-events:none;border:3px solid #59e2c0;border-radius:8px;background:#59e2c012;';
  tip.style.cssText='position:fixed;z-index:2147483647;top:16px;left:16px;max-width:calc(100vw - 48px);padding:14px 18px;border-radius:12px;background:#142c29;color:#f0fdfa;font:14px/1.5 system-ui;pointer-events:none;box-shadow:0 8px 32px #0005';
  tip.textContent=`Chọn ${kind==='caption'?'khung phụ đề':'nội dung màn hình đang chia sẻ'} · cuộn để mở rộng vùng · Esc để hủy`;
  document.documentElement.append(frame,tip);
  const draw=()=>{if(!target)return;const r=target.getBoundingClientRect();Object.assign(frame.style,{left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'});};
  const move=e=>{if(e.composedPath().includes(host))return;target=e.target;draw();};
  const wheel=e=>{e.preventDefault();if(target?.parentElement){target=target.parentElement;draw();}};
  const key=e=>{if(e.key==='Escape'){e.stopImmediatePropagation();cleanup();noticeKind='info';notice='Đã hủy chọn vùng.';render();}};
  const cleanup=()=>{for(const [name,fn] of [['pointermove',move],['click',click],['keydown',key],['wheel',wheel]])document.removeEventListener(name,fn,true);frame.remove();tip.remove();picker=null;};
  const click=e=>{
   if(e.composedPath().includes(host))return;
   e.preventDefault();e.stopImmediatePropagation();
   if(!target||target===document.body||target===document.documentElement){tip.textContent='Chọn khung nhỏ hơn toàn trang để tránh lưu nội dung không liên quan.';return;}
   if(kind==='caption'){caption=target;bind();cleanup();noticeKind='info';notice='Đã chọn phụ đề. Bấm Bắt đầu khi sẵn sàng.';render();}
   else {share=target;cleanup();action(async()=>{if(!running)throw Error('Bắt đầu ghi caption trước khi bật ảnh share.');const result=await send('visual-start');setSession(result.session);notice='Đã chọn vùng share; đang tự lọc ảnh theo thay đổi.';});}
  };
  document.addEventListener('pointermove',move,true);document.addEventListener('wheel',wheel,{capture:true,passive:false});document.addEventListener('click',click,true);document.addEventListener('keydown',key,true);picker=cleanup;
 }
 function rescue(){
  const blob=new Blob([buffer.map(e=>JSON.stringify(e)).join('\n')+'\n'],{type:'application/x-ndjson'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='MeetScribe-caption-recovery-'+new Date().toISOString().replace(/[:.]/g,'-')+'.jsonl';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
  notice=`Đã yêu cầu tải ${buffer.length} caption đang chờ. Kiểm tra file tải xuống trước khi đóng tab.`;render();
 }
 async function action(fn){try{notice='';noticeKind='info';await fn();}catch(e){notice=e.message;noticeKind='error';}finally{render();}}
 function render(){
  if(!root)return;
  const active=running||starting||stopping;
  $('expanded').hidden=collapsed;$('compact').hidden=!collapsed;
  $('start').hidden=running||stopping;$('stop').hidden=!running&&!stopping&&!['recording','stopping'].includes(session?.status);
  $('start').disabled=starting||stopping||lost||buffer.length>0&&!running;
  $('stop').disabled=stopping;
  $('retry').hidden=lost||running||!['recording','stopping'].includes(session?.status);$('retry').disabled=stopping;
  $('startLabel').textContent=starting?'Đang chuẩn bị…':'Bắt đầu ghi';
  $('stopLabel').textContent=stopping?'Đang lưu…':'Dừng và lưu';
  $('caption').disabled=lost||stopping;$('share').disabled=!running||stopping||lost;$('mark').disabled=!running||lost||stopping;
  $('rescue').hidden=!notice&&!lost||buffer.length===0&&!lost;
  const status=lost?'Cần kết nối lại':notice&&noticeKind==='error'?'Cần kiểm tra':stopping?'Đang lưu phiên':starting?'Đang chuẩn bị':running?(visible(caption)?(session?.count?'Đang ghi':'Chờ caption'):'Mất vùng caption'):session?.status==='completed'?'Đã dừng':session?.status==='interrupted'?'Phiên gián đoạn':'Sẵn sàng';
  $('status').textContent=status;$('compactText').textContent=status;
  $('dot').dataset.state=lost||notice&&noticeKind==='error'?'error':running?'live':'idle';
  const healthWarning=running&&!visible(caption)?'Mất vùng caption. Chọn lại khung phụ đề để tiếp tục.':running&&session?.visual==='ready'&&!rectangle()?'Mất vùng share. Chọn lại vùng share; caption vẫn tiếp tục.':'';
  $('message').textContent=(noticeKind==='error'&&notice?notice:healthWarning||notice)|| (running?(session?.visual==='unavailable'?'Caption đang lưu · chưa lấy được ảnh share.':session?.visual==='ready'&&!rectangle()?'Mất vùng share. Chọn lại vùng share; caption vẫn tiếp tục.':session?.visual==='ready'?'Tự lưu caption và chọn ảnh từ vùng share đã xác nhận.':'Caption tự lưu. Chọn vùng share khi có trình chiếu.'):'Bật phụ đề cuộc họp, kiểm tra vùng caption rồi bắt đầu.');
  $('metrics').textContent=`${session?.count||0} caption · ${session?.images||0} ảnh`;
  $('storage').textContent=session?.exportError?'Lỗi xuất file · bản dự phòng còn nguyên':session?.pendingExports?`${session.pendingExports} file đang chờ xuất · đã dự phòng`:session?.count?'Đã xuất ra thư mục tải xuống':'Lưu tự động trong thư mục tải xuống';
  $('path').textContent=session?.folder||'MeetScribe / ngày / tên cuộc họp';
  $('title').textContent=session?.title||document.title.replace(/^(?:Meet|Zoom)\s*[-–—]\s*/,'')||'Cuộc họp của bạn';
  $('share').setAttribute('aria-pressed',String(!!rectangle()));$('clearShare').hidden=!share;
  $('liveBadge').textContent=active?'LOCAL · LIVE':'LOCAL · PRIVATE';
  clamp();
 }
 function clamp(){if(!host)return;const r=host.getBoundingClientRect();if(r.right>innerWidth-12)host.style.left=Math.max(12,innerWidth-r.width-12)+'px';if(r.left<12)host.style.left='12px';if(r.bottom>innerHeight-12)host.style.top=Math.max(12,innerHeight-r.height-12)+'px';if(r.top<12)host.style.top='12px';}
 function applyVisualSettings(s){
  if(!host)return;
  const op=typeof s?.opacity==='number'?Math.min(100,Math.max(40,Math.round(s.opacity))):96;
  const fs=typeof s?.fontSize==='number'?Math.min(18,Math.max(12,Math.round(s.fontSize))):14;
  host.style.setProperty('--surface',`rgba(20,28,34,${(op/100).toFixed(2)})`);
  host.style.setProperty('--font-size',`${fs}px`);
  if(s?.toolbarPosition&&typeof s.toolbarPosition.x==='number'&&typeof s.toolbarPosition.y==='number'){
   host.style.left=Math.round(s.toolbarPosition.x)+'px';host.style.top=Math.round(s.toolbarPosition.y)+'px';
  } else {
   host.style.left='24px';host.style.top='100px';
  }
  if(typeof s?.collapsed==='boolean')collapsed=s.collapsed;
  clamp();
 }
 function savePosition(){
  if(!host||!chrome?.storage?.local)return;
  const r=host.getBoundingClientRect();
  const pos={x:Math.round(r.left),y:Math.round(r.top)};
  chrome.storage.local.set({meetscribe_setting_toolbarPosition:pos}).catch(()=>{});
 }
 function saveCollapsedState(val){
  if(!chrome?.storage?.local)return;
  chrome.storage.local.set({meetscribe_setting_collapsed:Boolean(val)}).catch(()=>{});
 }
 let storageListener=null;
 function mount(css){
  if(host){host.hidden=false;render();return;}
  host=document.createElement('meetscribe-toolbar');host.style.cssText='position:fixed;left:24px;top:100px;z-index:2147483645;max-width:calc(100vw - 24px);';
  root=host.attachShadow({mode:'open'});const style=document.createElement('style');style.textContent=css;root.append(style);
  const box=document.createElement('div');box.innerHTML=`
  <section id="expanded" class="panel" aria-label="MeetScribe · Bộ điều khiển ghi họp">
   <header><span class="brand">${icon('note')}<strong>MeetScribe</strong></span><span id="liveBadge" class="badge">LOCAL · PRIVATE</span><button id="collapse" class="icon" aria-label="Thu nhỏ" title="Thu nhỏ">${icon('minus')}</button></header>
   <div class="meeting"><p class="eyebrow">CUỘC HỌP HIỆN TẠI</p><h2 id="title"></h2></div>
   <div class="statusline"><span id="dot" class="dot"></span><strong id="status" role="status"></strong><time id="elapsed">00:00</time></div>
   <div class="primary"><button id="start" class="start">${icon('play')}<span id="startLabel">Bắt đầu ghi</span></button><button id="stop" class="stop" hidden>${icon('stop')}<span id="stopLabel">Dừng và lưu</span></button></div>
   <div class="tools"><button id="caption">${icon('caption')}<span>Vùng caption</span></button><button id="share" aria-pressed="false">${icon('screen')}<span>Vùng share</span></button><button id="mark">${icon('mark')}<span>Đánh dấu</span></button></div>
   <p id="message" class="hint" role="status"></p><button id="clearShare" class="textbutton" hidden>Ngừng chụp vùng share</button>
   <button id="retry" class="rescue" hidden>Thử lưu và tiếp tục</button><button id="rescue" class="rescue" hidden>${icon('download')} Cứu caption đang chờ</button>
   <div class="saved"><span id="metrics">0 caption · 0 ảnh</span><span id="storage"></span></div>
   <footer><span id="path" title="Thư mục lưu"></span><button id="settings" class="icon" aria-label="Cài đặt MeetScribe" title="Cài đặt MeetScribe">${icon('settings')}</button><button id="library" class="icon" aria-label="Thư viện phiên họp" title="Thư viện phiên họp">${icon('folder')}</button><button id="move" class="icon" aria-label="Di chuyển thanh điều khiển" title="Kéo hoặc dùng phím mũi tên để di chuyển">${icon('move')}</button></footer>
  </section><button id="compact" class="compact" aria-label="Mở rộng MeetScribe" hidden>${icon('note')}<span id="compactText">Sẵn sàng</span>${icon('arrow')}</button>`;root.append(box);document.documentElement.append(host);
  $('collapse').onclick=()=>{collapsed=true;saveCollapsedState(true);render();};$('compact').onclick=()=>{collapsed=false;saveCollapsedState(false);render();};
  $('start').onclick=()=>action(async()=>{
   if(starting||running)return;starting=true;render();
   try{caption=visible(caption)?caption:discover();if(!caption){pick('caption');throw Error('Chọn khung phụ đề, sau đó bấm Bắt đầu ghi.');}
    const result=await send('start');setSession(result.session);
   }finally{starting=false;}
  });
  $('stop').onclick=()=>action(async()=>{if(stopping)return;stopping=true;render();try{const result=await send('stop');setSession(result.session);}finally{stopping=false;}});
  $('caption').onclick=()=>pick('caption');$('share').onclick=()=>pick('share');
  $('mark').onclick=()=>action(async()=>{snapshot();await flush();const result=await send('mark');notice=result.message;});
  $('clearShare').onclick=()=>action(async()=>{share=null;await send('clear-share');if(session)session.visual='not-selected';});
  $('retry').onclick=()=>action(async()=>{await flush();if(session?.status==='recording'){running=true;bind();}notice='Đã lưu phần đang chờ và tiếp tục ghi.';});
  $('settings').onclick=()=>action(()=>send('open-settings'));
  $('library').onclick=()=>action(()=>send('open-library'));$('rescue').onclick=rescue;
  $('move').onkeydown=e=>{const movement={ArrowLeft:[-24,0],ArrowRight:[24,0],ArrowUp:[0,-24],ArrowDown:[0,24]}[e.key];if(movement){e.preventDefault();const r=host.getBoundingClientRect();host.style.left=r.x+movement[0]+'px';host.style.top=r.y+movement[1]+'px';clamp();savePosition();}};
  $('move').onpointerdown=e=>{e.preventDefault();const b=host.getBoundingClientRect(),x=e.clientX,y=e.clientY;const move=p=>{host.style.left=b.x+p.clientX-x+'px';host.style.top=b.y+p.clientY-y+'px';clamp();};const up=()=>{document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',up);savePosition();};document.addEventListener('pointermove',move);document.addEventListener('pointerup',up);};
  try{if(chrome?.storage?.local){
   const load=()=>{chrome.storage.local.get(['meetscribe_settings','meetscribe_setting_opacity','meetscribe_setting_fontSize','meetscribe_setting_toolbarPosition','meetscribe_setting_collapsed'],res=>{
    const s={opacity:res.meetscribe_setting_opacity??res.meetscribe_settings?.opacity,fontSize:res.meetscribe_setting_fontSize??res.meetscribe_settings?.fontSize,toolbarPosition:res.meetscribe_setting_toolbarPosition!==undefined?res.meetscribe_setting_toolbarPosition:res.meetscribe_settings?.toolbarPosition,collapsed:res.meetscribe_setting_collapsed??res.meetscribe_settings?.collapsed};
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
    if(buffer.length)throw Error('Cứu caption cũ đang chờ trước khi bắt đầu phiên mới.');
    setSession(msg.session,true);sequence=session.lastSequence||0;running=true;lost=false;notice='';bind();render();return {};
   }
   if(msg.type==='end'){snapshot();running=false;observer?.disconnect();picker?.();await flush();render();return {};}
   if(msg.type==='status'){setSession(msg.session);if(!['recording','stopping'].includes(session?.status)){running=false;observer?.disconnect();}render();return {};}
   throw Error('Unknown collector command');
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
 const clockTimer=setInterval(()=>{if(!root||!session?.createdAt)return;const seconds=Math.max(0,Math.floor(((session.endedAt?Date.parse(session.endedAt):Date.now())-Date.parse(session.createdAt))/1000));$('elapsed').textContent=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');},1000);
 const resize=()=>clamp();window.addEventListener('resize',resize);
 const unload=e=>{if(running||buffer.length||stopping){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',unload);
 globalThis.__meetScribe={valid:connected,dispose(){clearInterval(healthTimer);clearInterval(clockTimer);clearTimeout(flushTimer);observer?.disconnect();picker?.();host?.remove();try{chrome.runtime.onMessage.removeListener(handler);}catch{}try{if(storageListener)chrome.storage.onChanged.removeListener(storageListener);}catch{}window.removeEventListener('resize',resize);window.removeEventListener('beforeunload',unload);return buffer;}};
})();
