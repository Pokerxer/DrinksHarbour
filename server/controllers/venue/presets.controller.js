'use strict';
// controllers/venue/presets.controller.js — HTTP surface for service-preset config (S3 Task 2).
// Same argument/bootstrapping shape as recipes.controller: the venue actor comes from
// middleware, mutations carry an Idempotency-Key header, and eligibility is enforced
// inside the service through loadVenueContext (experience.read / experience.manage).
const { venueActor } = require('../../middleware/venue.middleware');
const { validateKey } = require('../../services/venue/operations');
const { id } = require('../../services/venue/eligibility');

function send(res, data, status = 200) { res.set('Cache-Control', 'no-store').status(status).json({ success: true, data }); }

function args(req) {
  return { tenantId: id(req.user.tenant), locationId: req.params.locationId, actor: venueActor(req) };
}

exports.list = async (req, res) => send(res, await require('../../services/venue/presets').listPresets(args(req)));

exports.create = async (req, res) => send(res, await require('../../services/venue/presets').createPreset({
  ...args(req), input: req.body.input, idempotencyKey: validateKey(req.get('Idempotency-Key')),
}), 201);

exports.update = async (req, res) => send(res, await require('../../services/venue/presets').updatePreset({
  ...args(req), presetId: req.params.presetId, expectedVersion: req.body.expectedVersion, input: req.body.input,
  idempotencyKey: validateKey(req.get('Idempotency-Key')),
}));
