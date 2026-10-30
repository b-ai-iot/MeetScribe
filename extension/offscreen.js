import {t,messageError,errorMessage,loadLanguage,watchLanguage,getMessages} from './i18n.mjs';
import {decide,PersistentChange} from './visual.mjs';
const messageCodes=new Set(Object.keys(getMessages().vi));
const knownErrorCode=code=>typeof code==='string'&&messageCodes.has(code)?code:null;
const languageReady=loadLanguage();
watchLanguage(()=>{});
const video=document.getElementById('source');let active=null,starting=false,pendingStart=null;const histories=new Map();
async function send(type,data={}){const ack=await chrome.runtime.sendMessage({scope:'meetscribe',target:'worker',type,...data});if(!ack?.ok)throw (knownErrorCode(ack?.errorCode)?messageError(ack.errorCode,ack.errorParams||{}):ack?.error||ack?.message?Error(errorMessage(ack)):messageError('system.workerAck'));return ack;}
async function sample(s,important=false){
 if(s!==active||s.stopping||s.busy)return {saved:false,message:t('system.imageBusy')};
 s.busy=true;
 try{
  const now=Date.now(),info=await send('visual-inspect',{sid:s.sid});
  if(!info.shareAvailable||!info.rect||video.readyState<2){s.persistent.reset();return {saved:false,message:t('system.markSelectShare')};}
  if(s.lastSample&&now-s.lastSample>45000)await send('visual-event',{sid:s.sid,token:s.token,eventType:'sampling-gap',data:{from:new Date(s.lastSample).toISOString(),to:new Date(now).toISOString()}});
  s.lastSample=now;
  const r=info.rect;
  if(![r.x,r.y,r.w,r.h].every(Number.isFinite)||r.x<0||r.y<0||r.w<=0||r.h<=0||r.x+r.w>1.001||r.y+r.h>1.001)throw messageError('system.invalidRectangle');
  const x=Math.round(r.x*video.videoWidth),y=Math.round(r.y*video.videoHeight),w=Math.min(Math.round(r.w*video.videoWidth),video.videoWidth-x),h=Math.min(Math.round(r.h*video.videoHeight),video.videoHeight-y);
  if(w<8||h<8)return {saved:false,message:t('system.shareSmall')};
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;canvas.getContext('2d').drawImage(video,x,y,w,h,0,0,w,h);
  const thumb=document.createElement('canvas');thumb.width=320;thumb.height=180;thumb.getContext('2d').drawImage(canvas,0,0,320,180);
  const frame={width:320,height:180,data:thumb.getContext('2d').getImageData(0,0,320,180).data,key:r.key};
  let result=decide(frame,{now,saved:s.saved,usedBytes:s.bytes,important});let persistentEdit=false;
  if(!important&&['review','duplicate'].includes(result.status)&&result.metrics?.changedRatio>=.0002&&!result.metrics.exact){
   if(s.persistent.observe(frame,now)&&now-(s.saved.at(-1)?.time||0)>=30000){result=decide(frame,{now,saved:s.saved,usedBytes:s.bytes,important:true});persistentEdit=true;}
  }else s.persistent.reset();
  const evidence={capturedAt:new Date(now).toISOString(),rect:r,captionAt:info.captionAt,captionContext:info.captionContext,importantBy:important?'user-mark':persistentEdit?'persistent-local-change':null};
  if(result.status!=='save'){
   // Log reuse and limits, not every unchanged sample.
   if(result.reference!==s.lastReference||important||result.status==='limit')await send('visual-event',{sid:s.sid,token:s.token,eventType:'screen-'+result.status,data:{...evidence,reference:result.reference,metrics:result.metrics}});
   s.lastReference=result.reference;
   return {saved:false,message:result.reference?t('system.imageReused'):t('system.imageNotReady')};
  }
  const data=canvas.toDataURL('image/png');const bytes=Math.floor((data.length-data.indexOf(',')-1)*3/4);
  if(s.bytes+bytes>104857600)return {saved:false,message:t('system.imageLimit')};
  const name=`screen-${String(s.saved.length+1).padStart(3,'0')}-${now}.png`;
  await send('visual-frame',{sid:s.sid,token:s.token,name,data,bytes,event:{...evidence,image:'images/'+name,bytes,metrics:result.metrics}});
  s.saved.push({id:name,time:now,frame,bytes});s.bytes+=bytes;s.persistent.reset();s.lastReference=name;
  return {saved:true,message:t('system.imageSaved')};
 }finally{s.busy=false;}
}
async function stop(sid,final=false){if(pendingStart?.sid===sid)pendingStart.cancelled=true;if(final)histories.delete(sid);if(!active||active.sid!==sid)return;const s=active;s.stopping=true;clearInterval(s.timer);while(s.busy)await new Promise(r=>setTimeout(r,25));s.stream.getTracks().forEach(t=>t.stop());video.srcObject=null;active=null;}
chrome.runtime.onMessage.addListener((msg,sender,reply)=>{
 if(sender.id!==chrome.runtime.id||msg?.scope!=='meetscribe'||msg.target!=='offscreen')return;
 (async()=>{
  await languageReady;
  if(msg.type==='start'){
   if(starting)throw messageError('system.visualStarting');
   if(active){if(active.sid===msg.sid)return {};throw messageError('system.visualInUse');}
   starting=true;let stream;const pending={sid:msg.sid,cancelled:false};pendingStart=pending;
   try{
    stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{mandatory:{chromeMediaSource:'tab',chromeMediaSourceId:msg.streamId}}});
    if(pending.cancelled)throw messageError('system.visualStartCancelled');
    video.srcObject=stream;await video.play();
    if(pending.cancelled)throw messageError('system.visualStartCancelled');
    const history=histories.get(msg.sid)||{saved:[],bytes:0};
    const s={sid:msg.sid,token:msg.token,stream,saved:history.saved,bytes:history.bytes,persistent:new PersistentChange(),stopping:false,busy:false};active=s;histories.set(msg.sid,s);
    stream.getVideoTracks()[0].addEventListener('ended',()=>{if(active===s&&!s.stopping){clearInterval(s.timer);active=null;send('visual-lost',{sid:s.sid,token:s.token,error:t('system.visualEnded'),errorCode:'system.visualEnded',errorParams:{}}).catch(()=>{});}});
    s.timer=setInterval(()=>sample(s).catch(async e=>{await stop(s.sid);send('visual-lost',{sid:s.sid,token:s.token,error:errorMessage(e),errorCode:knownErrorCode(e.code),errorParams:knownErrorCode(e.code)?e.params||{}:null}).catch(()=>{});}),15000);
    await sample(s);return {};
   }catch(e){stream?.getTracks().forEach(t=>t.stop());video.srcObject=null;active=null;throw e;}finally{starting=false;if(pendingStart===pending)pendingStart=null;}
  }
  if(msg.type==='stop'){await stop(msg.sid,msg.final);return {};}
  if(msg.type==='mark')return active?.sid===msg.sid?sample(active,true):{saved:false,message:t('system.markVisualOff')};
  throw messageError('system.unknownVisualCommand');
 })().then(data=>reply({ok:true,...data})).catch(e=>reply({ok:false,error:errorMessage(e),errorCode:knownErrorCode(e.code),errorParams:knownErrorCode(e.code)?e.params||{}:null}));return true;
});
