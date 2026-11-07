import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeConversationHistory } from './conversationHistory.ts';
test('polling deduplicates shared messages while retaining already loaded earlier history',()=>{
 const result=mergeConversationHistory({messages:[{_id:'01'},{_id:'02'}],olderCursor:null},{messages:[{_id:'02'},{_id:'03'}],olderCursor:'02'});
 assert.deepEqual(result.messages.map(row=>row._id),['01','02','03']);assert.equal(result.olderCursor,null);
});
test('a disconnected tab can load the missing middle when its latest window no longer overlaps history',()=>{
 const result=mergeConversationHistory({messages:[{_id:'01'},{_id:'02'}],olderCursor:null},{messages:[{_id:'50'},{_id:'51'}],olderCursor:'50'});
 assert.equal(result.olderCursor,'50');assert.deepEqual(result.messages.map(row=>row._id),['01','02','50','51']);
});
