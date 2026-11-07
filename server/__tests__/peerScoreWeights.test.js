const test=require('node:test');
const assert=require('node:assert/strict');
const {combineResult}=require('../services/peerAppraisal/exam-rules');
const {resultView}=require('../services/peerAppraisal/queries');
test('attendance contributes20% with40% each for appraisal and examination',()=>{
 const result=combineResult({ratings:[4,4],attendanceScore:100,exam:{correctCount:9,questionCount:10},allocationMinor:5000000});
 assert.equal(result.combinedScore,88);assert.equal(result.bonusMinor,4400000);
 assert.deepEqual(result.weights,{appraisal:40,exam:40,attendance:20});
});
test('employees without exams use80% appraisal and20% attendance',()=>{
 const result=combineResult({ratings:[4],attendanceScore:100,allocationMinor:5000000});
 assert.equal(result.combinedScore,84);assert.equal(result.bonusMinor,4200000);
 assert.deepEqual(result.weights,{appraisal:80,exam:0,attendance:20});
 assert.equal(combineResult({ratings:[5],attendanceScore:0,allocationMinor:100}).combinedScore,80);
});
test('weight snapshots survive projection while legacy closed results retain their stored values',()=>{
 const weights={appraisal:40,exam:40,attendance:20};
 const person={allocationMinor:10000,result:{averageScore:4,ratingCount:3,bonusMinor:8800,composite:{appraisalScore:80,attendanceScore:100,examScore:90,combinedScore:88,weights}}};
 assert.deepEqual(resultView(person).composite.weights,weights);
 delete person.result.composite.weights;person.result.composite.combinedScore=90;
 assert.equal(resultView(person).composite.combinedScore,90);
 assert.equal(resultView(person).composite.weights,undefined);
});
