'use strict';
const Order = require('../../models/Order'); const { id } = require('./eligibility'); const { fail } = require('./errors');
const { venueActor } = require('../../middleware/venue.middleware');
async function dispatchVenuePOS(req, res, operation) {
  if (req.tenant?.venueSettings?.identityVersion !== 1) return false;
  const tenantId = id(req.user.tenant), actor = venueActor(req);
  const key = req.get('Idempotency-Key');
  if (operation === 'open') {
    const table = await require('../../models/POSTable').findOne({ _id: req.body.tableId || req.params.id, tenant: tenantId }).lean();
    if (!table) return false;
    const drawer = await require('../posShopScope.service').resolveSaleSession(req);
    if (!table.location) { await require('./legacy-guards').assertLegacySaleAllowed({ tenant: req.tenant, locationId: id(drawer.warehouse) }); return false; }
    const location = await require('../../models/Warehouse').findOne({ _id: table.location, tenant: tenantId }).lean();
    if (!location?.venueServices?.canonicalCheckoutEnabled) { await require('./legacy-guards').assertLegacySaleAllowed({ tenant: req.tenant, locationId: id(drawer.warehouse) }); return false; }
    if (id(drawer.warehouse) !== id(location)) fail('NOT_FOUND', 'Table is not at this terminal location', 404);
    const visit = await require('./service-sessions').ensureServiceSession({ tenantId, locationId: id(location), actor, tableIds: [id(table)], expectedTableVersions: [req.body.expectedTableVersion ?? table.venueVersion], posSessionId: id(drawer), bookingId: req.body.bookingId, idempotencyKey: key });
    const tab = await Order.findOne({ _id: visit.heldOrderId, tenant: tenantId }).lean();
    const currentTable = await require('../../models/POSTable').findOne({ _id: table._id, tenant: tenantId }).lean();
    res.status(201).json({ success: true, data: { table: currentTable, tab, serviceSession: visit } }); return true;
  }
  const orderId = req.params.id;
  if (!orderId) return false;
  const hold = await Order.findOne({ _id: orderId, tenant: tenantId }).lean();
  if (!hold?.venueServiceSession && !hold?.venueBillForSession) return false;
  if (!['update', 'fire'].includes(operation)) require('./legacy-guards').rejectCanonicalOrder(hold);
  const args = { tenantId, sessionId: id(hold.venueServiceSession), actor, expectedVersion: req.body.expectedVersion, idempotencyKey: key };
  let visit;
  if (operation === 'update') {
    require('./pricing').validateCart(req.body);
    for (const item of req.body.items || []) require('./pricing').validateCart(item);
    visit = await require('./lines').setSessionLines({ ...args, lines: (req.body.items || []).map(item => ({ subProductId: item.subProductId, sizeId: item.sizeId, quantity: item.quantity, override: item.override })) });
  } else visit = await require('./lines').fireSessionRound(args);
  const tab = await Order.findOne({ _id: hold._id, tenant: tenantId }).lean();
  // Post-commit broadcast (S3 Task 5): the fired round created preparation items.
  if (visit.round) require('../pos.realtime').emitToVenuePrep(req, tenantId, visit.locationId, 'venue.preparation.changed', require('./preparation').roundChangedPayload(visit.id, visit.round));
  res.json({ success: true, data: { tab, serviceSession: visit, ...(visit.round ? { round: visit.round } : {}) } }); return true;
}
module.exports = { dispatchVenuePOS };
