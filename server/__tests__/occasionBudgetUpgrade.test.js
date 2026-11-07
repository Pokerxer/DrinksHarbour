const test = require('node:test');
const assert = require('node:assert/strict');
const { generateOccasionList } = require('../services/occasionList.service');
const offer = (id,price,stock=100) => ({id,name:id,slug:id,type:'wine',category:'wine',abv:12,totalStock:stock,sizes:[{label:'750ml',price,stock}]});
test('wedding allocation upgrades catalogue brands without inflating guest quantities or changing pinned selections',async()=>{
 const result = await generateOccasionList({occasion:'weddings',generation:{categories:['wine'],budget:100000,guests:20,selections:[{productId:'pinned',quantity:1}]}},{loadCatalog:async()=>({entries:[offer('pinned',1000),offer('value',1000),offer('premium',7000),offer('top',14000)]}),callClaude:async()=>JSON.stringify({items:[{productId:'value',quantity:7}],planningProfile:{durationHours:4,adultDrinkers:20,alcoholPortionsPerDrinker:2,softPortionsPerGuest:0,waterLitresPerGuest:0}})});
 assert.equal(result.generatedList.items.find(item=>item.productId==='pinned').quantity,1);
 assert.equal(result.generatedList.items.reduce((n,item)=>n+item.quantity,0),8);
 assert.equal(result.generatedList.assessment.coverage.portions.wine,40);
 assert(result.generatedList.total>=98000);assert(result.generatedList.total<=100000);
});
test('budget upgrades cannot substitute another volume, exceed stock or mutate the original plan',()=>{
 const { upgradeOccasionBudget }=require('../utils/occasionBudgetUpgrade');
 const items=[{productId:'value',name:'Value',category:'wine',servingCategory:'wine',size:'750ml',volumeMl:750,quantity:10,unitPrice:1000,lineTotal:10000}];
 const offers=[{productId:'premium',name:'Premium',category:'wine',servingCategory:'wine',size:'750ml',volumeMl:750,unitCents:500000,maxQuantity:2},{productId:'different',name:'Different',category:'wine',servingCategory:'wine',size:'1L',volumeMl:1000,unitCents:1000000,maxQuantity:100}];
 const result=upgradeOccasionBudget(items,offers,{budget:100000,guests:25,categories:['wine']},{durationHours:4,adultDrinkers:25,alcoholPortionsPerDrinker:2,softPortionsPerGuest:0,waterLitresPerGuest:0});
 assert.equal(result.find(item=>item.productId==='premium').quantity,2);
 assert(!result.some(item=>item.productId==='different'));
 assert.equal(result.reduce((sum,item)=>sum+item.quantity,0),10);
 assert.equal(items[0].quantity,10);
});
