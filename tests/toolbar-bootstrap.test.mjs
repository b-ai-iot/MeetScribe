import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {installToolbar} from '../extension/install.mjs';
const content=await readFile(new URL('../extension/content.js',import.meta.url),'utf8');

function fixture(){
 const handlers=[],timers=[];
 const context=vm.createContext({chrome:{runtime:{id:'test',onMessage:{addListener:fn=>handlers.push(fn)}}},window:{addEventListener(){}},setInterval:fn=>timers.push(fn),clearInterval(){},clearTimeout(){}});
 return {context,handlers,timers};
}

test('missing translation engine never registers a half-initialized collector',()=>{
 const {context,handlers,timers}=fixture();
 vm.runInContext(content,context);
 assert.equal(context.__meetScribe,undefined);
 assert.equal(handlers.length,0);
 assert.equal(timers.length,0);
});

test('partial translation engine never registers a collector',()=>{
 const {context,handlers}=fixture();
 context.__meetScribeI18n={t:()=>''};
 vm.runInContext(content,context);
 assert.equal(context.__meetScribe,undefined);
 assert.equal(handlers.length,0);
});

function installer({ready=true,mounts=[{ok:true}],legacy=false,sid}={}){
 const calls=[],scripts=[],state={mounts:0,collector:{bootstrapReady:!legacy,valid:()=>true,sid}};
 const api={runtime:{getURL:()=> 'data:text/plain,fixture-css'},scripting:{async executeScript(spec){
  calls.push(spec);
  if(spec.target.allFrames)return [{frameId:7,result:{hasMeeting:true,isTop:false}}];
  if(spec.files){scripts.push(...spec.files);return [{frameId:7}];}
  // Execute readiness probes in the same isolated global state as dependency assets.
  if(spec.func){const context=vm.createContext({});
   if(ready)for(const file of scripts.filter(f=>f.startsWith('i18n')))
    vm.runInContext(await readFile(new URL('../extension/'+file,import.meta.url),'utf8'),context);
   context.__meetScribe=state.collector;
   return [{frameId:7,result:vm.runInContext('('+spec.func.toString()+')()',context)}];
  }
 }},tabs:{async sendMessage(tab,msg){if(msg.type==='inspect')return {ok:true,sid};return mounts[state.mounts++]??{ok:true};}}};
 return {api,calls,scripts,state};
}

test('installer refuses to mount when translation assets did not initialize',async()=>{
 const f=installer({ready:false});
 await assert.rejects(installToolbar(f.api,1),/translation|language|ngôn ngữ/i);
 assert.equal(f.state.mounts,0);
 assert.ok(!f.scripts.includes('content.js'));
});

test('installer rejects legacy collectors before mount without invalidating them',async()=>{
 const f=installer({legacy:true});
 const originalValid=f.state.collector.valid;
 await assert.rejects(installToolbar(f.api,1),/older toolbar.*reload/i);
 assert.equal(f.state.mounts,0);
 assert.equal(f.scripts.filter(x=>x==='content.js').length,1);
 assert.equal(f.state.collector.valid,originalValid);
 assert.equal(f.state.collector.valid(),true);
});

test('installer does not report success for an unacknowledged mount or retry unrelated errors',async()=>{
 for(const reply of [undefined,{ok:false,error:'Unexpected failure'}]){
  const f=installer({mounts:[reply]});
  // Preserve undefined replies rather than the normal success default.
  f.api.tabs.sendMessage=async()=>{f.state.mounts++;return reply;};
  await assert.rejects(installToolbar(f.api,1),/mount|Unexpected failure/i);
  assert.equal(f.state.mounts,1);
 }
});

test('installer preserves an established legacy recording session',async()=>{
 const f=installer({legacy:true,sid:'active-session'});
 await assert.rejects(installToolbar(f.api,1),/Stop and save/);
 assert.equal(f.scripts.filter(x=>x==='content.js').length,1);
 assert.equal(f.state.mounts,0);
});
