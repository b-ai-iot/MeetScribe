import {test} from 'node:test';
import assert from 'node:assert/strict';
import {meetingPlatform,isSupportedMeeting} from '../extension/model.mjs';

test('Teams commercial, cloud and personal web clients are recognized without allowing lookalike hosts',()=>{
 for(const url of ['https://teams.microsoft.com/v2/','https://teams.microsoft.com/l/meetup-join/19%3ameeting_demo/0','https://teams.cloud.microsoft/v2/#/meet','https://teams.live.com/meet/123?p=demo']){
  assert.equal(meetingPlatform(url),'teams',url);assert.equal(isSupportedMeeting(url),true);
 }
 for(const url of ['http://teams.microsoft.com/v2/','https://teams.microsoft.com.evil.test/v2/','https://evilteams.microsoft.com/v2/','https://teams.cloud.microsoft.evil.test/','https://teams.live.com.evil.test/','https://login.microsoftonline.com/','https://www.microsoft.com/en-us/microsoft-teams/','msteams://teams.microsoft.com/meet','not a URL']){
  assert.equal(isSupportedMeeting(url),false,url);
 }
});

test('installer discovers the Teams caption frame without depending on Zoom meeting-app IDs',async()=>{
 const {installToolbar}=await import('../extension/install.mjs');
 const {default:vm}=await import('node:vm');let probe;
 const api={scripting:{executeScript:async spec=>{if(spec.target.allFrames){probe=spec.func;return [];}throw Error('stop after frame probe');}}};
 await assert.rejects(installToolbar(api,1),/stop after frame probe/);
 const top={};
 const result=vm.runInNewContext('('+probe.toString()+')()',{window:{top},location:{origin:'https://teams.microsoft.com',pathname:'/v2/'},document:{querySelector:selector=>selector.includes('[data-tid="closed-caption-renderer-wrapper"]')?{}:null}});
 assert.equal(result.hasMeeting,true);
});
