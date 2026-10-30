import {test} from 'node:test';import assert from 'node:assert/strict';
import {meetingPlatform,isSupportedMeeting} from '../extension/model.mjs';
import {chooseMeetingFrame,mapFrameRect} from '../extension/frames.mjs';
test('Zoom web is allowed across official hosts, lookalikes and unrelated services are rejected',()=>{
 for(const u of ['https://app.zoom.us/wc/123/join','https://us02web.zoom.us/wc/join/123','https://company.zoom.com/wc/123/start','https://zoom.us/j/123']){assert.equal(meetingPlatform(u),'zoom');assert.equal(isSupportedMeeting(u),true);}
 for(const u of ['https://app.zoom.us.evil.test/wc/123','https://evilzoom.us/wc/123','http://app.zoom.us/wc/123','https://docs.zoom.us/notes/doc','https://zoom.us/signin'])assert.equal(isSupportedMeeting(u),false);
 assert.equal(meetingPlatform('https://meet.google.com/abc-defg-hij'),'meet');
});
test('choose actual Zoom meeting frame rather than PWA wrapper or unrelated note iframe',()=>{
 assert.equal(chooseMeetingFrame([{frameId:0,result:{isTop:true}},{frameId:4,result:{hasMeeting:true}},{frameId:9,result:{}}]),4);
 assert.equal(chooseMeetingFrame([{frameId:0,result:{isTop:true}}]),0);
});
test('translate iframe crop into whole-tab coordinates and clip to viewport',()=>{
 assert.deepEqual(mapFrameRect({x:.25,y:.1,w:.5,h:.8,key:'slide'},[{x:100,y:50,width:800,height:600,viewportWidth:1000,viewportHeight:800}]),{x:.3,y:.1375,w:.4,h:.6,key:'slide'});
 assert.equal(mapFrameRect({x:0,y:0,w:1,h:1},null),null);
});
test('nested unknown Zoom wrappers refuse image mapping rather than crop the wrong region',async()=>{
 const {mapMeetingRect}=await import('../extension/frames.mjs');
 assert.equal(mapMeetingRect({x:0,y:0,w:1,h:1},{frameId:5,directChild:false,geometry:{x:0,y:0,width:800,height:600,viewportWidth:1000,viewportHeight:800}}),null);
});
test('final status routes to persisted Zoom frame even after the session is closed',async()=>{
 const {sendSessionMessage}=await import('../extension/frames.mjs');let routed;
 const api={tabs:{sendMessage:async(tab,message,options)=>{routed={tab,message,options};return {ok:true};}}};
 await sendSessionMessage(api,{tabId:42,frameId:7,status:'completed'},'status',{session:{status:'completed'}});
 assert.equal(routed.tab,42);assert.deepEqual(routed.options,{frameId:7});assert.equal(routed.message.type,'status');
});
