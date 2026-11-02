import {chooseMeetingFrame} from './frames.mjs';
export async function installToolbar(api,tabId){
 const frames=await api.scripting.executeScript({target:{tabId,allFrames:true},func:()=>({isTop:window===window.top,hasMeeting:!!document.querySelector('#meeting-app,#wc-content,.meeting-app'),url:location.origin+location.pathname})});
 const frameId=chooseMeetingFrame(frames),target={tabId,frameIds:[frameId]};
 // Load the engine before catalogs; verify initialization before retaining content callbacks.
 await api.scripting.executeScript({target,files:['i18n.js']});
 await api.scripting.executeScript({target,files:['i18n-ui.js','i18n-toolbar.js','i18n-system.js']});
 const [check]=await api.scripting.executeScript({target,func:()=>{
  const i18n=globalThis.__meetScribeI18n;
  if(!['t','applyTranslations','setLanguage','getLanguage','errorMessage','translateMessage','getMessages'].every(key=>typeof i18n?.[key]==='function'))return false;
  const messages=i18n.getMessages();
  return ['vi','en'].every(lang=>['toolbar.start','ui.settingsTitle','system.invalidSender'].every(key=>typeof messages[lang]?.[key]==='string'));
 }});
 if(!check?.result)throw Error('MeetScribe translation assets did not initialize. Reload the extension and meeting tab. / Không nạp được bộ ngôn ngữ. Hãy tải lại tiện ích và tab họp.');
 await api.scripting.executeScript({target,files:['captions.js','content.js']});
 // Original v1.3.0 instances have no readiness marker. Detect them before mounting:
 // their error renderer can throw again and leave the mount reply channel unanswered.
 const [legacy]=await api.scripting.executeScript({target,func:()=>!!globalThis.__meetScribe&&globalThis.__meetScribe.bootstrapReady!==true});
 if(legacy?.result)throw Error('MeetScribe: an older toolbar is still loaded. Stop and save any active recording, then reload the meeting tab. / Thanh điều khiển cũ vẫn đang mở. Hãy dừng và lưu phiên đang ghi, rồi tải lại tab họp.');
 const css=await (await fetch(api.runtime.getURL('overlay.css'))).text();
 const reply=await api.tabs.sendMessage(tabId,{scope:'meetscribe',target:'content',type:'mount',css},{frameId});
 if(!reply?.ok)throw Error(reply?.error||'MeetScribe toolbar mount was not acknowledged. / Chưa nhận xác nhận mở thanh điều khiển.');
 return frameId;
}
