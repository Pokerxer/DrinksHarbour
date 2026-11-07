'use strict';
// controllers/venue/waitlist.controller.js — HTTP surface for waitlist work
// (Phase-4 E3). Same shape as guestlists.controller: the venue actor comes from
// middleware, mutations carry an Idempotency-Key header, and eligibility is
// enforced inside the service through loadVenueContext (waitlists.read /
// waitlists.write).
const { venueActor } = require('../../middleware/venue.middleware');
const { validateKey } = require('../../services/venue/operations');
const { id } = require('../../services/venue/eligibility');

function send(res, data, status = 200) { res.set('Cache-Control', 'no-store').status(status).json({ success: true, data }); }

function args(req) {
  return { tenantId: id(req.user.tenant), locationId: req.params.locationId, actor: venueActor(req) };
}

exports.list = async (req, res) => send(res, await require('../../services/venue/waitlist').list({ ...args(req), occurrenceId: req.query.occurrenceId, state: req.query.state, after: req.query.after }));

exports.create = async (req, res) => send(res, await require('../../services/venue/waitlist').createStaff({
  ...args(req), occurrenceId: req.body.occurrenceId, input: req.body.input, idempotencyKey: validateKey(req.get('Idempotency-Key')),
}), 201);

exports.patch = async (req, res) => send(res, await require('../../services/venue/waitlist').patch({
  ...args(req), entryId: req.params.entryId, expectedVersion: req.body.expectedVersion,
  input: req.body.input, cancel: req.body.cancel === true, idempotencyKey: validateKey(req.get('Idempotency-Key')),
}));

// 12 §5 shape: offer/accept/decline address the ENTRY (no location in the URL);
// the location/tenancy come from the entry row inside the service.
function entryCommand(action) {
  return async (req, res) => send(res, await require('../../services/venue/waitlist')[action]({
    tenantId: id(req.user.tenant), actor: venueActor(req), entryId: req.params.id,
    input: req.body.input, expectedVersion: req.body.expectedVersion, idempotencyKey: validateKey(req.get('Idempotency-Key')),
  }));
}

exports.offer = entryCommand('offer');
exports.accept = entryCommand('accept');
exports.decline = entryCommand('decline');
