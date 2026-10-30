import test from 'node:test';
import assert from 'node:assert/strict';
import {registerMessages,normalizeLanguage,setLanguage,getLanguage,getLocale,t,
  translateMessage,errorMessage,messageError,getMessages,loadLanguage,watchLanguage} from '../extension/i18n.mjs';

registerMessages({
  vi:{'test.hello':'Xin chào {name}', 'test.problem':'Không ghi được {folder}: {error}'},
  en:{'test.hello':'Hello {name}', 'test.problem':'Cannot write {folder}: {error}'}
});

test('language is deliberately VI by default; only EN/VI are supported',()=>{
  assert.equal(normalizeLanguage(undefined),'vi');
  assert.equal(normalizeLanguage('fr'),'vi');
  assert.equal(normalizeLanguage('en'),'en');
  assert.equal(setLanguage('en'),'en');
  assert.equal(getLanguage(),'en');
  assert.equal(getLocale(),'en-US');
  setLanguage('vi');
  assert.equal(getLocale(),'vi-VN');
});

test('named interpolation preserves user strings literally and has VI fallback',()=>{
  setLanguage('en');
  assert.equal(t('test.hello',{name:'<script>$& {x}</script>'}),'Hello <script>$& {x}</script>');
  assert.equal(t('test.hello',{name:'Lan'},'vi'),'Xin chào Lan');
  assert.equal(t('unknown.key'),'unknown.key');
  setLanguage('vi');
});

test('old application errors translate at explicit error boundaries; unknown errors do not',()=>{
  assert.equal(translateMessage('Không ghi được Báo cáo: FILE_FAILED','en'),'Cannot write Báo cáo: FILE_FAILED');
  assert.equal(translateMessage('native browser detail: 0x01','en'),'native browser detail: 0x01');
  assert.equal(errorMessage({errorCode:'test.problem',errorParams:{folder:'Slides',error:'FILE_FAILED'}},'en'),'Cannot write Slides: FILE_FAILED');
  assert.equal(errorMessage(Object.assign(new Error('Disk is full'),{code:'ENOSPC'}),'en'),'Disk is full');
  const err=messageError('test.problem',{folder:'A',error:'X'});
  assert.equal(err.code,'test.problem');
  assert.deepEqual(err.params,{folder:'A',error:'X'});
});

test('language storage migration gives the dedicated field priority',async()=>{
  const storage={get:async()=>({meetscribe_setting_language:'en',meetscribe_settings:{language:'vi'}})};
  assert.equal(await loadLanguage(storage),'en');
  assert.equal(await loadLanguage({get:async()=>({meetscribe_settings:{language:'en'}})}),'en');
  assert.equal(await loadLanguage({get:async()=>({meetscribe_setting_language:'fr',meetscribe_settings:{language:'en'}})}),'vi');
  assert.equal(await loadLanguage({get:async()=>({meetscribe_setting_language:null,meetscribe_settings:{language:'en'}})}),'vi');
  assert.equal(await loadLanguage({get:async()=>({})}),'vi');
});

test('catalog key and placeholder parity prevents partially translated language support',()=>{
  const {vi,en}=getMessages();
  assert.deepEqual(Object.keys(en).sort(),Object.keys(vi).sort());
  for(const key of Object.keys(vi)){
    const params=value=>[...value.matchAll(/\{([A-Za-z0-9_]+)\}/g)].map(m=>m[1]).sort();
    assert.deepEqual(params(en[key]),params(vi[key]),key);
    assert.ok(en[key].trim(),key);
    assert.ok(vi[key].trim(),key);
  }
});

test('rapid language changes cannot let an older asynchronous storage read replace the latest locale',async()=>{
  const previousChrome=globalThis.chrome;
  let listener,resolveOld,reads=0;
  globalThis.chrome={storage:{local:{get:()=>++reads===1?new Promise(resolve=>{resolveOld=resolve;}):Promise.resolve({meetscribe_setting_language:'vi'})},
    onChanged:{addListener:fn=>{listener=fn;},removeListener:()=>{}}}};
  setLanguage('vi');
  const updates=[];const dispose=watchLanguage(lang=>updates.push(lang));
  try{
    const old=listener({meetscribe_setting_language:{newValue:'en'}},'local');
    await listener({meetscribe_setting_language:{newValue:'vi'}},'local');
    resolveOld({meetscribe_setting_language:'en'});
    await old;
    assert.equal(getLanguage(),'vi');
    assert.deepEqual(updates,[]);
  }finally{dispose();globalThis.chrome=previousChrome;setLanguage('vi');}
});
