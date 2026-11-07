import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareOccasionAiBrief} from './occasionAiBrief.ts';

test('AI preparation validates supplied fields and makes missing details explicit without requiring city',()=>{
 const input={occasion:'weddings',city:'',date:'',guests:'40',budget:'150000',notes:'Lunch reception'};
 const result=prepareOccasionAiBrief(input,'2026-10-21');
 assert.equal(result.ok,true);assert.match(result.context,/Weddings/);assert.match(result.context,/40/);assert.match(result.context,/150,000/);assert.match(result.context,/Lunch reception/);
 assert(!result.context.includes('Abuja'));
 assert.equal(prepareOccasionAiBrief({...input,guests:'-1'},'2026-10-21').ok,false);
 assert.equal(prepareOccasionAiBrief({...input,date:'2026-10-20'},'2026-10-21').ok,false);
});
