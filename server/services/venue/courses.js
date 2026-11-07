'use strict';
// services/venue/courses.js — the ordered course registry + hold state machine on
// the visit doc (S3 Task 3, spec §2/§3).
//
// Course states: planned → hold → fired only; hold → planned reverts (no side
// effects); fired is terminal. Fire is NOT here — course fire reuses
// lines.fireSessionRound with a courseId filter (same dedup/consumption/stock/
// freezing path, same 'round.fire' action wiring), so a replayed course fire is
// a runVenueOperation no-op exactly like any round fire. This module owns:
// - setCourseState: hold/release (POST .../courses/:courseId/hold).
// - setCourses: full-array registry replacement, version-checked, unique ids;
//   state rides courseId, new courses start 'planned', and a course that fired
//   lines still reference can never be dropped (FIRED_LINES_LOCKED).
const { runVenueOperation } = require('./operations');
const { visitContext, linesDTO } = require('./lines');
const { fail } = require('./errors');
const { id } = require('./eligibility');

const validCourseId = value => typeof value === 'string' && !!value.trim() && value.length <= 50;
const courseDTO = course => ({ courseId: course.courseId, name: course.name, order: course.order, state: course.state });
const dto = visit => ({ ...linesDTO(visit), courses: (visit.courses || []).map(courseDTO) });

// planned→hold and hold→planned via this module; x→fired only via course fire.
const HOLD_TRANSITIONS = { planned: ['hold'], hold: ['planned'], fired: [] };

async function setCourseState(args) {
  const { tenantId, sessionId, actor, expectedVersion, courseId, to, idempotencyKey } = args;
  if (!validCourseId(courseId)) fail('INVALID_INPUT', 'Course id must be a short id of at most 50 characters', 400);
  if (!['hold', 'planned'].includes(to)) fail('INVALID_INPUT', 'Course hold accepts to: hold | planned', 400);
  const context = await visitContext({ tenantId, sessionId, actor, action: 'courses.write' });
  return runVenueOperation({ tenantId, locationId: id(context.location), actor: context.actor, operation: 'courses.state', key: idempotencyKey,
    payload: { sessionId, expectedVersion, courseId, to }, execute: async ({ mongoSession }) => {
      const { visit } = await visitContext({ tenantId, sessionId, actor, action: 'courses.write', mongoSession });
      if (visit.state !== 'open') fail('STATE_CHANGED', 'Visit is closing; course changes are blocked');
      if (visit.version !== expectedVersion) fail('STATE_CHANGED', 'Visit changed; refresh');
      const course = (visit.courses || []).find(c => c.courseId === courseId);
      if (!course) fail('NOT_FOUND', 'Course not found', 404);
      if (!HOLD_TRANSITIONS[course.state || 'planned'].includes(to)) fail('STATE_CHANGED', `Course is ${course.state || 'planned'}`);
      course.state = to; visit.version++;
      await visit.save({ session: mongoSession });
      return dto(visit);
    } });
}

async function setCourses(args) {
  const { tenantId, sessionId, actor, expectedVersion, courses, idempotencyKey } = args;
  if (!Array.isArray(courses) || courses.length > 50) fail('INVALID_INPUT', 'Provide the full ordered course list (at most 50)', 400);
  const seen = new Set();
  for (const course of courses) {
    if (!course || !validCourseId(course.courseId)) fail('INVALID_INPUT', 'Course id must be a short id of at most 50 characters', 400);
    if (seen.has(course.courseId)) fail('INVALID_INPUT', 'Course ids must be unique', 400);
    seen.add(course.courseId);
    if (course.name !== undefined && (typeof course.name !== 'string' || !course.name.trim() || course.name.length > 100)) fail('INVALID_INPUT', 'Course name must be at most 100 characters', 400);
  }
  const context = await visitContext({ tenantId, sessionId, actor, action: 'courses.write' });
  return runVenueOperation({ tenantId, locationId: id(context.location), actor: context.actor, operation: 'courses.set', key: idempotencyKey,
    payload: { sessionId, expectedVersion, courses }, execute: async ({ mongoSession }) => {
      const { visit } = await visitContext({ tenantId, sessionId, actor, action: 'courses.write', mongoSession });
      if (visit.state !== 'open') fail('STATE_CHANGED', 'Visit is closing; course changes are blocked');
      if (visit.version !== expectedVersion) fail('STATE_CHANGED', 'Visit changed; refresh');
      // A fired line's course is part of its frozen kitchen identity — the
      // registry may never drop a course that a fired line still references.
      for (const courseId of new Set(visit.acceptedLines.filter(l => (l.firedQuantity || 0) > 0 && l.courseId).map(l => l.courseId)))
        if (!seen.has(courseId)) fail('FIRED_LINES_LOCKED', 'A fired line keeps its course');
      const before = new Map((visit.courses || []).map(c => [c.courseId, c.state || 'planned']));
      visit.courses = courses.map((course, order) => ({ courseId: course.courseId, ...(course.name !== undefined ? { name: course.name } : {}), order, state: before.get(course.courseId) || 'planned' }));
      visit.version++;
      await visit.save({ session: mongoSession });
      return dto(visit);
    } });
}

module.exports = { setCourseState, setCourses, validCourseId, courseDTO };
