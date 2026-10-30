// Pure local selection logic. No network, browser permissions, or model calls.
function hash(frame) {
 const sums=new Float64Array(72), counts=new Uint32Array(72);
 for(let y=0;y<frame.height;y++) for(let x=0;x<frame.width;x++) {
  const i=(y*frame.width+x)*4, cell=Math.floor(y*8/frame.height)*9+Math.floor(x*9/frame.width);
  sums[cell]+=.299*frame.data[i]+.587*frame.data[i+1]+.114*frame.data[i+2]; counts[cell]++;
 }
 let out=0n;
 for(let y=0;y<8;y++) for(let x=0;x<8;x++) {
  const i=y*9+x;
  out=(out<<1n)|BigInt(sums[i]/counts[i]>sums[i+1]/counts[i+1]);
 }
 return out;
}
export function compare(a,b) {
 if(a.width!==b.width || a.height!==b.height) throw Error('Frame sizes differ');
 const tiles=new Uint32Array(64), totals=new Uint32Array(64);
 let changed=0, exact=true;
 for(let y=0;y<a.height;y++) for(let x=0;x<a.width;x++) {
  const i=(y*a.width+x)*4, tile=Math.floor(y*8/a.height)*8+Math.floor(x*8/a.width);
  const delta=Math.max(...[0,1,2].map(c=>Math.abs(a.data[i+c]-b.data[i+c])));
  if(delta) exact=false;
  totals[tile]++; if(delta>=24){changed++;tiles[tile]++;}
 }
 const xor=hash(a)^hash(b);
 return {hashDistance:[...xor.toString(2)].filter(c=>c==='1').length,
  changedRatio:changed/(a.width*a.height),
  maxTileRatio:Math.max(...Array.from(tiles,(n,i)=>n/totals[i])),exact};
}
export function decide(frame,{now,saved=[],share=true,important=false,usedBytes=0,
 maxImages=120,maxPerHour=30,maxBytes=100*1024*1024}={}) {
 if(!share) return {status:'unavailable'};
 let latest;
 for(let i=saved.length-1;i>=0;i--) {
  const old=saved[i]; if(old.frame.key!==frame.key) continue;
  const m=compare(frame,old.frame);
  if(i===saved.length-1) latest=m;
  if(m.exact || (!important && m.hashDistance<=6 && m.changedRatio<=.01 && m.maxTileRatio<=.10))
   return {status:'duplicate',reference:old.id,metrics:m};
 }
 if(latest && !important && latest.changedRatio<.03 && latest.maxTileRatio<.25)
  return {status:'review',metrics:latest};
 if(saved.length && !important && now-saved.at(-1).time<30000) return {status:'cooldown'};
 if(saved.length>=maxImages || saved.filter(s=>now-s.time<3600000).length>=maxPerHour || usedBytes>=maxBytes)
  return {status:'limit'};
 return {status:'save',metrics:latest};
}
export function ended({statusText='',hasLeave=true}) {
 const text=statusText.normalize('NFC').trim().replace(/[.!。]+$/,'').toLowerCase();
 return !hasLeave && new Set(['you left the meeting','you have left the meeting',
  'you have been removed from the meeting','this meeting has ended','the meeting has ended',
  'this meeting has been ended by host','the host has ended this meeting','the host has ended the meeting',
  'cuộc họp đã kết thúc','bạn đã rời khỏi cuộc họp','bạn đã rời cuộc họp']).has(text);
}
// Retain small stable edits after two samples, without semantic inference or OCR.
export class PersistentChange {
 constructor(){this.pending=null;}
 reset(){this.pending=null;}
 observe(frame,now){
  const previous=this.pending;
  if(!previous || previous.frame.key!==frame.key ||
     compare(frame,previous.frame).changedRatio>.0001){this.pending={frame,time:now};return false;}
  return now-previous.time>=15000;
 }
}
