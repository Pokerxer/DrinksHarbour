import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildWeddingChatPrompt} from './weddingChatPrompt.ts';
import {requestPlanningDraft,subscribePlanningDraft,appendPlanningDraft} from './chatPlanning.ts';

test('wedding AI draft includes the current list and selected preferences without inventing prices',()=>{
 const result=buildWeddingChatPrompt('review',[{id:'1',name:'Reception wine',quantity:'12',size:'750 ml',unit:'bottles'}],'Non-alcoholic drinks');
 assert.equal(result.ok,true);assert.match(result.text,/12 bottles — Reception wine — 750 ml/);
 assert.match(result.text,/Non-alcoholic drinks/);assert.match(result.text,/Review/);
 assert(!result.text.includes('NGN'));assert(!result.text.includes('confirmed delivery'));
});
test('empty lists allow ideas while incomplete rows cannot be shared as complete',()=>{
 assert.equal(buildWeddingChatPrompt('ideas',[],'').ok,true);
 assert.match(buildWeddingChatPrompt('non-alcoholic',[],'').text,/non-alcoholic/i);
 assert.equal(buildWeddingChatPrompt('review',[{id:'1',name:'Wine',quantity:'',size:'',unit:'bottles'}],'').ok,false);
});
test('planning draft queues until widget subscribes and does not reappear after consumption',()=>{
 assert.equal(requestPlanningDraft({source:'wedding',text:'Please review my list.'}),true);
 const received=[];const unsubscribe=subscribePlanningDraft(draft=>received.push(draft));
 assert.equal(received[0].text,'Please review my list.');
 requestPlanningDraft({source:'wedding',text:'Updated list.'});assert.equal(received[1].text,'Updated list.');
 unsubscribe();let repeated=false;const cleanup=subscribePlanningDraft(()=>{repeated=true;});assert.equal(repeated,false);cleanup();
 assert.equal(requestPlanningDraft({source:'wedding',text:'x'.repeat(6001)}),false);
});
test('adding a planning draft preserves an existing unsent message',()=>{
 assert.equal(appendPlanningDraft('My own question.','Wedding list.'),'My own question.\n\nWedding list.');
 assert.equal(appendPlanningDraft('','Wedding list.'),'Wedding list.');
});
