import {validEntries} from './model.mjs';
let opening;
export function database(){return opening ||= new Promise((resolve,reject)=>{
 const req=indexedDB.open('meetscribe-local-v1',2);
 req.onupgradeneeded=()=>{
  const db=req.result;
  if(!db.objectStoreNames.contains('sessions'))db.createObjectStore('sessions',{keyPath:'id'});
  if(!db.objectStoreNames.contains('files')){const files=db.createObjectStore('files',{keyPath:'id'});files.createIndex('pending',['sid','state']);}
  if(!db.objectStoreNames.contains('destination_handles'))db.createObjectStore('destination_handles',{keyPath:'id'});
 };
 req.onsuccess=()=>resolve(req.result);req.onerror=()=>{opening=null;reject(req.error);};
});}
const request=req=>new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
export async function getSession(id){return request((await database()).transaction('sessions').objectStore('sessions').get(id));}
export async function listSessions(){return (await request((await database()).transaction('sessions').objectStore('sessions').getAll())).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));}
function addFile(tx,s,name,data,mime='application/json',isDataURL=false){
 const file={id:s.id+'/'+name,sid:s.id,name:s.folder+'/'+name,data,mime,isDataURL,state:0};
 tx.objectStore('files').put(file);s.pendingExports=(s.pendingExports||0)+1;return file;
}
async function mutate(id,fn){const db=await database();return new Promise((resolve,reject)=>{
 const tx=db.transaction(['sessions','files'],'readwrite',{durability:'strict'});let result;
 tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Local journal transaction aborted'));
 const req=tx.objectStore('sessions').get(id);req.onsuccess=()=>{
  const s=req.result;if(!s){tx.abort();return;}
  try{result=fn(tx,s);tx.objectStore('sessions').put(s);}catch(e){reject(e);tx.abort();}
 };
});}
export async function createSession(s){const db=await database();return new Promise((resolve,reject)=>{
 const tx=db.transaction(['sessions','files'],'readwrite',{durability:'strict'});
 s={...s,pendingExports:0,fileIndex:0,images:0,imageBytes:0};
 tx.objectStore('sessions').add(s);
 addFile(tx,s,'session.json',JSON.stringify(s,null,2));tx.objectStore('sessions').put(s);
 tx.oncomplete=()=>resolve(s);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
});}
export function patchSession(id,patch){return mutate(id,(_tx,s)=>Object.assign(s,patch));}
export function appendCaptions(id,entries){
 if(!validEntries(entries))return Promise.reject(Error('Invalid caption batch'));
 return mutate(id,(tx,s)=>{
  if(s.status!=='recording'&&s.status!=='stopping')throw Error('Session is not collecting');
  const fresh=entries.filter(e=>e.sequence>s.lastSequence);
  if(!fresh.length)return {count:s.count,lastSequence:s.lastSequence};
  if(fresh[0].sequence!==s.lastSequence+1)throw Error('Caption sequence gap');
  s.fileIndex++;s.count+=fresh.length;s.lastSequence=fresh.at(-1).sequence;s.lastCaptionAt=fresh.at(-1).timestamp;
  s.captionTail=fresh.at(-1).text.slice(-1500);
  addFile(tx,s,`captions/part-${String(s.fileIndex).padStart(6,'0')}.jsonl`,fresh.map(e=>JSON.stringify(e)).join('\n')+'\n','application/octet-stream');
  return {count:s.count,lastSequence:s.lastSequence};
 });
}
export function writeFile(id,name,data,mime='application/json',isDataURL=false){
 if(!/^(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+$/.test(name)||name.includes('..'))return Promise.reject(Error('Invalid journal path'));
 return mutate(id,(tx,s)=>addFile(tx,s,name,data,mime,isDataURL));
}
export function saveImage(id,{name,data,bytes,event}){return mutate(id,(tx,s)=>{
 if(!['recording','stopping'].includes(s.status))throw Error('Session is no longer collecting images');
 const now=Date.now();s.imageTimes=(s.imageTimes||[]).filter(t=>now-t<3600000);
 if(s.images>=120||s.imageTimes.length>=30||s.imageBytes+bytes>104857600)throw Error('Image budget exceeded');
 addFile(tx,s,'images/'+name,data,'image/png',true);
 addFile(tx,s,'images/'+name+'.json',JSON.stringify(event,null,2));
 s.images++;s.imageTimes.push(now);s.imageBytes+=bytes;return {images:s.images,imageBytes:s.imageBytes};
});}
export async function pendingFiles(id){return request((await database()).transaction('files').objectStore('files').index('pending').getAll([id,0]));}
export function markExported(file,download){return mutate(file.sid,(tx,s)=>{
 const req=tx.objectStore('files').get(file.id);req.onsuccess=()=>{
  const current=req.result;if(!current||current.state!==0)return;
  current.state=1;current.downloadId=download.id;current.absolutePath=download.filename;current.data=file.data;
  tx.objectStore('files').put(current);s.pendingExports=Math.max(0,s.pendingExports-1);s.lastDownloadId=download.id;s.exportError=null;
  tx.objectStore('sessions').put(s);
 };
});}

export function setVisualState(id,token,patch){return mutate(id,(_tx,s)=>{
 if(s.status==='recording'&&s.visualToken===token)Object.assign(s,patch);
 return s;
});}
export function finalizeSession(id,{interrupted=false,reason,endedAt=new Date().toISOString()}){
 return mutate(id,(tx,s)=>{
  if(['completed','interrupted'].includes(s.status))return s;
  Object.assign(s,{status:interrupted?'interrupted':'completed',endedAt,reason,visual:'stopped',visualToken:crypto.randomUUID()});
  const {captionTail,...metadata}=s;
  addFile(tx,s,'events/finished.json',JSON.stringify({timestamp:endedAt,type:interrupted?'interrupted':'stopped',reason}));
  addFile(tx,s,'session-final.json',JSON.stringify(metadata,null,2));
  addFile(tx,s,'finished.json',JSON.stringify({id:s.id,endedAt,reason,status:s.status,captionUpdates:s.count,images:s.images,reportStatus:'awaiting-user-request'},null,2));
  return s;
 });
}

const mockHandlesMap=new Map();
export async function saveDirectoryHandle(handle,id=crypto.randomUUID()){
 const db=await database();
 const item={id,handle,name:handle?.name||'Thư mục',updatedAt:new Date().toISOString()};
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('destination_handles','readwrite');
  tx.oncomplete=()=>resolve(item);
  tx.onerror=()=>reject(tx.error);
  try{
   tx.objectStore('destination_handles').put(item);
   tx.objectStore('destination_handles').put({id:'active',activeId:id});
  }catch(e){
   if(e.name==='DataCloneError'){
    mockHandlesMap.set(id,handle);
    mockHandlesMap.set('active',handle);
    tx.objectStore('destination_handles').put({id,name:handle?.name||'Thư mục',updatedAt:new Date().toISOString(),isMock:true});
    tx.objectStore('destination_handles').put({id:'active',activeId:id});
   }else throw e;
  }
 });
}
export async function getActiveDirectoryHandleId(){
 const db=await database();
 if(!db.objectStoreNames.contains('destination_handles'))return null;
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('destination_handles','readonly');
  const req=tx.objectStore('destination_handles').get('active');
  req.onsuccess=()=>resolve(req.result?.activeId||null);
  req.onerror=()=>reject(req.error);
 });
}
export async function getDirectoryHandle(id){
 const db=await database();
 if(!db.objectStoreNames.contains('destination_handles'))return null;
 const targetId=id||await getActiveDirectoryHandleId();
 if(!targetId)return null;
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('destination_handles','readonly');
  const req=tx.objectStore('destination_handles').get(targetId);
  req.onsuccess=()=>{
   const res=req.result;
   if(!res)resolve(null);
   else if(res.isMock&&mockHandlesMap.has(targetId))resolve(mockHandlesMap.get(targetId));
   else resolve(res.handle||null);
  };
  req.onerror=()=>reject(req.error);
 });
}
export async function clearDirectoryHandle(id){
 const db=await database();
 if(!db.objectStoreNames.contains('destination_handles'))return;
 const targetId=id||await getActiveDirectoryHandleId();
 if(targetId)mockHandlesMap.delete(targetId);
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('destination_handles','readwrite');
  tx.oncomplete=()=>resolve();
  tx.onerror=()=>reject(tx.error);
  if(targetId)tx.objectStore('destination_handles').delete(targetId);
  if(!id||id===targetId)tx.objectStore('destination_handles').delete('active');
 });
}
