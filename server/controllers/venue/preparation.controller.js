'use strict';
const { venueActor } = require('../../middleware/venue.middleware');
const { validateKey } = require('../../services/venue/operations'); const { id } = require('../../services/venue/eligibility');
function send(res, data, status = 200) { res.set('Cache-Control', 'no-store').status(status).json({ success: true, data }); }
// S3 Task 4: item advancement — append-only preparation ledger (station-scoped).
exports.advance = async (req, res) => {
  const data = await require('../../services/venue/preparation').advance({ tenantId: id(req.user.tenant), itemId: req.params.itemId, to: req.body.to, reason: req.body.reason, ref: req.body.ref, actor: venueActor(req), idempotencyKey: validateKey(req.get('Idempotency-Key')) });
  // Post-commit broadcast (S3 Task 5): the existing pos realtime idiom — ephemeral
  // socket event to the location's preparation room; no io (serverless) is normal.
  require('../../services/pos.realtime').emitToVenuePrep(req, id(req.user.tenant), data.locationId, 'venue.preparation.changed', data);
  send(res, data);
};
// S3 Task 5: kitchen read surface — staff viewing via 'preparation.read'
// (enforced in the service through visitContext); no rate limiter, like the
// other staff reads.
exports.list = async (req, res) => send(res, await require('../../services/venue/preparation').listSessionPreparation({ tenantId: id(req.user.tenant), sessionId: req.params.id, actor: venueActor(req), stationId: req.query.stationId }));
