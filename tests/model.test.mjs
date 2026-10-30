import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sessionFolder,safeName,validEntries,isMeet} from '../extension/model.mjs';
test('local dates, safe folders and independent session paths',()=>{
 const date=new Date(2026,9,29,15,6,27);
 assert.equal(sessionFolder('Q4 / Enfarm: Kick-off',date,'abc12345'),'MeetScribe/2026-10-29/Q4 - Enfarm- Kick-off--150627--abc12345');
 assert.equal(safeName('../..\\bad\nname'),'bad name');
 assert.ok(!safeName('CON').match(/^CON$/i));
 assert.equal(safeName('  '),'Cuộc họp');
 assert.ok(safeName('Đất và phân bón').includes('Đất'));
});
test('accepts bounded ordered caption batches and rejects bad payloads',()=>{
 assert.equal(validEntries([{sequence:1,timestamp:'2026-10-29T08:00:00Z',text:'A'}]),true);
 for(const entries of [[],[{sequence:0,text:'a'}],[{sequence:1,timestamp:'oops',text:'a'}],[{sequence:1,timestamp:'2026-10-29',text:'a'},{sequence:1,timestamp:'2026-10-29',text:'b'}]])assert.equal(validEntries(entries),false);
 assert.equal(validEntries([{sequence:1,timestamp:'2026-10-29',text:'a'},{sequence:3,timestamp:'2026-10-29',text:'c'}]),false);
 assert.equal(isMeet('https://meet.google.com/abc-defg-hij'),true);
 assert.equal(isMeet('https://meet.google.com.evil.test/abc'),false);
});
