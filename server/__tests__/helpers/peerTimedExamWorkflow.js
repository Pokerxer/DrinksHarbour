const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Department = require('../../models/Department');
const User = require('../../models/User');
const Attempt = require('../../models/PeerAppraisalExamAttempt');
const Shift = require('../../models/Shift');
const Attendance = require('../../models/Attendance');
module.exports = async function timedWorkflow({ call, ownerId, ids, tenantId, foreignId, settlement = 'close' }) {
  const dept = new mongoose.Types.ObjectId();
  await Department.collection.insertOne({ _id: dept, tenant: tenantId, name: `Timed examination ${settlement}`, isActive: true });
  await User.collection.updateMany({ tenant: tenantId, _id: { $in: ids } }, { $set: { 'employeeProfile.work.department': dept } });
  const eligible = await call(ownerId, '/eligible-employees');
  assert.equal(eligible.status, 200);
  assert.equal(eligible.body.data.find(p => p.employee === String(ids[0])).department, String(dept));
  assert.equal(eligible.body.data.some(p => p.employee === String(foreignId)), false);
  assert.deepEqual(Object.keys(eligible.body.data.find(p => p.employee === String(ids[0]))).sort(), ['department', 'displayName', 'employee']);
  assert.equal((await call(ids[0], '/eligible-employees')).status, 403);
  const created = await call(ownerId, '', 'POST', { name: 'Weighted timed cycle' });
  const cycleId = created.body.data._id, path = `/${cycleId}`;
  const config = { durationMinutes: 25, attendanceFrom: '2020-03-10', attendanceTo: '2020-03-20', questionsPerEmployee: 10, departments: [String(dept)], questions: Array.from({ length: 10 }, (_, i) => ({ prompt: `Weighted ${i}`, options: ['Correct', 'Wrong'], correctOption: 0, marks: i === 0 ? 3 : 1, difficulty: i === 0 ? 'hard' : 'easy' })) };
  assert.equal((await call(ownerId, `${path}/examination`, 'PUT', { ...config, expectedRevision: 0 })).status, 200);
  assert.equal((await call(ownerId, `${path}/participants`, 'PUT', { expectedRevision: 1, participants: ids.map((employee, i) => ({ employee: String(employee), bonusAmount: 50000, isAppraiser: i < 2 })) })).status, 200);
  assert.equal((await call(ids[0], `${path}/examination/start`, 'POST')).status, 409);
  assert.equal((await call(ownerId, `${path}/launch`, 'POST')).status, 200);
  assert.equal((await call(foreignId, `${path}/examination/start`, 'POST')).status, 404);
  assert.equal((await call(ownerId, `${path}/examination/start`, 'POST')).status, 404);
  const before = (await call(ids[0], `${path}/examination`)).body.data;
  assert.equal(before.questionCount, 10);
  assert.equal(before.maxMarks, 12);
  assert.deepEqual(before.questions, []);
  assert.equal(before.startedAt, null);
  const stored = await Attempt.findOne({ tenant: tenantId, cycle: cycleId, employee: ids[0] }).lean();
  assert.equal((await call(ids[0], `${path}/examination`, 'PATCH', { expectedRevision: 0, answers: [{ question: String(stored.questionIds[0]), option: 0 }] })).status, 409);
  for (let i = 0; i < ids.length; i++) {
    const starts = await Promise.all([call(ids[i], `${path}/examination/start`, 'POST'), call(ids[i], `${path}/examination/start`, 'POST')]);
    assert.ok(starts.every(r => r.status === 200));
    const paper = starts[0].body.data;
    assert.equal(starts[1].body.data.expiresAt, paper.expiresAt);
    assert.equal(paper.revision, 1);
    assert.equal(Date.parse(paper.expiresAt) - Date.parse(paper.startedAt), 25 * 60000);
    assert.equal(JSON.stringify(paper).includes('correctOption'), false);
    const reload = (await call(ids[i], `${path}/examination`)).body.data;
    assert.equal(reload.expiresAt, paper.expiresAt);
    assert.deepEqual(reload.questions, paper.questions);
    const hard = paper.questions.find(q => q.marks === 3);
    assert.ok(hard);
    const answers = paper.questions.map(q => ({ question: q.question, option: 0 }));
    if (i === 0) {
      const saved = await call(ids[i], `${path}/examination`, 'PATCH', { expectedRevision: 1, answers: [{ question: hard.question, option: 0 }], expiresAt: '2099-01-01', score: 100 });
      assert.equal(saved.status, 200);
      assert.equal(saved.body.data.score, undefined);
      assert.equal(saved.body.data.expiresAt, paper.expiresAt);
      const yesterday = new Date(Date.now() - 86400000);
      await Attempt.collection.updateOne({ tenant: tenantId, cycle: new mongoose.Types.ObjectId(cycleId), employee: ids[i] }, { $set: { expiresAt: yesterday } });
      if (settlement === 'read') {
        const ended = (await call(ids[i], `${path}/examination`)).body.data;
        assert.equal(ended.score, 25);
        assert.equal(ended.timedOut, true);
      }
      const late = await call(ids[i], `${path}/examination/submit`, 'POST', { expectedRevision: 2, answers });
      assert.equal(late.status, 200);
      assert.equal(late.body.data.score, 25); // The late extra answers cannot earn marks.
      assert.equal(late.body.data.earnedMarks, 3);
      assert.equal(late.body.data.maxMarks, 12);
      assert.equal(late.body.data.timedOut, true);
      assert.equal(late.body.data.answers.length, 1);
      const retry = (await call(ids[i], `${path}/examination/submit`, 'POST', { expectedRevision: 0, answers })).body.data;
      assert.equal(retry.score, 25);
    } else if (i === 1) {
      assert.equal((await call(ids[i], `${path}/examination/submit`, 'POST', { expectedRevision: 1, answers: answers.slice(0, 1) })).status, 400);
      const done = (await call(ids[i], `${path}/examination/submit`, 'POST', { expectedRevision: 1, answers })).body.data;
      assert.equal(done.score, 100);
      assert.equal(done.timedOut, false);
    } else {
      await Attempt.collection.updateOne({ tenant: tenantId, cycle: new mongoose.Types.ObjectId(cycleId), employee: ids[i] }, { $set: { expiresAt: new Date(Date.now() - 86400000) } });
      // Owner close must settle this unopened page without employee participation.
    }
    if (i < 2) assert.equal((await call(ids[i], `${path}/submit`, 'POST', { expectedRevision: 0, ratings: ids.filter(x => String(x) !== String(ids[i])).map(subject => ({ subject: String(subject), rating: 4 })) })).status, 200);
    const shift = new mongoose.Types.ObjectId();
    await Shift.collection.insertOne({ _id: shift, tenant: tenantId, employee: ids[i], status: 'published', start: new Date('2020-03-15T08:00:00Z'), end: new Date('2020-03-15T16:00:00Z') });
    await Attendance.collection.insertOne({ tenant: tenantId, employee: ids[i], shift, clockIn: new Date('2020-03-15T08:00:00Z'), clockOut: new Date('2020-03-15T16:00:00Z') });
  }
  if (settlement === 'read') {
    const hr = (await call(ownerId, `${path}/participants`)).body.data;
    assert.equal(hr.examination.submitted, 3);
  }
  assert.equal((await call(ownerId, `${path}/close`, 'POST')).status, 200);
  const expired = (await call(ids[2], `${path}/examination`)).body.data;
  assert.equal(expired.timedOut, true);
  assert.equal(expired.score, 0);
  for (let i = 0; i < ids.length; i++) {
    const result = (await call(ids[i], `${path}/result`)).body.data;
    assert.equal(result.composite.examScore, [25, 100, 0][i]);
    assert.equal(result.composite.combinedScore, [68.33, 93.33, 60][i]);
    assert.equal(result.bonusMinor, [3416667, 4666667, 3000000][i]);
  }
};
