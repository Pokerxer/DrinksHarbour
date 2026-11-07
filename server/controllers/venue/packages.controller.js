'use strict';
// controllers/venue/packages.controller.js — HTTP surface for package work (Phase-4 E4).
// Same shape as the events/presets controllers: the venue actor comes from
// middleware, mutations carry an Idempotency-Key header, and eligibility is
// enforced inside the service through loadVenueContext (packages.read/write).
const { venueActor } = require('../../middleware/venue.middleware');
const { validateKey } = require('../../services/venue/operations');
const { id } = require('../../services/venue/eligibility');

function send(res, data, status = 200) { res.set('Cache-Control', 'no-store').status(status).json({ success: true, data }); }

function args(req) {
  return { tenantId: id(req.user.tenant), locationId: req.params.locationId, actor: venueActor(req) };
}

const svc = () => require('../../services/venue/packages');

exports.list = async (req, res) => send(res, await svc().listPackages({ ...args(req) }));
exports.create = async (req, res) => send(res, await svc().createPackage({
  ...args(req), input: req.body.input, idempotencyKey: validateKey(req.get('Idempotency-Key')),
}), 201);
exports.update = async (req, res) => send(res, await svc().updatePackage({
  ...args(req), packageId: req.params.packageId, expectedVersion: req.body.expectedVersion, input: req.body.input,
  idempotencyKey: validateKey(req.get('Idempotency-Key')),
}));
exports.quote = async (req, res) => send(res, await svc().quotePackage({ ...args(req), packageId: req.params.packageId }));

exports.listCommitments = async (req, res) => send(res, await svc().listCommitments({ ...args(req), state: req.query.state }));
exports.commit = async (req, res) => send(res, await svc().commitPackage({
  ...args(req), input: req.body.input, idempotencyKey: validateKey(req.get('Idempotency-Key')),
}), 201);
exports.release = async (req, res) => send(res, await svc().releaseCommitment({
  ...args(req), commitmentId: req.params.commitmentId, idempotencyKey: validateKey(req.get('Idempotency-Key')),
}));
exports.upgrade = async (req, res) => send(res, await svc().upgradeCommitment({
  ...args(req), commitmentId: req.params.commitmentId, expectedVersion: req.body.expectedVersion, input: req.body.input,
  idempotencyKey: validateKey(req.get('Idempotency-Key')),
}));
exports.redeemComponent = async (req, res) => send(res, await svc().redeemComponent({
  ...args(req), commitmentId: req.params.commitmentId, input: req.body.input, idempotencyKey: validateKey(req.get('Idempotency-Key')),
}));
