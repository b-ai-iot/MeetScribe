import {test} from 'node:test';import assert from 'node:assert/strict';
import {CommandQueue} from '../extension/commands.mjs';
test('Stop queues behind delayed Start while duplicate commands coalesce',async()=>{
 const q=new CommandQueue(),order=[];let release,begun;const began=new Promise(r=>begun=r);
 const start=q.run(1,'start',async()=>{order.push('start');await new Promise(r=>{release=r;begun();});return 'recording';});
 await began;const same=q.run(1,'start',()=>{throw Error('duplicate start');});
 const stop=q.run(1,'stop',async()=>{order.push('stop');return 'completed';});release();
 assert.equal(await start,'recording');assert.equal(await same,'recording');assert.equal(await stop,'completed');assert.deepEqual(order,['start','stop']);
});
