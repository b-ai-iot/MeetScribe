export function chooseMeetingFrame(results){
 const meeting=results.filter(r=>r.result?.hasMeeting);
 if(meeting.length)return meeting.find(r=>!r.result.isTop)?.frameId??meeting[0].frameId;
 return results.find(r=>r.frameId===0)?.frameId??0;
}
export function mapFrameRect(rect,chain){
 if(!rect||!Array.isArray(chain))return null;
 let out={...rect};
 for(const f of chain){
  if(![f.x,f.y,f.width,f.height,f.viewportWidth,f.viewportHeight].every(Number.isFinite)||f.width<=0||f.height<=0||f.viewportWidth<=0||f.viewportHeight<=0)return null;
  const x=Math.max(0,f.x+out.x*f.width),y=Math.max(0,f.y+out.y*f.height);
  const right=Math.min(f.viewportWidth,f.x+(out.x+out.w)*f.width),bottom=Math.min(f.viewportHeight,f.y+(out.y+out.h)*f.height);
  if(right<=x||bottom<=y)return null;
  out={...out,x:x/f.viewportWidth,y:y/f.viewportHeight,w:(right-x)/f.viewportWidth,h:(bottom-y)/f.viewportHeight};
 }
 return out;
}
export function mapMeetingRect(rect,{frameId=0,directChild=false,geometry}={}){
 if(frameId===0)return rect;
 if(!directChild)return null;
 return mapFrameRect(rect,geometry?[geometry]:null);
}
export function sendSessionMessage(api,session,type,data={}){
 return api.tabs.sendMessage(session.tabId,{scope:'meetscribe',target:'content',type,...data},{frameId:session.frameId??0});
}
