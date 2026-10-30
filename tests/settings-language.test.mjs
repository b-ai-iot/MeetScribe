import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_SETTINGS,SETTING_KEYS,validateSettings,getSettings,saveSettings,resetSettings} from '../extension/settings.mjs';

const storage = initial => {
  const data={...initial};
  return {get:async keys=>Object.fromEntries(keys.filter(k=>k in data).map(k=>[k,data[k]])),
    set:async values=>Object.assign(data,values)};
};

test('language setting defaults to VI and accepts exactly VI/EN',()=>{
  assert.equal(DEFAULT_SETTINGS.language,'vi');
  assert.equal(SETTING_KEYS.language,'meetscribe_setting_language');
  assert.equal(validateSettings({language:'en'}).language,'en');
  assert.equal(validateSettings({language:'fr'}).language,'vi');
  assert.equal(validateSettings({}).language,'vi');
});

test('old installs preserve other preferences and dedicated language overrides legacy',async()=>{
  const old=storage({meetscribe_settings:{opacity:72,fontSize:16}});
  assert.deepEqual(await getSettings(old),{opacity:72,fontSize:16,toolbarPosition:null,collapsed:false,destination:'downloads',language:'vi'});
  const mixed=storage({meetscribe_settings:{language:'en'},meetscribe_setting_language:'vi'});
  assert.equal((await getSettings(mixed)).language,'vi');
  const invalid=storage({meetscribe_settings:{language:'en'},meetscribe_setting_language:null});
  assert.equal((await getSettings(invalid)).language,'vi');
});

test('language persists independently during concurrent preference saves and resets to VI',async()=>{
  const data=storage({});
  await Promise.all([saveSettings({language:'en'},data),saveSettings({opacity:64},data)]);
  assert.equal((await getSettings(data)).language,'en');
  assert.equal((await getSettings(data)).opacity,64);
  await resetSettings(data);
  assert.equal((await getSettings(data)).language,'vi');
  assert.equal((await getSettings(data)).opacity,96);
});
