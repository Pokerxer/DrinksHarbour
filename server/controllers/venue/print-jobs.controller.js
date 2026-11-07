'use strict';
// controllers/venue/print-jobs.controller.js — S4 HTTP surface.
//
// Bridge endpoints (bridgePending/bridgeAck) run under the DEDICATED
// bridge-token middleware (middleware/venue-bridge.middleware.js) — req.bridge
// carries the token-resolved tenant/location scope, never client input. The
// server is pull-only: the bridge polls; nothing dials out.
//
// Staff endpoints (staffList/staffReprint) ride the venue-ops router argument
// shape (venueActor from middleware); eligibility is enforced inside the
// service through visitContext ('preparation.read' / 'preparation.write') and
// the reprint is an Idempotency-Key operation like every venue command.
const { venueActor } = require('../../middleware/venue.middleware');
const { validateKey } = require('../../services/venue/operations');
const { id } = require('../../services/venue/eligibility');

function send(res, data, status = 200) { res.set('Cache-Control', 'no-store').status(status).json({ success: true, data }); }

// GET /devices/bridge/:locationId/pending?deviceId= — queued + delivered-unacked
// jobs for this device; fresh ones marked delivered, redeliveries flagged.
exports.bridgePending = async (req, res) => send(res, await require('../../services/venue/print-delivery').pendingForDevice({ tenantId: req.bridge.tenantId, locationId: req.bridge.locationId, deviceId: req.query.deviceId }));

// POST /devices/bridge/:locationId/ack {jobId} — acknowledged + ackAt; double
// ack no-op; foreign/unknown 404.
exports.bridgeAck = async (req, res) => send(res, await require('../../services/venue/print-delivery').acknowledge({ tenantId: req.bridge.tenantId, locationId: req.bridge.locationId, jobId: req.body.jobId }));

// GET /service-sessions/:id/print-jobs — staff read, newest first, duplicate
// labels + delivery states.
exports.staffList = async (req, res) => send(res, await require('../../services/venue/print-delivery').listSessionPrintJobs({ tenantId: id(req.user.tenant), sessionId: req.params.id, actor: venueActor(req) }));

// POST /service-sessions/:id/print-jobs/:jobId/reprint — new labelled reprint
// job pointing at the original; no second consumption event.
exports.staffReprint = async (req, res) => send(res, await require('../../services/venue/print-delivery').reprint({ tenantId: id(req.user.tenant), sessionId: req.params.id, jobId: req.params.jobId, actor: venueActor(req), idempotencyKey: validateKey(req.get('Idempotency-Key')) }), 201);
