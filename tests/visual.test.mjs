import test from 'node:test';
import assert from 'node:assert/strict';
import { compare, decide, ended } from '../extension/visual.mjs';
const frame = (rgb=255) => ({width:320,height:180,data:new Uint8ClampedArray(320*180*4).fill(rgb)});
const a = frame();
const entry = {id:'screen-001.png', time:0, frame:a, bytes:100};
const opts = (extra={}) => ({now:30000,saved:[entry],usedBytes:100,...extra});
test('first verified share saves; absent share does not',()=>{
 assert.equal(decide(a,{now:0,saved:[],share:false}).status,'unavailable');
 assert.equal(decide(a,{now:0,saved:[],share:true}).status,'save');
});
test('identical and cursor-only duplicates reuse image',()=>{
 assert.equal(decide(a,opts()).status,'duplicate');
 const b=frame(); b.data.fill(0,2000,2016);
 assert.equal(decide(b,opts()).status,'duplicate');
});
test('color changed slide is meaningful even when hash stays same',()=>{
 assert.equal(decide(frame(0),opts()).status,'save');
 assert.equal(compare(a,frame(0)).changedRatio,1);
});
test('local region changes survive full-frame dilution',()=>{
 const b=frame();
 for(let y=0;y<22;y++) for(let x=0;x<40;x++) {
  let i=(y*320+x)*4; b.data[i]=b.data[i+1]=b.data[i+2]=0;
 }
 assert.equal(decide(b,opts()).status,'save');
});
test('small changes require review instead of claiming semantic knowledge',()=>{
 const b=frame();
 for(let i=0;i<500;i++) b.data[i*4]=0;
 assert.ok(['duplicate','review'].includes(decide(b,opts()).status));
 assert.equal(decide(b,opts({important:true})).status,'save');
});
test('hard caps apply even to important changes',()=>{
 assert.equal(decide(frame(0),opts({maxImages:1,important:true})).status,'limit');
 assert.equal(decide(frame(0),opts({maxPerHour:1})).status,'limit');
 assert.equal(decide(frame(0),opts({usedBytes:100,maxBytes:100})).status,'limit');
});
test('animation cadence is bounded',()=>{
 assert.equal(decide(frame(0),opts({now:5000})).status,'cooldown');
});
test('old slide reuse retains reference',()=>{
 assert.equal(decide(a,opts({saved:[entry,{...entry,id:'screen-002.png',frame:frame(0),time:15000}]})).reference,'screen-001.png');
});
test('silence and a missing leave button do not imply end',()=>{
 assert.equal(ended({statusText:'',hasLeave:false}),false);
 assert.equal(ended({statusText:'This meeting has ended',hasLeave:false}),true);
 assert.equal(ended({statusText:'This meeting has ended',hasLeave:true}),false);
 assert.equal(ended({statusText:'We will discuss how this meeting has ended',hasLeave:false}),false);
});
const {PersistentChange}=await import('../extension/visual.mjs');
test('small stable changes require a second sample; moving content resets',()=>{
 const gate=new PersistentChange();
 assert.equal(gate.observe(a,0),false);
 assert.equal(gate.observe(a,14000),false);
 assert.equal(gate.observe(a,15000),true);
 assert.equal(gate.observe(frame(0),30000),false);
 gate.reset();assert.equal(gate.observe(a,45000),false);
});
