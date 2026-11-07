const test=require('node:test');const assert=require('node:assert/strict');

test('service capacity uses catalogue volume and declared pours, separating water from alcoholic portions',()=>{
 const {assessOccasionPlan}=require('../utils/occasionPlanAssessment');
 const items=[
  {category:'wine',volumeMl:750,quantity:10,lineTotal:100000},
  {category:'spirits',volumeMl:750,quantity:2,lineTotal:40000},
  {category:'beer',volumeMl:440,quantity:3,lineTotal:3000},
  {category:'alcohol-free',volumeMl:1000,quantity:12,lineTotal:24000},
  {category:'water',volumeMl:500,quantity:20,lineTotal:1000},
 ];
 const result=assessOccasionPlan(items,{budget:200000,guests:30,categories:['wine','spirits','beer','alcohol-free']});
 assert.equal(result.coverage.portions.wine,50);assert.equal(result.coverage.portions.spirits,60);
 assert.equal(result.coverage.portions.beer,3);assert.equal(result.coverage.portions['alcohol-free'],48);
 assert.equal(result.coverage.waterLitres,10);assert.equal(result.coverage.requiresConfirmation,true);
 assert.equal(result.budget.spent,168000);assert.equal(result.budget.remaining,32000);assert.equal(result.budget.usedPercent,84);
});
test('unknown or ambiguous pack volumes are never converted to invented serving counts',()=>{
 const {volumeInMl,assessOccasionPlan}=require('../utils/occasionPlanAssessment');
 assert.equal(volumeInMl('75cl'),750);assert.equal(volumeInMl('can-440ml'),440);assert.equal(volumeInMl('1.5L'),1500);
 assert.equal(volumeInMl('case of12 x750ml'),null);assert.equal(volumeInMl('unknown'),null);
 const result=assessOccasionPlan([{category:'wine',volumeMl:null,quantity:20,lineTotal:1000}],{budget:2000,guests:100,categories:['wine']});
 assert.equal(result.coverage.unknownVolumes,1);assert.equal(result.coverage.portions.wine,0);
});

test('ready-to-drink cocktails count as sealed drinks and provisional targets expose overstock',()=>{
 const {assessOccasionPlan}=require('../utils/occasionPlanAssessment');
 const result=assessOccasionPlan([{category:'spirits',servingCategory:'ready-to-drink',volumeMl:275,quantity:20,lineTotal:199900}],{budget:200000,guests:30,categories:['spirits']},{durationHours:4,adultDrinkers:10,alcoholPortionsPerDrinker:1,softPortionsPerGuest:2,waterLitresPerGuest:1});
 assert.equal(result.coverage.portions['ready-to-drink'],20);assert.equal(result.coverage.portions.spirits,0);
 assert.equal(result.coverage.alcoholTarget,10);assert.equal(result.coverage.possibleOverstock,true);
 assert.equal(result.budget.usedPercent,99.95);
});
