'use strict';
// controllers/venue/guestlists.controller.js — HTTP surface for guest-list management
// (Phase-4 E2 Task 1). Same shape as events.controller: the venue actor comes from
// middleware, mutations carry an Idempotency-Key header, and eligibility is enforced
// inside the service through loadVenueContext (guestlists.read / guestlists.write).
const { venueActor } = require('../../middleware/venue.middleware');
const { validateKey } = require('../../services/venue/operations');
const { id } = require('../../services/venue/eligibility');

function send(res, data, status = 200) { res.set('Cache-Control', 'no-store').status(status).json({ success: true, data }); }

function args(req) {
  return { tenantId: id(req.user.tenant), locationId: req.params.locationId, actor: venueActor(req) };
}

exports.list = async (req, res) => send(res, await require('../../services/venue/guestlists').list({ ...args(req), occurrenceId: req.query.occurrenceId, state: req.query.state, after: req.query.after }));

exports.create = async (req, res) => send(res, await require('../../services/venue/guestlists').createStaff({
  ...args(req), occurrenceId: req.body.occurrenceId, input: req.body.input, idempotencyKey: validateKey(req.get('Idempotency-Key')),
}), 201);

function command(action) {
  return async (req, res) => send(res, await require('../../services/venue/guestlists')[action]({
    ...args(req), guestListId: req.params.guestListId, expectedVersion: req.body.expectedVersion, input: req.body.input,
    flagged: req.body.flagged, reason: req.body.reason, staffId: req.body.staffId, promoterRef: req.body.promoterRef,
    idempotencyKey: validateKey(req.get('Idempotency-Key')),
  }));
}

exports.approve = command('approve');
exports.deny = command('deny');
exports.cancel = command('cancel');
exports.flagVip = command('flagVip');
exports.assignStaff = command('assignStaff');
exports.assignPromoter = command('assignPromoter');
