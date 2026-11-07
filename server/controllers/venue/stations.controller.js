'use strict';
// controllers/venue/stations.controller.js — HTTP surface for preparation-station
// config (S3 Task 6 prerequisite). Same argument/bootstrapping shape as the presets
// controller: the venue actor comes from middleware, mutations carry an
// Idempotency-Key header, and eligibility is enforced inside the service through
// loadVenueContext (stations.read / stations.write).
const { venueActor } = require('../../middleware/venue.middleware');
const { validateKey } = require('../../services/venue/operations');
const { id } = require('../../services/venue/eligibility');

function send(res, data, status = 200) { res.set('Cache-Control', 'no-store').status(status).json({ success: true, data }); }

function args(req) {
  return { tenantId: id(req.user.tenant), locationId: req.params.locationId, actor: venueActor(req) };
}

exports.list = async (req, res) => send(res, await require('../../services/venue/stations').listStations(args(req)));

exports.create = async (req, res) => send(res, await require('../../services/venue/stations').createStation({
  ...args(req), input: req.body.input, idempotencyKey: validateKey(req.get('Idempotency-Key')),
}), 201);

exports.update = async (req, res) => send(res, await require('../../services/venue/stations').updateStation({
  ...args(req), stationId: req.params.stationId, expectedVersion: req.body.expectedVersion, input: req.body.input,
  idempotencyKey: validateKey(req.get('Idempotency-Key')),
}));

// S4 device bridge: the token is minted server-side and returned ONCE in this
// response (only its sha-256 hash is stored — no operation-ledger persistence).
exports.registerBridge = async (req, res) => send(res, await require('../../services/venue/stations').registerBridge(args(req)), 201);

exports.revokeBridge = async (req, res) => send(res, await require('../../services/venue/stations').revokeBridge(args(req)));
