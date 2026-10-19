const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const User = require('../../models/User');
const Department = require('../../models/Department');
const Shift = require('../../models/Shift');
const Attendance = require('../../models/Attendance');
const P = require('../../models/PeerAppraisalParticipant');
module.exports = async function examWorkflow({ call, ownerId, ids, tenantId, foreignId, foreignTenant }) {
  const dept = new mongoose.Types.ObjectId(), other = new mongoose.Types.ObjectId(), foreignDept = new mongoose.Types.ObjectId();
  await Department.collection.insertMany([{ _id: dept, tenant: tenantId, name: 'Exam department', isActive: true }, { _id: other, tenant: tenantId, name: 'Other department', isActive: true }, { _id: foreignDept, tenant: foreignTenant, name: 'Foreign', isActive: true }]);
  for (let i = 0; i < ids.length; i++) await User.collection.updateOne({ _id: ids[i] }, { $set: { 'employeeProfile.work.department': i === 0 ? dept : other } });
  const created = await call(ownerId, '', 'POST', { name: 'Exam combined cycle' });
  const id = created.body.data._id, path = `/${id}`;
  const input = { attendanceMonth: '2020-01', departments: [String(dept)], questions: [{ prompt: 'Correct option?', options: ['Wrong', 'Correct'], correctOption: 1 }, { prompt: 'Another?', options: ['Correct', 'Wrong'], correctOption: 0 }] };
  assert.equal((await call(ids[0], `${path}/examination`, 'PUT', { ...input, expectedRevision: 0 })).status, 403);
  assert.equal((await call(ownerId, `${path}/examination`, 'PUT', { ...input, departments: [String(foreignDept)], expectedRevision: 0 })).status, 400);
  const config = await call(ownerId, `${path}/examination`, 'PUT', { ...input, expectedRevision: 0 });
  assert.equal(config.status, 200);
  assert.equal((await call(ownerId, `${path}/examination`, 'PUT', { ...input, expectedRevision: 0 })).status, 409);
  await call(ownerId, `${path}/participants`, 'PUT', { expectedRevision: 1, participants: ids.map((employee, i) => ({ employee: String(employee), bonusAmount: 50000, isAppraiser: i < 2 })) });
  assert.equal((await call(ownerId, `${path}/launch`, 'POST')).status, 200);
  assert.equal((await call(ownerId, `${path}/examination`, 'PUT', { ...input, expectedRevision: 3 })).status, 409);
  const mine = (await call(ids[0], `${path}/examination`)).body.data;
  assert.equal(mine.assigned, true);
  assert.equal(mine.questions.length, 2);
  assert.equal(JSON.stringify(mine).includes('correctOption'), false);
  assert.equal((await call(ids[1], `${path}/examination`)).body.data.assigned, false);
  assert.equal((await call(foreignId, `${path}/examination`)).status, 404);
  assert.equal((await call(ids[1], `${path}/examination/submit`, 'POST', { answers: [], expectedRevision: 0 })).status, 403);
  assert.equal((await call(ids[0], `${path}/examination/submit`, 'POST', { answers: [], expectedRevision: 0 })).status, 400);
  const answers = mine.questions.map((q, i) => ({ question: q.question, option: 1 }));
  const draft = await call(ids[0], `${path}/examination`, 'PATCH', { answers: answers.slice(0, 1), expectedRevision: 0 });
  assert.equal(draft.status, 200);
  assert.equal(draft.body.data.score, undefined);
  assert.equal(draft.body.data.correctCount, undefined);
  assert.equal((await call(ids[0], `${path}/review`)).body.data.hasExamination, true);
  assert.equal((await call(ids[0], '/my')).body.data.find(c => c._id === id).examAssigned, true);
  assert.equal((await call(ids[0], `${path}/examination`, 'PATCH', { answers, expectedRevision: 0 })).status, 409);
  for (let i = 0; i < 2; i++) {
    const ratings = ids.filter(x => String(x) !== String(ids[i])).map(subject => ({ subject: String(subject), rating: 4 }));
    assert.equal((await call(ids[i], `${path}/submit`, 'POST', { ratings, expectedRevision: 0 })).status, 200);
  }
  const noExam = await call(ownerId, `${path}/close`, 'POST');
  assert.equal(noExam.status, 409);
  assert.match(noExam.body.message, /examination/i);
  const submitted = await call(ids[0], `${path}/examination/submit`, 'POST', { answers, expectedRevision: 1, score: 100, correctCount: 2 });
  assert.equal(submitted.status, 200);
  assert.equal(submitted.body.data.score, 50);
  assert.equal((await call(ids[0], `${path}/result`)).status, 409);
  assert.equal((await call(ownerId, `${path}/participants`)).body.data.participants.some(p => p.result), false);
  assert.equal((await call(ownerId, `${path}/close`, 'POST')).status, 409); // no roster = unrated, not zero
  assert.equal(await P.countDocuments({ cycle: id, result: { $exists: true } }), 0);
  for (const employee of ids) {
    const shift = new mongoose.Types.ObjectId();
    await Shift.collection.insertOne({ _id: shift, tenant: tenantId, employee, status: 'published', start: new Date('2020-01-15T08:00:00Z'), end: new Date('2020-01-15T16:00:00Z') });
    await Attendance.collection.insertOne({ tenant: tenantId, employee, shift, clockIn: new Date('2020-01-15T08:00:00Z'), clockOut: new Date('2020-01-15T16:00:00Z') });
  }
  const progress = (await call(ownerId, `${path}/participants`)).body.data;
  assert.equal(progress.examination.assigned, 1);
  assert.equal(progress.examination.submitted, 1);
  assert.equal((await call(ownerId, `${path}/close`, 'POST')).status, 200);
  const all = (await call(ownerId, `${path}/participants`)).body.data.participants;
  assert.equal(all.length, 3);
  for (let i = 0; i < ids.length; i++) {
    const result = (await call(ids[i], `${path}/result`)).body.data;
    assert.equal(result.composite.attendanceScore, 100);
    assert.equal(result.composite.appraisalScore, 80);
    assert.equal(result.composite.combinedScore, i === 0 ? 76.67 : 90);
    assert.equal(result.bonusMinor, i === 0 ? 3833333 : 4500000);
    assert.equal(result.composite.examScore, i === 0 ? 50 : undefined);
    assert.equal(result.composite.attendanceMonth, '2020-01');
  }
  const frozen = (await call(ids[0], `${path}/result`)).body.data;
  await Attendance.collection.updateMany({ tenant: tenantId, employee: ids[0] }, { $unset: { clockOut: '' } });
  assert.deepEqual((await call(ids[0], `${path}/result`)).body.data, frozen);
  assert.equal((await call(ids[0], `${path}/examination/submit`, 'POST', { answers, expectedRevision: 1 })).status, 200);
  assert.equal((await call(ids[0], `${path}/examination/submit`, 'POST', { answers: answers.map(a => ({ ...a, option: 0 })), expectedRevision: 2 })).status, 409);
};
