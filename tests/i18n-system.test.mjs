import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateTranscriptMarkdown,generateAiReadme,generateArchiveManifest,buildSessionArchive} from '../extension/archive.mjs';

const session={id:'raw-id',title:'Tiêu đề <b>nguyên bản</b>',folder:'MeetScribe/Thư mục',status:'completed',createdAt:'2026-10-30T10:00:00Z',reason:'user-stop',count:1};
const captions='{"sequence":1,"timestamp":"2026-10-30T10:00:00Z","text":"Không dịch <img src=x> English captions"}\n';
const files=[{name:'captions/part-000001.jsonl',data:captions}];

test('system: generated English archive helpers retain raw titles, captions, reason and paths',()=>{
 const transcript=generateTranscriptMarkdown(session,files,'en');
 assert.match(transcript,/# Meeting capture:/);
 assert.match(transcript,/Caption timeline/);
 assert.ok(transcript.includes(session.title));
 assert.ok(transcript.includes('Không dịch <img src=x> English captions'));
 assert.ok(transcript.includes('user-stop'));
 const instructions=generateAiReadme(session,'en');
 assert.match(instructions,/AI meeting summary guide/);
 assert.match(instructions,/Do not infer or invent/);
 assert.ok(instructions.includes(session.title));
 assert.ok(instructions.includes('session-final.json'));
 const manifest=JSON.parse(generateArchiveManifest(session,[{path:'Thư mục/ảnh.png',data:new Uint8Array(1)}]));
 assert.equal(manifest.title,session.title);
 assert.equal(manifest.reason,'user-stop');
 assert.equal(manifest.files[0].path,'Thư mục/ảnh.png');
});

test('system: Vietnamese archive helpers remain the default',()=>{
 assert.match(generateTranscriptMarkdown(session,files),/Biên bản ghi nhận cuộc họp/);
 assert.match(generateAiReadme(session),/Hướng dẫn tổng hợp cuộc họp bằng AI/);
 assert.ok(generateAiReadme(session).includes(session.title));
});

test('system: errors carry stable codes and interpolate paths without translating native detail',async()=>{
 const {setLanguage,errorMessage,messageError,t}=await import('../extension/i18n.mjs');
 try{
  setLanguage('en');
  assert.equal(t(20),'20');
  await assert.rejects(buildSessionArchive(session,[{name:'../Thư mục.txt',data:'raw'}]),error=>{
   assert.equal(error.code,'system.archiveUnsafePath');
   assert.deepEqual(error.params,{path:'../Thư mục.txt'});
   assert.equal(error.message,'Unsafe file path in archive: ../Thư mục.txt');
   assert.equal(errorMessage(error,'vi'),'Đường dẫn tệp không an toàn trong gói lưu trữ: ../Thư mục.txt');
   return true;
  });
  assert.equal(errorMessage('Thư mục đã chọn không cho phép ghi: NotAllowedError: native detail','en'),'The selected folder is not writable: NotAllowedError: native detail');
  assert.equal(errorMessage(new Error('Native error <b> raw text'),'vi'),'Native error <b> raw text');
  const error=messageError('system.directoryMissing',{name:'Chưa dịch'});
  assert.ok(errorMessage({error:error.message,errorCode:error.code,errorParams:error.params},'vi').includes('Chưa dịch'));
 }finally{setLanguage('vi');}
});

test('system: worker and offscreen wait for stored language and update replies without capture restart',async()=>{
 const oldChrome=globalThis.chrome,oldDocument=globalThis.document,oldIndexedDB=globalThis.indexedDB;
 const oldNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator');
 const nativeIntervals=[];
 const originalSetInterval=globalThis.setInterval;
 let values={meetscribe_setting_language:'en'},release;
 const initialRead=new Promise(resolve=>{release=()=>resolve(values);});
 let firstRead=true;
 const languageListeners=[],messageListeners=[],titles=[];
 const event=()=>({addListener(){}});
 globalThis.chrome={
  storage:{local:{get:async()=>firstRead?(firstRead=false,initialRead):values},onChanged:{addListener:fn=>languageListeners.push(fn)}},
  action:{onClicked:event(),setTitle:async data=>titles.push(data.title)},
  runtime:{id:'test-extension',onMessage:{addListener:fn=>messageListeners.push(fn)},onInstalled:event(),onStartup:event()},
  tabs:{onRemoved:event(),onUpdated:event()},alarms:{onAlarm:event()}
 };
 globalThis.document={getElementById:()=>({play:async()=>{}})};
 const {setLanguage}=await import('../extension/i18n.mjs');
 try{
  await import('../extension/background.js');
  let answered=false;
  const pending=new Promise(resolve=>messageListeners[0]({scope:'meetscribe',target:'worker',type:'status'},{id:'invalid'},result=>{answered=true;resolve(result);}));
  await Promise.resolve();
  assert.equal(answered,false);
  release();
  const english=await pending;
  assert.equal(english.error,'Invalid sender');
  assert.equal(english.errorCode,'system.invalidSender');
  assert.deepEqual(english.errorParams,{});
  assert.ok(titles.includes('Open MeetScribe'));
  await import('../extension/offscreen.js');
  const mark=()=>new Promise(resolve=>messageListeners[1]({scope:'meetscribe',target:'offscreen',type:'mark',sid:'inactive'},{id:'test-extension'},resolve));
  assert.equal((await mark()).message,'Caption marker saved; shared image capture is off.');
  values={meetscribe_setting_language:'vi'};
  await Promise.all(languageListeners.map(fn=>fn({meetscribe_setting_language:{oldValue:'en',newValue:'vi'}},'local')));
  const vietnamese=await new Promise(resolve=>messageListeners[0]({scope:'meetscribe',target:'worker',type:'status'},{id:'invalid'},resolve));
  assert.equal(vietnamese.error,'Người gửi không hợp lệ');
  assert.equal((await mark()).message,'Đã lưu mốc caption; chưa bật ảnh chia sẻ.');
  assert.ok(titles.includes('Mở MeetScribe'));
  const native=new DOMException('The video source failed to start','AbortError');
  assert.equal(native.code,20);
  const stream={getTracks:()=>[],getVideoTracks:()=>[{addEventListener(){}}]};
  const media={getUserMedia:async()=>{throw native;}};
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:media}});
  globalThis.setInterval=(...args)=>{const timer=originalSetInterval(...args);nativeIntervals.push(timer);return timer;};
  const start=()=>new Promise(resolve=>messageListeners[1]({scope:'meetscribe',target:'offscreen',type:'start',sid:'native-failure',streamId:'raw-stream-id'},{id:'test-extension'},resolve));
  // Native errors must retain their detail and must never be serialized as translation codes.
  const direct=JSON.parse(JSON.stringify(await start()));
  assert.equal(direct.error,native.message);
  assert.equal(direct.errorCode,null);
  media.getUserMedia=async()=>stream;
  for(const code of [native.code,'unknown.translation.code']){
   globalThis.chrome.runtime.sendMessage=async()=>({ok:false,error:native.message,errorCode:code});
   const received=JSON.parse(JSON.stringify(await start()));
   assert.equal(received.error,native.message);
   assert.equal(received.errorCode,null);
  }
  // Exercise the worker receiver too; only the browser's IndexedDB transport is replaced.
  const meetingUrl='https://meet.google.com/abc-defg-hij';
  const stored={id:'native-worker',tabId:1,url:meetingUrl,status:'recording',visual:'not-selected',folder:'MeetScribe/raw'};
  const db={transaction(){
   const tx={objectStore(name){return {
    get(){const req={};queueMicrotask(()=>{req.result=stored;req.onsuccess?.();});return req;},
    put(item){if(name==='sessions')Object.assign(stored,item);},abort(){}
   };}};
   setTimeout(()=>tx.oncomplete?.(),0);return tx;
  }};
  globalThis.indexedDB={open(){const req={};queueMicrotask(()=>{req.result=db;req.onsuccess?.();});return req;}};
  globalThis.chrome.runtime.getURL=path=>'chrome-extension://test-extension/'+path;
  globalThis.chrome.runtime.getContexts=async()=>[{contextType:'OFFSCREEN_DOCUMENT'}];
  globalThis.chrome.tabCapture={getMediaStreamId:async()=> 'raw-stream-id'};
  globalThis.chrome.runtime.sendMessage=async()=>({ok:false,error:native.message,errorCode:native.code});
  const workerNative=await new Promise(resolve=>messageListeners[0]({scope:'meetscribe',target:'worker',type:'visual-start',sid:stored.id},{id:'test-extension',url:meetingUrl,tab:{id:1,url:meetingUrl}},resolve));
  assert.equal(workerNative.error,'Caption vẫn lưu. Chưa lấy được ảnh: '+native.message);
  assert.equal(workerNative.errorCode,'system.visualUnavailable');
  assert.equal(workerNative.errorParams.detail,native.message);
  assert.equal(stored.visualError,native.message);
  assert.equal(stored.visualErrorCode,null);
 }finally{
  nativeIntervals.forEach(clearInterval);globalThis.setInterval=originalSetInterval;
  if(oldNavigator)Object.defineProperty(globalThis,'navigator',oldNavigator);else delete globalThis.navigator;
  setLanguage('vi');globalThis.chrome=oldChrome;globalThis.document=oldDocument;globalThis.indexedDB=oldIndexedDB;
 }
});

test('system: persisted and wire visual wrappers translate known nested errors without changing raw parameters',async()=>{
 const {setLanguage,errorMessage,messageError}=await import('../extension/i18n.mjs');
 const cases=[
  {code:'system.visualInUse',vi:'Một cuộc họp khác đang dùng luồng ảnh. Dừng ảnh ở cuộc họp đó trước.',en:'Another meeting is using the image stream. Stop image capture in that meeting first.'},
  {code:'system.sharePosition',vi:'Chưa xác định được vị trí vùng share trong khung Zoom; caption vẫn tiếp tục.',en:'The shared area in the Zoom frame could not be located; captions continue.'},
  {native:'NotAllowedError: nội dung <b>native</b> remains unchanged'}
 ];
 try{
  setLanguage('vi');
  for(const fixture of cases){
   const detail=fixture.code?errorMessage(messageError(fixture.code)):fixture.native;
   const wrapped=messageError('system.visualUnavailable',{detail});
   const wire=JSON.parse(JSON.stringify({error:wrapped.message,errorCode:wrapped.code,errorParams:wrapped.params}));
   const before=JSON.stringify(wire);
   const expectedEn='Captions are still saved. Could not capture an image: '+(fixture.en||fixture.native);
   const expectedVi='Caption vẫn lưu. Chưa lấy được ảnh: '+(fixture.vi||fixture.native);
   assert.equal(errorMessage(wire,'en'),expectedEn);
   assert.equal(errorMessage(wire,'vi'),expectedVi);
   assert.equal(JSON.stringify(wire),before);
   // Old stored errors have no codes; formatting must also localize their nested known details.
   assert.equal(errorMessage(wrapped.message,'en'),expectedEn);
   assert.equal(errorMessage(expectedEn,'vi'),expectedVi);
  }
  const raw='Một cuộc họp khác đang dùng luồng ảnh. Dừng ảnh ở cuộc họp đó trước.';
  assert.equal(errorMessage(messageError('system.archiveUnsafePath',{path:raw}),'en'),'Unsafe file path in archive: '+raw);
  assert.equal(errorMessage(messageError('system.directoryMissing',{name:raw}),'en'),'Folder access was not found: '+raw+'. Open Settings to grant permission again.');
 }finally{setLanguage('vi');}
});
