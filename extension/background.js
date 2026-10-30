import {VERSION,isSupportedMeeting,meetingPlatform,sessionFolder,validEntries} from './model.mjs';
import * as store from './store.mjs';
import {exportFile} from './downloads.mjs';
import {getSettings} from './settings.mjs';
import {exportFileToDirectory,getStoredDirectoryInfo,writeToDirectoryHandle} from './destination.mjs';
import {buildSessionArchive} from './archive.mjs';
import {ended} from './visual.mjs';
import {mapMeetingRect,sendSessionMessage} from './frames.mjs';
import {installToolbar} from './install.mjs';
import {CommandQueue} from './commands.mjs';

function bytesToBase64(bytes){
 let binary='';const chunk=0x8000;
 for(let i=0;i<bytes.length;i+=chunk){binary+=String.fromCharCode.apply(null,bytes.subarray(i,i+chunk));}
 return btoa(binary);
}

async function waitForDownload(id,timeoutMs=45000){
 return new Promise((resolve,reject)=>{
  let done=false;
  const timer=setTimeout(()=>{if(done)return;done=true;try{chrome.downloads.onChanged.removeListener(listener);}catch{}reject(Error('Hết thời gian chờ tải file ZIP.'));},timeoutMs);
  const finish=(err)=>{if(done)return;done=true;clearTimeout(timer);try{chrome.downloads.onChanged.removeListener(listener);}catch{}if(err)reject(err);else resolve(id);};
  const listener=delta=>{
   if(delta.id===id){
    if(delta.state?.current==='complete')finish(null);
    else if(delta.state?.current==='interrupted'||delta.error)finish(Error(`Tải file ZIP bị gián đoạn: ${delta.error?.current||'lỗi mạng'}`));
   }
  };
  chrome.downloads.onChanged.addListener(listener);
  chrome.downloads.search({id},items=>{
   if(items?.[0]&&!done){
    if(items[0].state==='complete')finish(null);
    else if(items[0].state==='interrupted')finish(Error(`Tải file ZIP bị gián đoạn: ${items[0].error}`));
   }
  });
 });
}
const commands=new CommandQueue(),exportLocks=new Map(),endStates=new Map();let offscreenCreating;const frameRoutes=new Map();
const time=()=>new Date().toISOString();
const content=async(tabId,type,data={})=>{
 const frameId=frameRoutes.get(tabId)??(await active(tabId))?.frameId??0;
 return chrome.tabs.sendMessage(tabId,{scope:'meetscribe',target:'content',type,...data},{frameId});
};
async function prepare(tabId){const frameId=await installToolbar(chrome,tabId);frameRoutes.set(tabId,frameId);return frameId;}
async function visualInfo(s){
 const info=await sendSessionMessage(chrome,s,'inspect');
 if((s.frameId??0)===0||!info.rect)return info;
 const [measurement]=await chrome.scripting.executeScript({target:{tabId:s.tabId,frameIds:[0]},args:[info.sourcePath],func:(sourcePath)=>{
  const frames=[...document.querySelectorAll('iframe')].filter(f=>{try{const u=new URL(f.src);return /(^|\.)zoom\.(us|com)$/.test(u.hostname)&&u.pathname.startsWith('/wc/')&&u.origin+u.pathname===sourcePath;}catch{return false;}});
  const frame=frames.length===1?frames[0]:null;if(!frame)return null;
  const r=frame.getBoundingClientRect();const sx=r.width/(frame.offsetWidth||r.width),sy=r.height/(frame.offsetHeight||r.height);
  return {x:r.left+frame.clientLeft*sx,y:r.top+frame.clientTop*sy,width:frame.clientWidth*sx,height:frame.clientHeight*sy,viewportWidth:innerWidth,viewportHeight:innerHeight};
 }});
 const rect=mapMeetingRect(info.rect,{frameId:s.frameId,directChild:info.directChild,geometry:measurement?.result});
 if(!rect)throw Error('Chưa xác định được vị trí vùng share trong khung Zoom; caption vẫn tiếp tục.');
 return {...info,rect,shareAvailable:!!rect};
} 
const off=(type,data={})=>chrome.runtime.sendMessage({scope:'meetscribe',target:'offscreen',type,...data});
async function offscreen(){
 if((await chrome.runtime.getContexts({contextTypes:['OFFSCREEN_DOCUMENT']})).length)return;
 if(!offscreenCreating)offscreenCreating=chrome.offscreen.createDocument({url:'offscreen.html',reasons:['USER_MEDIA'],justification:'Crop confirmed shared content into selected static screenshots; no audio or video files.'}).finally(()=>offscreenCreating=null);
 await offscreenCreating;
}
async function event(id,type,data={}){return store.writeFile(id,`events/${Date.now()}-${crypto.randomUUID().slice(0,8)}.json`,JSON.stringify({timestamp:time(),type,...data},null,2));}
async function active(tabId){return (await store.listSessions()).find(s=>s.tabId===tabId&&['recording','stopping'].includes(s.status));}
async function publicState(s){if(!s)return null;const {captionTail,...rest}=s;return rest;}
async function publish(s){try{await sendSessionMessage(chrome,s,'status',{session:await publicState(s)});}catch{}}
export async function exportSession(id){
 if(exportLocks.has(id))return exportLocks.get(id);
 const job=(async()=>{
  try{
   const currentSession=await store.getSession(id);
   const isCustom=currentSession?.destination==='customDirectory';
   let dirHandle=null;
   if(isCustom){
    dirHandle=await store.getDirectoryHandle(currentSession.destinationId);
    if(!dirHandle){
     throw Error('Chưa tìm thấy quyền truy cập thư mục: '+(currentSession.destinationName||'thư mục cục bộ')+'. Mở Cài đặt để cấp lại quyền.');
    }
   }
   while(true){
   const files=await store.pendingFiles(id);if(!files.length)break;
   // Completion marker is exported after all caption/image/event files.
   files.sort((a,b)=>(a.id===id+'/finished.json'?1:0)-(b.id===id+'/finished.json'?1:0));
   for(const file of files){
    if(isCustom)await exportFileToDirectory(file,dirHandle);
    else await exportFile(file,chrome.downloads);
   }
   }
   const s=await store.getSession(id);await publish(s);return s;
  }catch(e){const s=await store.patchSession(id,{exportError:e.message});await publish(s);throw e;}
 })().finally(()=>exportLocks.delete(id));exportLocks.set(id,job);return job;
}
const scheduleExport=id=>exportSession(id).catch(()=>{});
async function start(tab){return commands.run(tab.id,'start',async()=>{
 const current=await active(tab.id);if(current)return current;
 const check=await content(tab.id,'inspect');if(!check?.captionAvailable)throw Error('Bật phụ đề trong cuộc họp rồi chọn vùng caption trước.');
 const id=crypto.randomUUID(),title=(tab.title||'Cuộc họp').replace(/^(?:Meet|Zoom)\s*[-–—]\s*/,'').trim();
 const currentSettings=await getSettings();
 const isCustom=currentSettings.destination==='customDirectory';
 const activeDestId=isCustom?await store.getActiveDirectoryHandleId():null;
 if(isCustom&&!activeDestId){
  throw Error('Chưa chọn thư mục lưu cục bộ. Hãy mở Cài đặt để chọn thư mục trước khi bắt đầu.');
 }
 const dirInfo=isCustom?await getStoredDirectoryInfo(activeDestId):null;
 const s=await store.createSession({id,tabId:tab.id,frameId:frameRoutes.get(tab.id)??0,platform:meetingPlatform(tab.url),url:tab.url,title,folder:sessionFolder(title,new Date(),id.slice(0,8)),createdAt:time(),status:'recording',count:0,lastSequence:0,version:VERSION,noModelCalls:true,audioRecorded:false,videoRecorded:false,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,visual:'not-selected',destination:isCustom?'customDirectory':'downloads',destinationId:activeDestId,destinationName:isCustom?(dirInfo?.name||'Thư mục cục bộ'):'Downloads'});
 try{const answer=await sendSessionMessage(chrome,s,'begin',{session:await publicState(s)});if(!answer?.ok)throw Error(answer?.error||'Không thể khởi động bộ thu.');}
 catch(e){await store.patchSession(id,{status:'interrupted',error:e.message});throw e;}
 await event(id,'started');scheduleExport(id);return s;
 });}
async function stop(s,reason='user-stop',sourceClosed=false){return commands.run(s.tabId,'stop',async()=>{
 s=await store.getSession(s.id);if(!['recording','stopping'].includes(s.status))return s;
 await store.patchSession(s.id,{status:'stopping'});
 let interruption=sourceClosed;
 if(!sourceClosed){
  try{const ack=await sendSessionMessage(chrome,s,'end');if(!ack?.ok)throw Error(ack?.error||'Chưa lưu hết caption đang chờ.');}
  catch(e){interruption=true;await event(s.id,'caption-drain-failed',{error:e.message});}
 }
 try{await off('stop',{sid:s.id,final:true});}catch{}
 s=await store.finalizeSession(s.id,{interrupted:interruption,reason});
 endStates.delete(s.id);
 await publish(s);
 if(reason==='zip-stop'){
  try{await exportSession(s.id);}catch(e){}
 }else{
  await exportSession(s.id);
 }
 return store.getSession(s.id);
 });}
async function visualStart(s){
 if(s.visual==='ready')return;
 const token=crypto.randomUUID();
 await store.patchSession(s.id,{visualToken:token,visual:'starting'});
 const check=async()=>{const current=await store.getSession(s.id);if(current.status!=='recording'||current.visualToken!==token)throw Error('Đã hủy khởi động ảnh share.');};
 try{
  await offscreen();await check();
  const streamId=await chrome.tabCapture.getMediaStreamId({targetTabId:s.tabId});await check();
  const ack=await off('start',{sid:s.id,tabId:s.tabId,streamId,token});
  if(!ack?.ok)throw Error(ack?.error||'Không mở được luồng ảnh.');
  await check();
  const updated=await store.setVisualState(s.id,token,{visual:'ready',visualError:null});
  if(updated.visualToken!==token||updated.status!=='recording'){await off('stop',{sid:s.id});return;}
  await event(s.id,'visual-started');
 }catch(e){
  const updated=await store.setVisualState(s.id,token,{visual:'unavailable',visualError:e.message});
  if(updated.status!=='recording'||updated.visualToken!==token){await off('stop',{sid:s.id}).catch(()=>{});return;}
  await event(s.id,'visual-unavailable',{error:e.message});throw Error('Caption vẫn lưu. Chưa lấy được ảnh: '+e.message);
 }
}
chrome.action.onClicked.addListener(tab=>{
 (async()=>{
  if(!isSupportedMeeting(tab.url)){await chrome.tabs.create({url:chrome.runtime.getURL('library.html')});return;}
  await prepare(tab.id);
  const s=await active(tab.id);
  if(s){const check=await content(tab.id,'inspect');if(check?.sid!==s.id){await stop(s,'collector-replaced',true);}else await publish(s);}
 })().catch(e=>{chrome.action.setBadgeText({tabId:tab.id,text:'!'}).catch(()=>{});console.warn('MeetScribe action:',e.message);});
});
async function receive(msg,sender){
 if(sender.id!==chrome.runtime.id)throw Error('Invalid sender');
 const lib=sender.url===chrome.runtime.getURL('library.html');
 const visual=sender.url===chrome.runtime.getURL('offscreen.html');
 const tab=sender.tab;
 if(lib){
  if(msg.type==='list')return {sessions:await store.listSessions()};
  const s=await store.getSession(msg.sid);if(!s)throw Error('Session not found');
  if(msg.type==='retry'){await exportSession(s.id);return {session:await publicState(await store.getSession(s.id))};}
  if(msg.type==='show-folder'){if(s.lastDownloadId)await chrome.downloads.show(s.lastDownloadId);else await chrome.downloads.showDefaultFolder();return {};}
  if(msg.type==='stop'){return {session:await publicState(await stop(s,'library-stop'))};}
  if(msg.type==='rename'){
   if(!msg.title||typeof msg.title!=='string'||!msg.title.trim())throw Error('Tiêu đề không hợp lệ');
   const updated=await store.renameSession(s.id,msg.title.trim());
   return {session:await publicState(updated)};
  }
  if(msg.type==='delete'){
   if(['recording','stopping'].includes(s.status))throw Error('Không thể xóa phiên đang ghi hoặc đang lưu.');
   await store.deleteSession(s.id);
   return {deleted:true,sid:s.id};
  }
  if(msg.type==='session-details'){
   const files=await store.allSessionFiles(s.id);
   const bytes=await store.sessionBackupBytes(s.id,files);
   const images=files.filter(f=>f.isDataURL&&typeof f.data==='string'&&f.data.startsWith('data:image/')).slice(0,6);
   return {session:s,backupBytes:bytes,images:images.map(img=>({name:img.name.split('/').pop(),data:img.data})),captionTail:s.captionTail||null};
  }
  if(msg.type==='export-zip'){
   let targetSession=s;
   if(['recording','stopping'].includes(targetSession.status)){
    if(msg.stopFirst){targetSession=await stop(targetSession,'zip-stop');}
    else throw Error('Phiên đang ghi. Hãy dừng phiên trước khi xuất ZIP.');
   }
   const maxBytes=500*1024*1024;
   const files=await store.readSessionFilesBounded(targetSession.id,maxBytes);
   const zipBytes=await buildSessionArchive(targetSession,files,{maxBytes});
   const safeTitle=(targetSession.title||'Cuoc-hop').replace(/[\\/:*?"<>|]/g,'-').slice(0,50);
   const zipName=`MeetScribe-${targetSession.createdAt.slice(0,10)}-${safeTitle}-${targetSession.id.slice(0,8)}.zip`;
   if(msg.destination==='customDirectory'||(msg.destination!=='downloads'&&targetSession.destination==='customDirectory')){
    const dirHandle=await store.getDirectoryHandle(targetSession.destinationId);
    if(!dirHandle)throw Error('Không tìm thấy quyền thư mục lưu cục bộ đã chọn. Cấp lại quyền trong Cài đặt.');
    const perm=await dirHandle.queryPermission?.({mode:'readwrite'});
    if(perm!=='granted')throw Error('Thư mục lưu cục bộ chưa được cấp quyền ghi. Cấp lại quyền trong Cài đặt.');
    const fh=await dirHandle.getFileHandle(zipName,{create:true});
    await writeToDirectoryHandle(fh,zipBytes);
    return {savedTo:'directory',filename:zipName};
   }
   const b64=bytesToBase64(zipBytes);
   const dataUrl=`data:application/zip;base64,${b64}`;
   const saveAs=msg.saveAs!==undefined?Boolean(msg.saveAs):false;
   const downloadId=await chrome.downloads.download({url:dataUrl,filename:zipName,saveAs,conflictAction:'uniquify'});
   await waitForDownload(downloadId);
   return {savedTo:'downloads',downloadId,filename:zipName};
  }
  throw Error('Unsupported library command');
 }
 if(visual){
  const s=await store.getSession(msg.sid);if(!s||!['recording','stopping'].includes(s.status)||msg.token&&msg.token!==s.visualToken)throw Error('Visual session not active');
  if(msg.type==='visual-inspect'){const info=await visualInfo(s);return {...info,captionContext:s.captionTail||'',captionAt:s.lastCaptionAt||null};}
  if(msg.type==='visual-frame'){
   if(typeof msg.data!=='string'||!msg.data.startsWith('data:image/png;base64,')||msg.data.length>30000000||!Number.isFinite(msg.bytes)||msg.bytes<1)throw Error('Invalid image');
   const stats=await store.saveImage(s.id,{name:msg.name,data:msg.data,bytes:msg.bytes,event:msg.event});
   await publish(await store.getSession(s.id));scheduleExport(s.id);return stats;
  }
  if(msg.type==='visual-event'){await event(s.id,msg.eventType,msg.data||{});return {};}
  if(msg.type==='visual-lost'){await store.patchSession(s.id,{visual:'unavailable',visualError:msg.error});await event(s.id,'visual-unavailable',{error:msg.error});await publish(await store.getSession(s.id));return {};}
  throw Error('Unsupported visual command');
 }
 if(!tab||!isSupportedMeeting(sender.url)||!isSupportedMeeting(tab.url))throw Error('Only authorized Meet or Zoom web tabs may collect');
 if(msg.type==='open-library'){await chrome.tabs.create({url:chrome.runtime.getURL('library.html')});return {};}
 if(msg.type==='open-settings'){if(chrome.runtime.openOptionsPage)await chrome.runtime.openOptionsPage();else await chrome.tabs.create({url:chrome.runtime.getURL('settings.html')});return {};}
 if(msg.type==='start'){const current=await active(tab.id);if(current&&(sender.frameId??0)!==(current.frameId??0))throw Error('Meeting frame mismatch');frameRoutes.set(tab.id,sender.frameId??0);return {session:await publicState(await start(tab))};}
 let s=msg.sid?await store.getSession(msg.sid):await active(tab.id);
 if(s&&(s.tabId!==tab.id||s.url!==tab.url||(s.frameId??0)!==(sender.frameId??0)))throw Error('Session source mismatch');
 if(msg.type==='status')return {session:await publicState(s)};
 if(!s)throw Error('Chưa có phiên đang ghi.');
 if(msg.type==='caption'){
  if(!validEntries(msg.entries))throw Error('Invalid captions');
  const result=await store.appendCaptions(s.id,msg.entries);scheduleExport(s.id);return result;
 }
 if(msg.type==='stop')return {session:await publicState(await stop(s))};
 if(!['recording','stopping'].includes(s.status))throw Error('Phiên đã đóng.');
 if(msg.type==='visual-start'){await visualStart(s);return {session:await publicState(await store.getSession(s.id))};}
 if(msg.type==='clear-share'){await store.patchSession(s.id,{visual:'not-selected',visualToken:crypto.randomUUID()});await off('stop',{sid:s.id}).catch(()=>{});await event(s.id,'share-cleared');return {};}
 if(msg.type==='mark'){
  await event(s.id,'user-mark',{captionAt:s.lastCaptionAt,captionContext:s.captionTail});
  let result;try{result=await off('mark',{sid:s.id});}catch{}
  return {saved:!!result?.saved,message:result?.message||'Đã lưu mốc caption; chưa có ảnh share khả dụng.'};
 }
 if(msg.type==='health'){
  const health=JSON.stringify([msg.captionAvailable,msg.shareAvailable]);
  if(health!==s.health){await store.patchSession(s.id,{health});await event(s.id,'source-health',{captionAvailable:msg.captionAvailable,shareAvailable:msg.shareAvailable});}
  const text=(msg.texts||[]).find(t=>ended({statusText:t,hasLeave:msg.hasLeave}));
  const previous=endStates.get(s.id);const count=text?(previous?.text===text?previous.count+1:1):0;
  endStates.set(s.id,{text,count});
  if(count>=2)setTimeout(()=>stop(s,'explicit-end-screen').catch(()=>{}),0);
  return {session:await publicState(await store.getSession(s.id))};
 }
 throw Error('Unknown command');
}
chrome.runtime.onMessage.addListener((msg,sender,reply)=>{
 if(msg?.scope!=='meetscribe'||msg.target!=='worker')return;
 receive(msg,sender).then(data=>reply({ok:true,...data})).catch(e=>reply({ok:false,error:e.message}));return true;
});
chrome.tabs.onRemoved.addListener(id=>{frameRoutes.delete(id);active(id).then(s=>s&&stop(s,'meeting-tab-closed',true)).catch(()=>{});});
chrome.tabs.onUpdated.addListener((id,change)=>{
 if(change.status==='loading')active(id).then(s=>s&&stop(s,'meeting-page-navigation',true)).catch(()=>{});
});
chrome.runtime.onInstalled.addListener(()=>chrome.alarms.create('export-retry',{periodInMinutes:1}));
chrome.runtime.onStartup.addListener(()=>{
 chrome.alarms.create('export-retry',{periodInMinutes:1});
 store.listSessions().then(async sessions=>{for(const s of sessions){if(['recording','stopping'].includes(s.status))await stop(s,'browser-restarted',true);else if(s.pendingExports)scheduleExport(s.id);}}).catch(()=>{});
});
chrome.alarms.onAlarm.addListener(async alarm=>{if(alarm.name!=='export-retry')return;for(const s of await store.listSessions())if(s.pendingExports)scheduleExport(s.id);});
