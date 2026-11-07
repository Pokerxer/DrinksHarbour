'use strict';
// controllers/venue/admissions.controller.js — HTTP surface for entitlement
// issuance, door redemptions and the door-role picker (Phase-4 E2 Task 2). Same
// shape as events.controller: the venue actor comes from middleware, mutations
// carry an Idempotency-Key header, and eligibility is enforced inside the services
// (guestlists.write for issuance; door.scan — with the occurrence assignment rule
// in services/venue/door.js — for door surfaces).
const { venueActor } = require('../../middleware/venue.middleware');
const { validateKey } = require('../../services/venue/operations');
const { id } = require('../../services/venue/eligibility');

function send(res, data, status = 200) { res.set('Cache-Control', 'no-store').status(status).json({ success: true, data }); }

function args(req) {
  return { tenantId: id(req.user.tenant), locationId: req.params.locationId, actor: venueActor(req) };
}

exports.issue = async (req, res) => send(res, await require('../../services/venue/admissions').issueEntitlement({
  ...args(req), occurrenceId: req.params.occurrenceId, guestListId: req.body.guestListId, idempotencyKey: validateKey(req.get('Idempotency-Key')),
}), 201);

function scan(action) {
  return async (req, res) => send(res, await require('../../services/venue/admissions')[action]({
    ...args(req), occurrenceId: req.params.occurrenceId, token: req.body.token, guests: req.body.guests,
    ageVerified: req.body.ageVerified, deviceId: req.body.deviceId, req, idempotencyKey: validateKey(req.get('Idempotency-Key')),
  }));
}

exports.redeem = scan('redeem');
exports.redeemReEntry = scan('redeemReEntry');

exports.listRedemptions = async (req, res) => send(res, await require('../../services/venue/admissions').listRedemptions({ ...args(req), occurrenceId: req.params.occurrenceId, after: req.query.after }));

exports.assignDoorStaff = async (req, res) => send(res, await require('../../services/venue/door').assignDoorStaff({
  ...args(req), occurrenceId: req.params.occurrenceId, staffIds: req.body.staffIds, idempotencyKey: validateKey(req.get('Idempotency-Key')),
}));

exports.doorOccurrences = async (req, res) => send(res, await require('../../services/venue/door').listDoorOccurrences(args(req)));
