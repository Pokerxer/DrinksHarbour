const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const User = require('../../models/User');
const Department = require('../../models/Department');
const Shift = require('../../models/Shift');
const Attendance = require('../../models/Attendance');
module.exports = async function selectedRecipients({ call, ownerId, ids, tenantId, foreignId }) {
  const dept = new mongoose.Types.ObjectId(), other = new mongoose.Types.ObjectId();
  await Department.collection.insertMany([{_id:dept,tenant:tenantId,name:'Selected exam recipients',isActive:true},{_id:other,tenant:tenantId,name:'Excluded exam recipients',isActive:true}]);
  await User.collection.updateMany({_id:{$in:ids}},{$set:{'employeeProfile.work.department':dept}});
  const id = (await call(ownerId,'','POST',{name:'Selected exam employees'})).body.data._id, path=`/${id}`;
  const participants=ids.map(employee=>({employee:String(employee),bonusAmount:100,isAppraiser:true}));
  const input={attendanceMonth:'2019-02',departments:[String(dept)],recipientIds:[String(ids[0])],questions:[{prompt:'Selected?',options:['Yes','No'],correctOption:0}]};
  assert.equal((await call(ownerId,`${path}/participants`,'PUT',{participants,expectedRevision:0})).status,200);
  for (const recipientIds of [[],[String(foreignId)],[String(ownerId)],[String(ids[0]),String(ids[0])]]) {
    assert.equal((await call(ownerId,`${path}/examination`,'PUT',{...input,recipientIds,expectedRevision:1})).status,400);
  }
  await User.collection.updateOne({_id:ids[0]},{$set:{'employeeProfile.work.department':other}});
  assert.equal((await call(ownerId,`${path}/examination`,'PUT',{...input,expectedRevision:1})).status,400);
  await User.collection.updateOne({_id:ids[0]},{$set:{'employeeProfile.work.department':dept}});
  assert.equal((await call(ownerId,`${path}/examination`,'PUT',{...input,expectedRevision:1})).status,200);
  assert.deepEqual((await call(ownerId,`${path}/participants`)).body.data.examination.recipientIds,input.recipientIds);
  // Department changes invalidate the chosen recipient, without launching a partial cycle.
  await User.collection.updateOne({_id:ids[0]},{$set:{'employeeProfile.work.department':other}});
  assert.equal((await call(ownerId,`${path}/launch`,'POST')).status,400);
  await User.collection.updateOne({_id:ids[0]},{$set:{'employeeProfile.work.department':dept}});
  // Removing a recipient from the saved roster must also block launch.
  assert.equal((await call(ownerId,`${path}/participants`,'PUT',{participants:participants.slice(1),expectedRevision:2})).status,200);
  assert.equal((await call(ownerId,`${path}/launch`,'POST')).status,400);
  assert.equal((await call(ownerId,`${path}/participants`,'PUT',{participants,expectedRevision:3})).status,200);
  assert.equal((await call(ownerId,`${path}/launch`,'POST')).status,200);
  const mine=(await call(ids[0],`${path}/examination`)).body.data;
  assert.equal(mine.assigned,true);
  assert.equal((await call(ids[1],`${path}/examination`)).body.data.assigned,false);
  assert.equal((await call(ids[1],`${path}/examination/submit`,'POST',{answers:[],expectedRevision:0})).status,403);
  for (const employee of ids) {
    const ratings=ids.filter(x=>String(x)!==String(employee)).map(subject=>({subject:String(subject),rating:4}));
    assert.equal((await call(employee,`${path}/submit`,'POST',{ratings,expectedRevision:0})).status,200);
    const shift=new mongoose.Types.ObjectId();
    await Shift.collection.insertOne({_id:shift,tenant:tenantId,employee,status:'published',start:new Date('2019-02-15T08:00:00Z'),end:new Date('2019-02-15T16:00:00Z')});
    await Attendance.collection.insertOne({tenant:tenantId,employee,shift,clockIn:new Date('2019-02-15T08:00:00Z'),clockOut:new Date('2019-02-15T16:00:00Z')});
  }
  assert.equal((await call(ownerId,`${path}/close`,'POST')).status,409);
  assert.equal((await call(ids[0],`${path}/examination/submit`,'POST',{answers:mine.questions.map(q=>({question:q.question,option:0})),expectedRevision:0})).status,200);
  assert.equal((await call(ownerId,`${path}/close`,'POST')).status,200);
  const progress=(await call(ownerId,`${path}/participants`)).body.data;
  assert.equal(progress.examination.assigned,1);
  assert.equal(progress.examination.submitted,1);
  for (let i=0;i<ids.length;i++) {
    const result=(await call(ids[i],`${path}/result`)).body.data;
    assert.equal(result.composite.examScore,i===0?100:undefined);
    assert.equal(result.composite.combinedScore,i===0?93.33:90);
    assert.equal(result.bonusMinor,i===0?9333:9000);
  }
};
