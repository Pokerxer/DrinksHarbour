'use strict';
// controllers/venue/events.controller.js — HTTP surface for event-occurrence work (Phase-4 E1).
// Same argument/bootstrapping shape as presets.controller: the venue actor comes from
// middleware, mutations carry an Idempotency-Key header, and eligibility is enforced
// inside the service through loadVenueContext (events.read / events.write).
const { venueActor } = require('../../middleware/venue.middleware');
const { validateKey } = require('../../services/venue/operations');
const { id } = require('../../services/venue/eligibility');

function send(res, data, status = 200) { res.set('Cache-Control', 'no-store').status(status).json({ success: true, data }); }

function args(req) {
  return { tenantId: id(req.user.tenant), locationId: req.params.locationId, actor: venueActor(req) };
}

exports.list = async (req, res) => send(res, await require('../../services/venue/events').listOccurrences({ ...args(req), from: req.query.from, to: req.query.to }));

exports.get = async (req, res) => send(res, await require('../../services/venue/events').getOccurrence({ ...args(req), occurrenceId: req.params.occurrenceId }));

exports.create = async (req, res) => send(res, await require('../../services/venue/events').createOccurrence({
  ...args(req), input: req.body.input, idempotencyKey: validateKey(req.get('Idempotency-Key')),
}), 201);

exports.update = async (req, res) => send(res, await require('../../services/venue/events').updateOccurrence({
  ...args(req), occurrenceId: req.params.occurrenceId, expectedVersion: req.body.expectedVersion, input: req.body.input,
  idempotencyKey: validateKey(req.get('Idempotency-Key')),
}));

exports.cancel = async (req, res) => send(res, await require('../../services/venue/events').cancelOccurrence({
  ...args(req), occurrenceId: req.params.occurrenceId, idempotencyKey: validateKey(req.get('Idempotency-Key')),
}));
