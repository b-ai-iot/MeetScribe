import {chooseMeetingFrame} from './frames.mjs';
export async function installToolbar(api,tabId){
 const frames=await api.scripting.executeScript({target:{tabId,allFrames:true},func:()=>({isTop:window===window.top,hasMeeting:!!document.querySelector('#meeting-app,#wc-content,.meeting-app'),url:location.origin+location.pathname})});
 const frameId=chooseMeetingFrame(frames);
 await api.scripting.executeScript({target:{tabId,frameIds:[frameId]},files:['content.js']});
 const css=await (await fetch(api.runtime.getURL('overlay.css'))).text();
 await api.tabs.sendMessage(tabId,{scope:'meetscribe',target:'content',type:'mount',css},{frameId});return frameId;
}
