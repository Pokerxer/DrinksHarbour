'use strict';
require('dotenv').config({ quiet: true });
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { rateAttendance } = require('../services/attendanceRating.helpers');
const apply = process.argv.includes('--apply');
const tenant = new mongoose.Types.ObjectId('699165839f3308b1baeca8fc');
const employee = new mongoose.Types.ObjectId('6a744dac6c3f9673c50e81e2');
const template = new mongoose.Types.ObjectId('6a79434431078f2a39e782a8');
const weekday = date => new Date(new Date(date).getTime() + 3600000).getUTCDay();

async function main() {
  await mongoose.connect(process.env.MONGODB_URI, {
    autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000,
  });
  const db = mongoose.connection.db;
  const session = await mongoose.startSession();
  let report;
  try {
    await session.withTransaction(async () => {
      const opt = { session };
      assert(await db.collection('tenants').findOne({ _id: tenant, slug: 'wyncity' }, opt));
      assert(await db.collection('users').findOne({ _id: employee, tenant, firstName: 'Janice' }, opt));
      const shifts = await db.collection('shifts').find({ tenant, employee }, opt).sort({ start: 1 }).toArray();
      const records = await db.collection('attendances').find({ tenant, employee }, opt).toArray();
      const timeOff = await db.collection('timeoffrequests').find({ tenant, employee, status: 'approved' }, opt).toArray();
      const wrong = shifts.filter(s => s.template?.equals(template) && s.status !== 'cancelled' && [1, 2].includes(weekday(s.start)));
      const wrongIds = new Set(wrong.map(s => String(s._id)));
      const proposed = shifts.map(s => wrongIds.has(String(s._id)) ? { ...s, status: 'cancelled' } : s);
      const now = new Date();
      const before = rateAttendance({ shifts, records, timeOff }, { now });
      const after = rateAttendance({ shifts: proposed, records, timeOff }, { now });
      report = { mode: apply ? 'applied' : 'dry-run', employee: 'Janice', calculatedAt: now,
        before, after, cancelledStarts: wrong.map(s => ({ id: s._id, start: s.start, previousStatus: s.status,
          linkedPunches: records.filter(r => r.shift?.equals(s._id)).length })) };
      if (!apply || !wrong.length) return;
      for (const row of wrong) {
        const note = [row.note, 'Historical schedule correction authorized 2026-10-19: Janice does not work Monday or Tuesday starts. Original punches preserved.'].filter(Boolean).join('\n');
        const result = await db.collection('shifts').updateOne({ _id: row._id, tenant, employee, status: row.status }, {
          $set: { status: 'cancelled', note, updatedAt: now },
        }, opt);
        assert.equal(result.matchedCount, 1, 'Shift changed concurrently');
      }
      const saved = await db.collection('shifts').find({ tenant, employee }, opt).sort({ start: 1 }).toArray();
      const savedRecords = await db.collection('attendances').find({ tenant, employee }, opt).toArray();
      assert.deepEqual(savedRecords, records, 'Attendance punches changed');
      assert.equal(saved.length, shifts.length, 'Shift deleted or created');
      for (const row of saved) {
        const previous = shifts.find(s => s._id.equals(row._id));
        if (!wrongIds.has(String(row._id))) assert.deepEqual(row, previous, 'Unrelated shift changed');
        else {
          assert.equal(row.status, 'cancelled');
          assert.deepEqual({ ...row, status: previous.status, note: previous.note, updatedAt: previous.updatedAt },
            { ...previous, note: previous.note });
        }
      }
      assert.deepEqual(rateAttendance({ shifts: saved, records: savedRecords, timeOff }, { now }), after);
      const audit = await db.collection('auditlogs').insertOne({ actorRole: 'system',
        action: 'EMPLOYEE_ATTENDANCE_OFF_DAYS_CORRECT', actionCategory: 'bulk',
        targetType: 'User', targetId: employee, targetTenantId: tenant, timestamp: now,
        justification: 'User requested correcting all recorded attendance against confirmed Janice Shift 1 schedule excluding Monday/Tuesday starts.',
        changes: { before: { shifts: wrong, rating: before }, after: { rating: after, cancelledIds: [...wrongIds] } }, result: 'success',
      }, opt);
      report.auditId = audit.insertedId;
    });
    console.log(JSON.stringify(report, null, 2));
  } finally { await session.endSession(); }
}
main().catch(error => {
  console.error(error.name, error instanceof assert.AssertionError ? error.message : 'Off-day correction failed');
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());
