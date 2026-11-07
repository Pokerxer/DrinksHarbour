'use strict';
// controllers/venue/pour-stock.controller.js — HTTP surface for opened-bottle ops (S2).
// Mirrors recipes.controller: actor from middleware, mutations carry an Idempotency-Key,
// eligibility enforced inside the service through loadVenueContext('stock.open').
const { venueActor } = require('../../middleware/venue.middleware');
const { validateKey } = require('../../services/venue/operations');
const { id } = require('../../services/venue/eligibility');

function send(res, data, status = 200) { res.set('Cache-Control', 'no-store').status(status).json({ success: true, data }); }

function args(req) {
  return { tenantId: id(req.user.tenant), locationId: req.params.locationId, actor: venueActor(req) };
}

exports.open = async (req, res) => send(res, await require('../../services/venue/pour-stock').openBottle({
  ...args(req), subProductId: req.body.subProductId, sizeId: req.body.sizeId, idempotencyKey: validateKey(req.get('Idempotency-Key')),
}), 201);

exports.pour = async (req, res) => send(res, await require('../../services/venue/pour-stock').pour({
  ...args(req), openedBottleId: req.params.openedBottleId, ml: req.body.ml, idempotencyKey: validateKey(req.get('Idempotency-Key')),
}));

// S2 Task 7: waste LEDGER read. Recording stays inside the pour-stock ops above
// (no POST waste route in S2); the read rides the same stock.open action surface.
exports.list = async (req, res) => send(res, await require('../../services/venue/waste').listWaste({
  ...args(req), pagination: { after: req.query.after || undefined },
}));
