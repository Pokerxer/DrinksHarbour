'use strict';
require('dotenv').config({ quiet: true });
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
const Shift = require('../models/Shift');
const { rateAttendance } = require('../services/attendanceRating.helpers');
const { matchShiftForClock } = require('../services/attendance.helpers');
const { tenantToday, eachDateInRange, patternDates, shiftWindow, checkAssignment } = require('../services/shift.helpers');
const apply = process.argv.includes('--apply');
const oid = value => new mongoose.Types.ObjectId(value);
const tenant = oid('699165839f3308b1baeca8fc');
const templateId = oid('6a79434431078f2a39e782a8');
const people = { Joshua: '6ac634b0cfa9a55627ed6e3b', Janice: '6a744dac6c3f9673c50e81e2',
  Faith: '6a744daa6c3f9673c50e81de', Oluchi: '6a744daf6c3f9673c50e81ec' };
const iso = value => new Date(new Date(value).getTime() + 3600000).toISOString().slice(0, 10);
const mondayOf = date => {
  const at = new Date(`${iso(date)}T00:00:00Z`);
  at.setUTCDate(at.getUTCDate() - (at.getUTCDay() + 6) % 7);
  return at.toISOString().slice(0, 10);
};
async function main() {
  await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000 });
  const db = mongoose.connection.db, session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const opt = { session }, now = new Date(), today = tenantToday(60, now);
      assert(await db.collection('tenants').findOne({ _id: tenant, slug: 'wyncity' }, opt));
      const template = await db.collection('shifttemplates').findOne({ _id: templateId, tenant }, opt);
      assert(template && template.startTime === '08:40' && template.endTime === '09:00' && template.endDayOffset === 1);
      const before = [], reports = [];
      for (const [name, id] of Object.entries(people)) {
        const employee = oid(id);
        const user = await db.collection('users').findOne({ _id: employee, tenant, firstName: name, status: 'active' }, opt);
        assert(user, `${name} identity mismatch`);
        const stored = await db.collection('shifts').find({ tenant, employee }, opt).sort({ start: 1 }).toArray();
        const records = await db.collection('attendances').find({ tenant, employee }, opt).sort({ clockIn: 1 }).toArray();
        const timeOff = await db.collection('timeoffrequests').find({ tenant, employee, status: 'approved' }, opt).toArray();
        assert(records.length, `${name} has no punches`);
        const shifts = [...stored], linked = records.map(r => ({ ...r }));
        const range = { start: new Date(`${mondayOf(records[0].clockIn)}T00:00:00+01:00`), end: new Date(`${today}T23:59:59.999+01:00`) };
        let policy = user.employeeProfile?.planning?.attendancePolicy;
        const change = { employee, name, originalShifts: [], createdShiftIds: [], originalRecords: [], policyBefore: policy || null };
        if (name === 'Joshua') {
          const pattern = patternDates(template, eachDateInRange('2026-10-07', today));
          assert(pattern.ok);
          for (const date of pattern.dates) {
            const window = shiftWindow(date, template.startTime, template.endTime, 60, template.endDayOffset);
            const matches = shifts.filter(s => new Date(s.start).getTime() === window.start.getTime() && s.status !== 'cancelled');
            assert(matches.length <= 1, 'Duplicate Joshua shift starts');
            const existing = matches[0];
            const candidate = new Shift({ ...(existing || {}), tenant, employee, template: templateId,
              role: template.role, templatePosition: null, department: template.department, ...window,
              status: 'published', publishedAt: existing?.publishedAt || now, breakMinutes: template.breakMinutes,
              note: 'Historical schedule correction: Joshua started Shift 1 on 7 October, confirmed by user 2026-10-19. Actual punches retained.',
            }).toObject();
            assert.equal(new Shift(candidate).validateSync(), undefined);
            assert(checkAssignment(candidate, user, { shifts: shifts.filter(s => !s._id.equals(candidate._id)), timeOff }).ok, 'Joshua overlap/leave/role conflict');
            if (existing) {
              shifts[shifts.indexOf(existing)] = candidate;
              change.originalShifts.push(existing);
              if (apply) assert.equal((await db.collection('shifts').replaceOne({ tenant, employee, _id: existing._id }, { ...candidate, updatedAt: now }, opt)).matchedCount, 1);
            } else {
              shifts.push(candidate);
              change.createdShiftIds.push(candidate._id);
              if (apply) await db.collection('shifts').insertOne({ ...candidate, createdAt: now, updatedAt: now }, opt);
            }
          }
        } else if (name === 'Janice') {
          const firstDay = new Date(`${iso(records[0].clockIn)}T00:00:00+01:00`);
          for (const row of stored) {
            const weekday = new Date(row.start.getTime() + 3600000).getUTCDay();
            if (row.status !== 'draft' || !row.template?.equals(templateId) || [1, 2].includes(weekday) || row.start < firstDay || row.end > now) continue;
            const candidate = { ...row, status: 'published', publishedAt: now,
              note: [row.note, 'Historical score repair: confirmed Janice Shift 1 schedule excluding Monday/Tuesday; original punches retained.'].filter(Boolean).join('\n') };
            change.originalShifts.push(row);
            shifts[shifts.indexOf(row)] = candidate;
            if (apply) assert.equal((await db.collection('shifts').replaceOne({ tenant, employee, _id: row._id, status: 'draft' }, { ...candidate, updatedAt: now }, opt)).matchedCount, 1);
          }
        } else if (name === 'Faith' || name === 'Oluchi') {
          policy = { type: 'weekly_quota', daysPerWeek: 4, startTime: '08:40', endTime: '17:00', effectiveFrom: mondayOf(records[0].clockIn) };
          if (apply) assert.equal((await db.collection('users').updateOne({ tenant, _id: employee }, {
            $set: { 'employeeProfile.planning.attendancePolicy': policy, updatedAt: now },
          }, opt)).matchedCount, 1);
        }
        if (name === 'Joshua' || name === 'Janice') {
          for (const record of linked) {
            if (record.shift) continue;
            const match = matchShiftForClock(record.clockIn, shifts);
            if (!match) continue;
            change.originalRecords.push(records.find(r => r._id.equals(record._id)));
            record.shift = match._id;
            if (apply) assert.equal((await db.collection('attendances').updateOne({ tenant, employee, _id: record._id, shift: null }, {
              $set: { shift: match._id, updatedAt: now, note: [record.note, 'Shift linkage repaired by system against user-confirmed Shift 1 schedule. Clock times unchanged.'].filter(Boolean).join('\n') },
            }, opt)).matchedCount, 1);
          }
        }
        const rating = rateAttendance({ shifts: shifts.filter(s => s.status !== 'cancelled'), records: linked, timeOff, policy }, { now, range, offsetMinutes: 60 });
        if (apply) {
          const savedRecords = await db.collection('attendances').find({ tenant, employee }, opt).sort({ clockIn: 1 }).toArray();
          assert.equal(savedRecords.length, records.length);
          savedRecords.forEach((r, i) => {
            assert.deepEqual(r.clockIn, records[i].clockIn); assert.deepEqual(r.clockOut, records[i].clockOut);
            assert.equal(r.source, records[i].source); assert.equal(r.status, records[i].status);
            assert.equal(r.minutesWorked, records[i].minutesWorked);
          });
          const savedShifts = await db.collection('shifts').find({ tenant, employee }, opt).toArray();
          assert.deepEqual(rateAttendance({ shifts: savedShifts.filter(s => s.status !== 'cancelled'), records: savedRecords, timeOff, policy }, { now, range, offsetMinutes: 60 }), rating);
        }
        const multiDay = linked.filter(r => r.clockOut && new Date(r.clockOut) - new Date(r.clockIn) > (name === 'Faith' || name === 'Oluchi' ? 16 : 30) * 3600000);
        reports.push({ name, policy: policy || null, rating, linkedRecords: change.originalRecords.length,
          review: multiDay.map(r => ({ id: r._id, clockIn: r.clockIn, clockOut: r.clockOut })) });
        before.push(change);
      }
      result = { mode: apply ? 'applied' : 'dry-run', calculatedAt: now, reports,
        deployment: 'Weekly quota evaluator is local code; existing deployed API needs these code changes before Faith/Oluchi dashboard scores update.' };
      if (apply) {
        const audit = await db.collection('auditlogs').insertOne({ actorRole: 'system', action: 'EMPLOYEE_ATTENDANCE_SCORE_REPAIR', actionCategory: 'bulk',
          targetType: 'Tenant', targetId: tenant, targetTenantId: tenant, timestamp: now, result: 'success',
          justification: 'User requested all recorded attendance scores; confirmed Joshua start Oct7 and four required days per completed week for Faith/Oluchi.',
          changes: { before, after: result },
        }, opt);
        result.auditId = audit.insertedId;
      }
    });
    if (apply) {
      const rows = result.reports.map(r => `| ${r.name} | ${r.rating.score ?? 'Unrated'} | ${r.rating.counts.attended} | ${r.rating.counts.expected} | ${r.rating.counts.absent} |`).join('\n');
      const details = result.reports.map(r => {
        const policy = r.policy ? `Four weekdays/week, ${r.policy.startTime}–${r.policy.endTime}; coverage from ${r.policy.effectiveFrom}. Only complete weeks count. Requires deployment for dashboard display.` : 'Published-shift scoring; underlying live records corrected.';
        const weeks = r.rating.weeklySummary?.weeks || [];
        const weekly = weeks.length ? `\n\n| Week start | Required | Credited | Missed |\n|---|---:|---:|---:|\n${weeks.map(w => `| ${w.from} | ${w.required} | ${w.attended} | ${w.missed} |`).join('\n')}` : '';
        const review = r.review.length ? `\n\nRecords requiring review (UTC):\n\n| Record | Clock-in | Clock-out |\n|---|---|---|\n${r.review.map(p => `| ${p.id} | ${new Date(p.clockIn).toISOString()} | ${new Date(p.clockOut).toISOString()} |`).join('\n')}` : '';
        return `## ${r.name}\n\n${policy}\n\n${r.rating.counts.onTime} on-time; ${r.rating.counts.late} late; ${r.rating.counts.earlyLeave} early departures. ${r.linkedRecords} punch links repaired.${weekly}${review}`;
      }).join('\n\n');
      fs.writeFileSync(path.resolve(__dirname, '../../docs/reports/wyncity-attendance-scores-2026-10-19.md'),
        `# Wyn City all-history attendance scores\n\nCalculated ${result.calculatedAt.toISOString()}. Audit ${result.auditId}.\n\n| Employee | Score /100 | Attended | Expected | Absent |\n|---|---:|---:|---:|---:|\n${rows}\n\n${result.deployment}\n\nClock-in/out times, sources, statuses and worked minutes were preserved. Long records below require manager review, not guessed corrections.\n\n${details}\n`);
    }
    console.log(JSON.stringify(result, null, 2));
  } finally { await session.endSession(); }
}
main().catch(error => {
  console.error(error.name, error instanceof assert.AssertionError ? error.message : 'Attendance repair failed');
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());
