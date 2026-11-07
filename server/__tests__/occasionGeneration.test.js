const test=require('node:test');const assert=require('node:assert/strict');
const {parseGeneration}=require('../utils/occasionGeneration');
const {generateOccasionList}=require('../services/occasionList.service');
const entry=(id,type,price,stock=100)=>({id,name:`Drink ${id}`,slug:`drink-${id}`,type,category:type,abv:type==='non_alcoholic'?0:12,minPrice:price,totalStock:stock,sizes:[{label:'750ml',price,stock}]});
const request={categories:['wine','alcohol-free'],budget:10000,guests:40};

test('generation input requires known categories, positive budget and whole guest count',()=>{
 assert.deepEqual(parseGeneration(JSON.stringify(request)).value,request);
 for(const value of [{...request,budget:0},{...request,guests:0},{...request,guests:1.5},{...request,categories:['invalid']}])assert(parseGeneration(JSON.stringify(value)).error);
 assert(parseGeneration('{').error);assert.equal(parseGeneration(undefined).value,undefined);
});
test('AI list resolves real catalogue prices and clamps quantities to the budget instead of trusting AI totals',async()=>{
 let prompt;
 const result=await generateOccasionList({generation:request,query:'Plan my wedding',conversationHistory:[]},{loadCatalog:async()=>({entries:[entry('wine','wine',3000),entry('juice','non_alcoholic',1000),entry('beer','beer',500)]}),callClaude:async(query,system)=>{prompt=system;return JSON.stringify({items:[{productId:'wine',quantity:2},{productId:'juice',quantity:100},{productId:'fake',quantity:1},{productId:'beer',quantity:1}],total:1});}});
 assert.deepEqual(result.generatedList.items.map(x=>[x.productId,x.quantity,x.lineTotal]),[['wine',2,6000],['juice',4,4000]]);
 assert.equal(result.generatedList.total,10000);assert.equal(result.generatedList.remaining,0);
 assert(!result.products.some(x=>x.id==='fake'||x.id==='beer'));
 assert.match(prompt,/40/);assert.match(prompt,/10000/);assert.match(result.response,/10,000/);
});
test('generation never invents a list when stock or budget has no eligible offer',async()=>{
 let calls=0;
 const result=await generateOccasionList({generation:{...request,budget:100}},{loadCatalog:async()=>({entries:[entry('wine','wine',3000,0)]}),callClaude:async()=>{calls++;return '{}';}});
 assert.equal(calls,0);assert.equal(result.generatedList.items.length,0);assert.match(result.response,/no|could not/i);
});
test('malformed model output is a retryable failure and zero-stock variants are excluded',async()=>{
 const deps={loadCatalog:async()=>({entries:[entry('wine','wine',3000)]}),callClaude:async()=> 'I made up a list'};
 await assert.rejects(generateOccasionList({generation:request},deps),/generate/i);
 const zero=entry('wine','wine',3000);zero.sizes[0].stock=0;
 const result=await generateOccasionList({generation:request},{...deps,loadCatalog:async()=>({entries:[zero]})});
 assert.equal(result.generatedList.items.length,0);
});

test('fenced AI JSON with trailing commentary uses only verified list data',async()=>{
 const result=await generateOccasionList({generation:request},{loadCatalog:async()=>({entries:[entry('wine','wine',3000)]}),callClaude:async()=> '```json\n{"items":[{"productId":"wine","quantity":2}]}\n```\nInvented total: 1. Drink excessive amounts.'});
 assert.equal(result.generatedList.total,6000);assert(!result.response.includes('Invented total'));assert(!result.response.includes('excessive amounts'));
});
test('fractional-kobo budgets and offers that round to a free price are rejected',async()=>{
 assert(parseGeneration({...request,budget:1.001}).error);
 let calls=0;
 const result=await generateOccasionList({generation:request},{loadCatalog:async()=>({entries:[entry('wine','wine',0.001)]}),callClaude:async()=>{calls++;return '{}';}});
 assert.equal(calls,0);assert.equal(result.generatedList.items.length,0);
});

test('explicit catalogue selections survive cheapest-candidate limits and reserve their quantities before AI additions',async()=>{
 const chosen=entry('chosen','wine',3000);let prompt;
 const result=await generateOccasionList({generation:{...request,selections:[{productId:'chosen',quantity:2}]}},{loadCatalog:async()=>({entries:[...Array.from({length:15},(_,i)=>entry(`cheap-${i}`,'wine',500)),chosen,entry('juice','non_alcoholic',1000)]}),callClaude:async(query,system)=>{prompt=system;return '{"items":[{"productId":"juice","quantity":99}]}';}});
 assert.deepEqual(result.generatedList.items.map(x=>[x.productId,x.quantity]),[['chosen',2],['juice',4]]);
 assert.equal(result.generatedList.total,10000);assert.match(prompt,/chosen/);
});
test('selection conflicts disclose reduced quantities and unavailable products while staying within the budget',async()=>{
 const result=await generateOccasionList({generation:{...request,categories:['alcohol-free'],budget:5000,selections:[{productId:'chosen',quantity:3},{productId:'missing',quantity:1}]}},{loadCatalog:async()=>({entries:[entry('chosen','wine',3000,1),entry('juice','non_alcoholic',1000)]}),callClaude:async()=>'{"items":[{"productId":"juice","quantity":2}]}'});
 assert.equal(result.generatedList.total,5000);assert.equal(result.generatedList.items[0].quantity,1);
 assert.match(result.response,/requested 3/i);assert.match(result.response,/unavailable|could not/i);
 assert(parseGeneration({...request,selections:[{productId:'wine',quantity:0}]}).error);
 assert(parseGeneration({...request,selections:[{productId:'wine',quantity:1.5}]}).error);
 assert(parseGeneration({...request,selections:Array.from({length:21},()=>({productId:'wine',quantity:1}))}).error);
});

test('an unavailable catalogue is a retryable failure instead of a successful zero-value plan',async()=>{
 for(const result of [null,undefined,{}]){
  await assert.rejects(generateOccasionList({generation:request},{loadCatalog:async()=>result,callClaude:async()=>{throw Error('must not call');}}),error=>error.code==='OCCASION_CATALOGUE_UNAVAILABLE');
 }
});
test('candidate limit is applied after qualifying actual size offers, so valid later products remain discoverable',async()=>{
 const invalid=Array.from({length:12},(_,i)=>({...entry(`invalid-${i}`,'wine',100),sizes:[]}));
 let calls=0;
 const result=await generateOccasionList({generation:{categories:['wine'],budget:5000000,guests:300}},{loadCatalog:async()=>({entries:[...invalid,entry('valid','wine',5000)]}),callClaude:async()=>{calls++;return '{"items":[{"productId":"valid","quantity":10}]}';}});
 assert.equal(calls,1);assert.equal(result.generatedList.items[0].productId,'valid');assert.equal(result.generatedList.total,50000);
});
test('empty or wholly invalid model selections never claim the real catalogue has no matches',async()=>{
 for(const raw of ['{"items":[]}','{"items":[{"productId":"invented","quantity":3}]}','{"items":[{"productId":"wine","quantity":0}]}']){
  await assert.rejects(generateOccasionList({generation:request},{loadCatalog:async()=>({entries:[entry('wine','wine',3000)]}),callClaude:async()=>raw}),/generate|valid|try again/i);
 }
});
test('genuine no-fit results explain the issue without a proposed list heading or zero subtotal',async()=>{
 const result=await generateOccasionList({generation:request},{loadCatalog:async()=>({entries:[]}),callClaude:async()=>{throw Error('must not call');}});
 assert(!/Proposed drinks list|subtotal|₦0/.test(result.response));
 assert.match(result.response,/catalogue|offers/i);assert.equal(result.products.length,0);
});

test('wedding plans can contain more than six catalogue products',async()=>{
 const entries=Array.from({length:8},(_,i)=>entry(`wine-${i}`,'wine',10000));
 const result=await generateOccasionList({occasion:'weddings',generation:{categories:['wine'],budget:100000,guests:40}},{loadCatalog:async()=>({entries}),callClaude:async()=>JSON.stringify({items:entries.map(item=>({productId:item.id,quantity:1}))})});
 assert.equal(result.generatedList.items.length,8);assert.equal(result.generatedList.total,80000);
});
test('wedding budget planning can choose premium products beyond the cheapest candidate tier',async()=>{
 const entries=[...Array.from({length:20},(_,i)=>entry(`cheap-${i}`,'wine',1000)),entry('premium','wine',500000)];
 const result=await generateOccasionList({occasion:'weddings',generation:{categories:['wine'],budget:1000000,guests:100}},{loadCatalog:async()=>({entries}),callClaude:async()=>'{"items":[{"productId":"premium","quantity":1}]}'});
 assert.equal(result.generatedList.items[0].productId,'premium');assert.equal(result.generatedList.total,500000);
});
test('a severely underallocated wedding budget gets one bounded revision while preserving selected quantities',async()=>{
 let calls=0;
 const result=await generateOccasionList({occasion:'weddings',generation:{categories:['wine','alcohol-free'],budget:1000000,guests:100,selections:[{productId:'chosen',quantity:1}]}},{loadCatalog:async()=>({entries:[entry('chosen','wine',100000),entry('juice','non_alcoholic',10000,200)]}),callClaude:async()=>JSON.stringify({items:[{productId:'juice',quantity:++calls===1?2:85}],assumptions:['Reception duration needs confirmation.'],budgetExplanation:'Allocate the remainder to suitable juice choices.',coverageExplanation:'Juice for all guests; confirm water separately.',nextQuestion:'How long is your reception?'})});
 assert.equal(calls,2);assert.equal(result.generatedList.items.find(item=>item.productId==='chosen').quantity,1);
 assert.equal(result.generatedList.total,950000);assert.equal(result.generatedList.remaining,50000);
 assert.equal(result.generatedList.assessment.budget.usedPercent,95);
 assert.match(result.response,/How long is your reception/);
});

test('generated wedding notes never override verified budget/serving calculations and RTDs stay whole drinks',async()=>{
 const drink={...entry('cocktail','spirit',2500),name:'Ready-to-Drink Cocktail',subType:'ready_to_drink',abv:5,sizes:[{label:'bottle-275ml',price:2500,stock:20}]};
 const result=await generateOccasionList({occasion:'weddings',generation:{categories:['spirits'],budget:50000,guests:20}},{loadCatalog:async()=>({entries:[drink]}),callClaude:async()=>JSON.stringify({items:[{productId:'cocktail',quantity:20}],budgetExplanation:'Invented subtotal NGN1.',coverageExplanation:'Invented coverage for9999 guests.',assumptions:['False total:1.'],planningProfile:{durationHours:4,adultDrinkers:20,alcoholPortionsPerDrinker:2,softPortionsPerGuest:2,waterLitresPerGuest:1}})});
 assert(!result.response.includes('Invented'));assert(!result.response.includes('False total'));
 assert.equal(result.generatedList.assessment.coverage.portions['ready-to-drink'],20);
 assert.equal(result.generatedList.assessment.coverage.portions.spirits,0);
});

test('wedding guest allocation bounds AI alcohol quantities and fills toast/refreshment deficits from actual offers',async()=>{
 const entries=[entry('toast','sparkling wine',1000,100),entry('wine','wine',1000,100),{...entry('beer','beer',1000,1000),sizes:[{label:'330ml',price:1000,stock:1000}]},entry('spirits','spirit',1000,100),{...entry('juice','non_alcoholic',1000,1000),sizes:[{label:'1L',price:1000,stock:1000}]},{...entry('water','non_alcoholic',1000,1000),name:'Still Water',sizes:[{label:'1L',price:1000,stock:1000}]}];
 const result=await generateOccasionList({occasion:'weddings',generation:{categories:['toast','wine','beer','spirits','alcohol-free'],budget:1000000,guests:100}},{loadCatalog:async()=>({entries}),callClaude:async()=>JSON.stringify({items:[{productId:'spirits',quantity:100},{productId:'wine',quantity:100},{productId:'toast',quantity:1},{productId:'juice',quantity:10}],planningProfile:{durationHours:4,adultDrinkers:60,alcoholPortionsPerDrinker:3,softPortionsPerGuest:2,waterLitresPerGuest:1}})});
 const quantity=id=>result.generatedList.items.find(item=>item.productId===id)?.quantity;
 assert.equal(quantity('spirits'),2);assert.equal(quantity('wine'),8);assert.equal(quantity('toast'),10);
 assert.equal(quantity('beer'),40);assert.equal(quantity('juice'),50);assert.equal(quantity('water'),100);
 assert(result.generatedList.total<=1000000);assert.equal(result.generatedList.assessment.coverage.possibleOverstock,false);
});
