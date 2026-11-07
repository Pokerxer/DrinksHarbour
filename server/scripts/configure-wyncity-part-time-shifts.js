'use strict';
// Operational configuration only. No attendance records or past shifts are edited.
require('dotenv').config({ quiet: true });
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const ShiftTemplate = require('../models/ShiftTemplate');
const Shift = require('../models/Shift');
const { checkAssignment, tenantToday, parseRosterRange, patternDates } = require('../services/shift.helpers');
const apply = process.argv.includes('--apply');
const oid = value => new mongoose.Types.ObjectId(value);
const tenant = oid('699165839f3308b1baeca8fc');
const shift1 = oid('6a79434431078f2a39e782a8');
const attendant = oid('6a774a5dce8af457bda4194f');
const marketer = oid('6a7c4852aacfa77c7e82fda2');
const ids = {
  Joshua: oid('6ac634b0cfa9a55627ed6e3b'), Janice: oid('6a744dac6c3f9673c50e81e2'),
  Faith: oid('6a744daa6c3f9673c50e81de'), Oluchi: oid('6a744daf6c3f9673c50e81ec'),
};
const templateName = 'Wyn City Faith & Oluchi - 4 chosen weekdays';
const localDay = value => new Date(new Date(value).getTime() + 3600000).getUTCDay();

async function main() {
  await mongoose.connect(process.env.MONGODB_URI, {
    autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000,
  });
  const db = mongoose.connection.db;
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const opt = { session };
      assert(await db.collection('tenants').findOne({ _id: tenant, slug: 'wyncity', name: 'Wyn City' }, opt));
      const users = await db.collection('users').find({ tenant, _id: { $in: Object.values(ids) } }, opt)
        .project({ firstName: 1, status: 1, 'employeeProfile.planning': 1, 'employeeProfile.work.note': 1 }).toArray();
      for (const [name, id] of Object.entries(ids)) {
        assert(users.some(u => u._id.equals(id) && u.firstName === name && u.status === 'active'), `${name} identity changed`);
      }
      const roles = await db.collection('employeeroles').find({ tenant, _id: { $in: [attendant, marketer] }, isActive: true }, opt).toArray();
      assert.equal(roles.length, 2);
      const template = await db.collection('shifttemplates').findOne({ tenant, _id: shift1 }, opt);
      assert(template && template.name === 'Wyn city Attendants shift 1');
      assert.equal(template.recurrence, 'cycle');
      assert.equal(template.cycleLength, 2);
      assert.deepEqual(template.cycleDays, [0]);
      const today = tenantToday(60);
      const range = parseRosterRange({ from: today, to: today }, 60);
      assert(range.ok);
      const future = { tenant, start: { $gte: range.start }, status: { $ne: 'cancelled' } };
      const roster = await db.collection('shifts').find({ ...future, template: shift1 }, opt).sort({ start: 1 }).toArray();
      assert(roster.length, 'No existing future Shift 1 roster to follow');
      const joshua = users.find(u => u._id.equals(ids.Joshua));
      const planning = joshua.employeeProfile?.planning || {};
      const qualifiedJoshua = { ...joshua, employeeProfile: { planning: { ...planning, roles: [...(planning.roles || []), attendant] } } };
      const contexts = await db.collection('shifts').find({ ...future, employee: ids.Joshua }, opt).toArray();
      const timeOff = await db.collection('timeoffrequests').find({ tenant, employee: ids.Joshua, status: 'approved' }, opt).toArray();
      const byDate = new Map();
      for (const row of roster) if (!byDate.has(row.start.toISOString())) byDate.set(row.start.toISOString(), row);
      const newShifts = [];
      for (const source of byDate.values()) {
        if (contexts.some(s => s.template?.equals(shift1) && s.start.getTime() === source.start.getTime())) continue;
        const row = new Shift({ tenant, template: shift1, employee: ids.Joshua, role: attendant,
          templatePosition: null, department: template.department, start: source.start, end: source.end,
          breakMinutes: template.breakMinutes, status: 'draft', note: 'Joshua assigned to existing Shift 1 rotation, per user request 2026-10-19.' });
        assert.equal(row.validateSync(), undefined);
        const candidate = row.toObject();
        const check = checkAssignment(candidate, qualifiedJoshua, { shifts: [...contexts, ...newShifts], timeOff });
        assert(check.ok, `Joshua assignment refused: ${check.code}`);
        newShifts.push(candidate);
      }
      const cancelled = roster.filter(s => s.employee?.equals(ids.Janice) && [1, 2].includes(localDay(s.start)));
      const positions = template.positions.map(p => ({ ...p }));
      const position = positions.find(p => p.roles.some(r => r.equals(attendant)) && p._id == null);
      assert(position, 'Legacy Attendant position not found');
      assert([6, 7].includes(position.count), 'Capacity changed; inspect before proceeding');
      position.count = 7;
      const existing = await db.collection('shifttemplates').findOne({ tenant, name: templateName }, opt);
      const flexible = existing || new ShiftTemplate({ tenant, name: templateName, role: attendant,
        positions: [{ roles: [attendant], count: 1 }, { roles: [marketer], count: 1 }],
        department: null, startTime: '08:40', endTime: '17:00', endDayOffset: 0,
        breakMinutes: 0, recurrence: 'weekly', daysOfWeek: [1, 2, 3, 4, 5],
        cycleLength: null, cycleDays: [], anchorDate: null, isActive: true,
        note: 'Faith and Oluchi each choose FOUR weekdays (Monday-Friday) per week, 08:40-17:00 Africa/Lagos. Select four dated shifts per person weekly. No fixed day off. Weekdays are eligibility only: do not fill/publish all five. Weekly quota is not enforced by this scheduler.',
      }).toObject();
      assert.equal(new ShiftTemplate(flexible).validateSync(), undefined);
      assert.equal(flexible.startTime, '08:40');
      assert.equal(flexible.endTime, '17:00');
      assert.deepEqual(flexible.daysOfWeek, [1, 2, 3, 4, 5]);
      result = { mode: apply ? 'applied' : 'dry-run', from: today,
        through: [...byDate.keys()].at(-1).slice(0, 10), joshuaNewShifts: newShifts.map(s => s.start),
        janiceCancelledStarts: cancelled.map(s => s.start), shift1AttendantCapacity: 7,
        flexibleTemplateId: flexible._id, flexibleTemplateName: flexible.name,
        flexibleAssignmentsCreated: 0, limitation: 'Faith/Oluchi need four chosen dates each week; no weekly quota enforcement.' };
      if (!apply) return;
      const now = new Date();
      const scheduleNotes = {
        Joshua: 'Schedule: Wyn city Attendants shift 1, following its existing alternating-day rotation.',
        Janice: 'Schedule: Shift 1 rotation, excluding shifts STARTING every Monday or Tuesday. Weekly total varies between two and three. Apply this exclusion when extending the roster.',
        Faith: 'Schedule: choose FOUR weekdays Monday-Friday each week, 08:40-17:00 Africa/Lagos, using the Faith & Oluchi template. No fixed day off; select dated assignments weekly.',
        Oluchi: 'Schedule: choose FOUR weekdays Monday-Friday each week, 08:40-17:00 Africa/Lagos, using the Faith & Oluchi template. No fixed day off; select dated assignments weekly.',
      };
      for (const [name, note] of Object.entries(scheduleNotes)) {
        const prior = users.find(u => u._id.equals(ids[name]));
        const previous = prior.employeeProfile?.work?.note || '';
        const combined = previous.includes(note) ? previous : [previous, note].filter(Boolean).join('\n');
        assert.equal((await db.collection('users').updateOne({ tenant, _id: ids[name], status: 'active' }, {
          $set: { 'employeeProfile.work.note': combined, updatedAt: now },
        }, opt)).matchedCount, 1);
      }
      for (const [name, role] of [['Joshua', attendant], ['Oluchi', marketer]]) {
        const prior = users.find(u => u._id.equals(ids[name]));
        const set = { updatedAt: now };
        if (!prior.employeeProfile?.planning?.defaultRole) set['employeeProfile.planning.defaultRole'] = role;
        const write = await db.collection('users').updateOne({ tenant, _id: ids[name], status: 'active' }, {
          $addToSet: { 'employeeProfile.planning.roles': role }, $set: set,
        }, opt);
        assert.equal(write.matchedCount, 1);
      }
      assert.equal((await db.collection('shifttemplates').updateOne({ tenant, _id: shift1 }, {
        $set: { positions, updatedAt: now },
      }, opt)).matchedCount, 1);
      if (!existing) await db.collection('shifttemplates').insertOne({ ...flexible, createdAt: now, updatedAt: now }, opt);
      if (newShifts.length) await db.collection('shifts').insertMany(newShifts.map(s => ({ ...s, createdAt: now, updatedAt: now })), opt);
      for (const row of cancelled) {
        assert.equal((await db.collection('shifts').updateOne({ tenant, _id: row._id, status: row.status }, {
          $set: { status: 'cancelled', updatedAt: now,
            note: [row.note, 'Janice does not work Monday or Tuesday; excluded from Shift 1 per user request 2026-10-19.'].filter(Boolean).join('\n') },
        }, opt)).matchedCount, 1);
      }
      const after = await db.collection('shifts').find({ ...future, employee: ids.Janice, template: shift1 }, opt).toArray();
      assert(after.every(s => ![1, 2].includes(localDay(s.start))));
      assert.equal(after.length, roster.filter(s => s.employee?.equals(ids.Janice)).length - cancelled.length);
      const josAfter = await db.collection('shifts').find({ ...future, employee: ids.Joshua, template: shift1 }, opt).toArray();
      assert.equal(josAfter.length, byDate.size);
      assert(josAfter.every(s => s.status === 'draft'), 'Unexpected Joshua publication');
      const faithfulDates = patternDates(template, [...byDate.keys()].map(d => d.slice(0, 10)));
      assert(faithfulDates.ok, 'Source template pattern invalid');
      const audit = await db.collection('auditlogs').insertOne({ actorRole: 'system',
        action: 'WYNCITY_EMPLOYEE_SHIFT_CONFIGURATION', actionCategory: 'bulk', targetType: 'Tenant',
        targetId: tenant, targetTenantId: tenant, timestamp: now, result: 'success',
        justification: 'User: Joshua on Shift 1; Janice excludes Mon/Tue; Faith and Oluchi choose four weekdays 08:40-17:00. No unknown workdays chosen.',
        changes: { before: { users, shift1Positions: template.positions, cancelledShifts: cancelled },
          after: { ...result, newShifts: newShifts.map(s => s._id), flexibleTemplateCreated: !existing } },
      }, opt);
      result.auditId = audit.insertedId;
    });
    console.log(JSON.stringify(result, null, 2));
  } finally { await session.endSession(); }
}
main().catch(error => {
  console.error(error.name, error instanceof assert.AssertionError ? error.message : 'Shift configuration failed');
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());
