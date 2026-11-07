const test = require('node:test');
const assert = require('node:assert/strict');
const { planOccasion } = require('../services/occasionChat.service');

// Boundaries are the paid model, vision provider and public catalogue, not the planner.
function providers(overrides = {}) {
  const calls = [];
  return { calls, deps: {
    buildFullCatalogContext: async tenant => `Public catalogue for ${tenant || 'marketplace'}: Apple Juice 1L, ₦2000.`,
    analyzeImage: async () => ({ text: 'Photo shows apple juice, quantity unclear.' }),
    callClaude: async (...args) => { calls.push(args); return 'What time does your reception start?'; },
    ...overrides,
  } };
}
test('occasion file planning retains prior answers and readable list for follow-ups', async () => {
  const { deps, calls } = providers();
  const reply = await planOccasion({ query: 'Here is my list', occasion: 'weddings', tenantId: 'shop-one', fileContent: '12 Apple Juice 1L', fileName: 'reception.csv', conversationHistory: [{ role: 'user', content: 'Abuja, 80 guests, budget NGN 100000' }] }, deps);
  assert.match(calls[0][0], /12 Apple Juice 1L/);
  assert.match(calls[0][1], /Public catalogue for shop-one/);
  assert.equal(calls[0][2][0].content, 'Abuja, 80 guests, budget NGN 100000');
  assert.match(reply.attachmentContext, /12 Apple Juice 1L/);
  assert.equal(reply.response, 'What time does your reception start?');
  assert.equal(reply.cartProposal, undefined);
});
test('occasion photos use conversation as well as image analysis, without treating vision as confirmed stock', async () => {
  const { deps, calls } = providers();
  const reply = await planOccasion({ query: '', occasion: 'corporate', imageUrls: ['data:image/png;base64,test'], conversationHistory: [{ role: 'assistant', content: 'You prefer alcohol-free choices.' }] }, deps);
  assert.match(calls[0][0], /Photo shows apple juice/);
  assert.equal(calls[0][2][0].content, 'You prefer alcohol-free choices.');
  assert.match(reply.attachmentContext, /quantity unclear/);
});
test('unreadable files and oversized extracted text are disclosed and bounded', async () => {
  const { deps, calls } = providers();
  const unreadable = await planOccasion({ fileUnreadable: true, fileName: 'empty.pdf' }, deps);
  assert.match(unreadable.response, /could not read/i);
  assert.equal(calls.length, 0);
  const reply = await planOccasion({ fileContent: 'x'.repeat(11000), fileName: 'long.txt' }, deps);
  assert.match(reply.response, /first 10,000 characters/);
  assert(reply.attachmentContext.length <= 5000);
  assert(calls[0][0].length < 13000);
});
test('occasion provider failure produces an actionable failure, not an invented plan', async () => {
  const { deps } = providers({ callClaude: async () => null });
  await assert.rejects(planOccasion({ query: 'Plan a wedding' }, deps), /unavailable/);
});

test('occasion product choices come only from matching public catalogue entries',async()=>{
 const {deps}=providers({callClaude:async()=> 'Consider Apple Juice. Unknown Luxury is another option.',loadCatalog:async()=>({entries:[
  {id:'juice',name:'Apple Juice',slug:'apple-juice',image:'https://example.com/juice.jpg',totalStock:10,minPrice:2000},
  {id:'sold',name:'Unknown Luxury',slug:'unknown-luxury',totalStock:0,minPrice:5000},
  {id:'other',name:'Orange Juice',slug:'orange-juice',totalStock:10,minPrice:2500},
 ]})});
 const reply=await planOccasion({query:'Suggest juice'},deps);
 assert.deepEqual(reply.products,[{id:'juice',name:'Apple Juice',slug:'apple-juice',image:'https://example.com/juice.jpg'}]);
});

test('occasion prompt removes internal stock quantities from catalogue context',async()=>{
 const {deps,calls}=providers({buildFullCatalogContext:async()=> 'Apple Juice 1L ₦2000 (stock: 98765)'});
 await planOccasion({query:'Plan my wedding'},deps);
 assert(!calls[0][1].includes('98765'));
});

test('category generation dispatch uses the verified list generator and keeps customer history',async()=>{
 let history;
 const {deps}=providers({loadCatalog:async()=>({entries:[{id:'wine',name:'Reception Wine',slug:'reception-wine',type:'wine',abv:12,totalStock:20,minPrice:3000,sizes:[{label:'750ml',price:3000,stock:20}]}]}),callClaude:async(query,system,turns)=>{history=turns;return '```json\n{"items":[{"productId":"wine","quantity":2}]}\n```\nExtra commentary';}});
 const reply=await planOccasion({generation:{categories:['wine'],budget:10000,guests:40},conversationHistory:[{role:'user',content:'Wedding lunch in Abuja'}]},deps);
 assert.equal(reply.generatedList.total,6000);assert.equal(history[0].content,'Wedding lunch in Abuja');assert.match(reply.response,/Reception Wine/);
});
