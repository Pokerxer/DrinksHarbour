'use strict';
require('dotenv').config({ quiet: true });
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { rateAttendance } = require('../services/attendanceRating.helpers');
const oid = value => new mongoose.Types.ObjectId(value);
const tenant = oid('699165839f3308b1baeca8fc');
const people = { Joshua: ['6ac634b0cfa9a55627ed6e3b', 72], Janice: ['6a744dac6c3f9673c50e81e2', 79],
  Faith: ['6a744daa6c3f9673c50e81de', 85], Oluchi: ['6a744daf6c3f9673c50e81ec', 89] };
async function main() {
  await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000 });
  const db = mongoose.connection.db, scores = [];
  for (const [name, [id, expectedScore]] of Object.entries(people)) {
    const employee = oid(id);
    const user = await db.collection('users').findOne({ _id: employee, tenant, firstName: name });
    assert(user);
    const shifts = await db.collection('shifts').find({ tenant, employee, status: { $ne: 'cancelled' } }).toArray();
    const records = await db.collection('attendances').find({ tenant, employee }).toArray();
    const timeOff = await db.collection('timeoffrequests').find({ tenant, employee, status: 'approved' }).toArray();
    const rating = rateAttendance({ shifts, records, timeOff, policy: user.employeeProfile?.planning?.attendancePolicy }, {
      now: new Date(), offsetMinutes: 60,
      range: { start: new Date('2026-07-31T23:00:00Z'), end: new Date('2026-10-19T23:00:00Z') },
    });
    assert.equal(rating.score, expectedScore, `${name} score mismatch`);
    if (name === 'Janice') {
      const relevant = shifts.filter(s => s.template?.equals(oid('6a79434431078f2a39e782a8')));
      assert(relevant.every(s => ![1, 2].includes(new Date(s.start.getTime() + 3600000).getUTCDay())));
    }
    scores.push({ name, score: rating.score, expected: rating.counts.expected, attended: rating.counts.attended, absent: rating.counts.absent });
  }
  let verifiedPunches = 0;
  for (const id of ['6ad671894431a39b8e2a67aa', '6ad672461020ce9c79cd01cc']) {
    const audit = await db.collection('auditlogs').findOne({ _id: oid(id), targetTenantId: tenant });
    assert(audit);
    for (const person of audit.changes.before) for (const original of person.originalRecords) {
      const saved = await db.collection('attendances').findOne({ _id: original._id, tenant, employee: person.employee });
      assert(saved);
      for (const key of ['clockIn', 'clockOut', 'source', 'status', 'minutesWorked']) assert.deepEqual(saved[key], original[key]);
      verifiedPunches++;
    }
  }
  assert.equal(verifiedPunches, 8);
  console.log(JSON.stringify({ independentReadback: true, verifiedUnchangedPunches: verifiedPunches, scores }, null, 2));
}
main().catch(error => {
  console.error(error.name, error instanceof assert.AssertionError ? error.message : 'Independent score verification failed');
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());
