'use strict';
// controllers/venue/recipes.controller.js — HTTP surface for recipe authoring (S2 Task 3).
// Same argument/bootstrapping shape as service-sessions.controller: the venue actor comes
// from middleware, mutations carry an Idempotency-Key header, and eligibility is enforced
// inside the service through loadVenueContext(action).
const { venueActor } = require('../../middleware/venue.middleware');
const { validateKey } = require('../../services/venue/operations');
const { id } = require('../../services/venue/eligibility');

function send(res, data, status = 200) { res.set('Cache-Control', 'no-store').status(status).json({ success: true, data }); }

function args(req) {
  return { tenantId: id(req.user.tenant), locationId: req.params.locationId, actor: venueActor(req) };
}

exports.list = async (req, res) => send(res, await require('../../services/venue/recipes').listRecipes(args(req)));

exports.save = async (req, res) => send(res, await require('../../services/venue/recipes').createVersion({
  ...args(req), subProductId: req.params.subProductId, sizeId: req.body.sizeId,
  expectedVersion: req.body.expectedVersion, input: req.body.input, idempotencyKey: validateKey(req.get('Idempotency-Key')),
}), 201);
