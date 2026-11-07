'use strict';
// controllers/venue/host-alerts.controller.js — HTTP surface for the VIP host-alert
// listing (Phase-4 E2 Task 3). Persists+emits happen post-commit inside
// admissions.redeem via services/venue/host-alerts.afterRedeem; this surface is the
// host floor's read (guestlists.read eligibility, permitted info only).
const { venueActor } = require('../../middleware/venue.middleware');
const { id } = require('../../services/venue/eligibility');

function send(res, data, status = 200) { res.set('Cache-Control', 'no-store').status(status).json({ success: true, data }); }

exports.list = async (req, res) => send(res, await require('../../services/venue/host-alerts').listHostAlerts({
  tenantId: id(req.user.tenant), locationId: req.params.locationId, actor: venueActor(req),
  occurrenceId: req.params.occurrenceId, after: req.query.after,
}));
