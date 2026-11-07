const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildPlan}=require('../scripts/correct-wine-subcategory-labels');
const definition=[{name:'German Riesling',slug:'german-riesling'}];
const parent={_id:'white',subCategories:['new','old']};
test('removes only the unnecessary English country prefix and keeps stable IDs and slugs',()=>{
 const source={_id:'new',parent:'white',slug:'german-riesling',name:'German Riesling',status:'published'};
 const [action]=buildPlan(definition,[source],[parent]);
 assert.equal(action.changes.name,'Riesling');
 assert.equal(action.source._id,'new');
 assert.equal(action.changes.slug,undefined);
 assert.equal(action.kind,'rename');
});
test('reuses existing labels and archives only the redundant new entry',()=>{
 const source={_id:'new',parent:'white',slug:'german-riesling',name:'German Riesling',status:'published'};
 const target={_id:'old',parent:'white',slug:'riesling',name:'Riesling',status:'published'};
 const [action]=buildPlan(definition,[source,target],[parent]);
 assert.equal(action.kind,'reuse');assert.equal(action.target._id,'old');
 assert.equal(action.changes.status,'archived');
 assert.equal(action.changes.name,'Riesling (superseded)');
 assert.deepEqual(buildPlan(definition,[{...source,...action.changes},target],[{...parent,subCategories:['old']}]),[]);
});
test('corrected labels are idempotent and conflicting parents fail closed',()=>{
 const source={_id:'new',parent:'white',slug:'german-riesling',name:'Riesling',metaTitle:'Riesling | DrinksHarbour',status:'published'};
 assert.deepEqual(buildPlan(definition,[source],[parent]),[]);
 assert.throws(()=>buildPlan(definition,[{...source,name:'German Riesling'},{_id:'other',parent:'red',name:'Riesling',status:'published'}],[parent]),/Conflicting/);
});
