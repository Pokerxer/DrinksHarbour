const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Tenant = require('../../models/Tenant');
const User = require('../../models/User');
const Department = require('../../models/Department');
const Shift = require('../../models/Shift');
const Attendance = require('../../models/Attendance');
module.exports = async function personalized({ call, ownerId, ids, tenantId }) {
  const created = await call(ownerId, '', 'POST', { name: 'Personalized bank cycle' });
  const id = created.body.data._id, path = `/${id}`;
  const bankPath = `${path}/examination/bank/wyn-city-drinks-30`;
  assert.equal((await call(ownerId, bankPath)).status, 404); // Another business cannot load the private source.
  assert.equal((await call(ids[0], bankPath)).status, 403);
  assert.equal((await call(ids[0], `${path}/examination/generate`, 'POST', { topic: 'Drinks', count: 30 })).status, 403);
  assert.equal((await call(ownerId, `${path}/examination/generate`, 'POST', { topic: '', count: 1 })).status, 400);
  await Tenant.collection.updateOne({ _id: tenantId }, { $set: { slug: 'wyncity' } });
  const loaded = await call(ownerId, bankPath);
  assert.equal(loaded.status, 200);
  assert.equal(loaded.body.data.questions.length, 30);
  const department = new mongoose.Types.ObjectId();
  await Department.collection.insertOne({ _id: department, tenant: tenantId, name: 'Bank examination', isActive: true });
  await User.collection.updateMany({ _id: { $in: ids }, tenant: tenantId }, { $set: { 'employeeProfile.work.department': department } });
  const config = { ...loaded.body.data, attendanceFrom: '2020-02-10', attendanceTo: '2020-02-20', departments: [String(department)] };
  assert.equal((await call(ownerId, `${path}/examination`, 'PUT', { ...config, expectedRevision: 0 })).status, 200);
  assert.equal((await call(ownerId, `${path}/participants`, 'PUT', { expectedRevision: 1, participants: ids.map((employee, i) => ({ employee: String(employee), bonusAmount: 50000, isAppraiser: i < 2 })) })).status, 200);
  assert.equal((await call(ownerId, `${path}/launch`, 'POST')).status, 200);
  const hr = (await call(ownerId, `${path}/participants`)).body.data;
  assert.equal(hr.examination.questionsPerEmployee, 10);
  assert.equal(hr.examination.attendanceFrom, '2020-02-10');
  const correct = new Map(hr.examination.questions.map(q => [q.question, q.correctOption]));
  for (let i = 0; i < ids.length; i++) {
    const mine = (await call(ids[i], `${path}/examination`)).body.data;
    assert.equal(mine.questions.length, 10);
    assert.equal(new Set(mine.questions.map(q => q.question)).size, 10);
    assert.equal(mine.maxMarks, 20);
    assert.equal(JSON.stringify(mine).includes('correctOption'), false);
    assert.deepEqual((await call(ids[i], `${path}/examination`)).body.data.questions, mine.questions);
    const unassigned = hr.examination.questions.find(q => !mine.questions.some(m => m.question === q.question));
    assert.equal((await call(ids[i], `${path}/examination`, 'PATCH', { expectedRevision: 0, answers: [{ question: unassigned.question, option: 0 }] })).status, 400);
    const answers = mine.questions.map((q, j) => ({ question: q.question, option: i === 0 && j === 0 ? (correct.get(q.question) + 1) % 4 : correct.get(q.question) }));
    assert.equal((await call(ids[i], `${path}/examination`, 'PATCH', { expectedRevision: 0, answers: answers.slice(0, 2) })).status, 200);
    assert.deepEqual((await call(ids[i], `${path}/examination`)).body.data.questions, mine.questions);
    const submitted = await call(ids[i], `${path}/examination/submit`, 'POST', { expectedRevision: 1, answers });
    assert.equal(submitted.status, 200);
    assert.equal(submitted.body.data.score, i === 0 ? 90 : 100);
    assert.equal(submitted.body.data.earnedMarks, i === 0 ? 18 : 20);
    assert.equal(submitted.body.data.maxMarks, 20);
    if (i < 2) assert.equal((await call(ids[i], `${path}/submit`, 'POST', { expectedRevision: 0, ratings: ids.filter(p => String(p) !== String(ids[i])).map(p => ({ subject: String(p), rating: 4 })) })).status, 200);
    const shift = new mongoose.Types.ObjectId();
    await Shift.collection.insertMany([
      { _id: shift, tenant: tenantId, employee: ids[i], status: 'published', start: new Date('2020-02-15T08:00:00Z'), end: new Date('2020-02-15T16:00:00Z') },
      { tenant: tenantId, employee: ids[i], status: 'published', start: new Date('2020-02-25T08:00:00Z'), end: new Date('2020-02-25T16:00:00Z') },
    ]);
    await Attendance.collection.insertOne({ tenant: tenantId, employee: ids[i], shift, clockIn: new Date('2020-02-15T08:00:00Z'), clockOut: new Date('2020-02-15T16:00:00Z') });
  }
  assert.equal((await call(ownerId, `${path}/close`, 'POST')).status, 200);
  for (let i = 0; i < ids.length; i++) {
    const result = (await call(ids[i], `${path}/result`)).body.data;
    assert.equal(result.composite.attendanceScore, 100); // The missed shift outside the selected range does not count.
    assert.equal(result.composite.attendanceFrom, '2020-02-10');
    assert.equal(result.composite.attendanceTo, '2020-02-20');
    assert.equal(result.composite.combinedScore, i === 0 ? 90 : 93.33);
    assert.equal(result.bonusMinor, i === 0 ? 4500000 : 4666667);
  }
};
