'use strict';
const { venueActor } = require('../../middleware/venue.middleware');
const { validateKey } = require('../../services/venue/operations'); const { id } = require('../../services/venue/eligibility');
const { fail } = require('../../services/venue/errors');
function args(req, mutation = false) {
  const actor = venueActor(req);
  return { tenantId: id(req.user.tenant), sessionId: req.params.id, actor, ...(mutation ? { idempotencyKey: validateKey(req.get('Idempotency-Key')) } : {}) };
}
function send(res, data, status = 200) { res.set('Cache-Control', 'no-store').status(status).json({ success: true, data }); }
exports.readiness = async (req, res) => send(res, await require('../../services/venue/readiness').getVenueReadiness(args(req)));
exports.create = async (req, res) => {
  const input = args(req, true);
  send(res, await require('../../services/venue/service-sessions').ensureServiceSession({ ...input, locationId: req.body.locationId, bookingId: req.body.bookingId, tableIds: req.body.tableIds, expectedTableVersions: req.body.expectedTableVersions, posSessionId: req.body.posSessionId, presetId: req.body.presetId, serviceMode: req.body.serviceMode, guest: req.body.guest }), 201);
};
exports.lines = async (req, res) => {
  require('../../services/venue/pricing').validateCart(req.body);
  send(res, await require('../../services/venue/lines').setSessionLines({ ...args(req, true), expectedVersion: req.body.expectedVersion, lines: req.body.lines }));
};
exports.bill = async (req, res) => send(res, await require('../../services/venue/billing').getBill(args(req)));
exports.freeze = async (req, res) => send(res, await require('../../services/venue/billing').ensureBillOrder({ ...args(req, true), expectedVersion: req.body.expectedVersion, lineVersion: req.body.lineVersion, ageVerified: req.body.ageVerified }));
exports.collect = async (req, res) => {
  require('../../services/venue/pricing').validateCart(req.body);
  send(res, await require('../../services/venue/collections').collectBill({ ...args(req, true), expectedVersion: req.body.expectedVersion, quoteId: req.body.quoteId, method: req.body.method, amountTenderedMinor: req.body.amountTenderedMinor, email: req.body.email }));
};
exports.reconcile = async (req, res) => {
  const input = args(req, true);
  const { visit } = await require('../../services/venue/lines').visitContext({ ...input, action: 'bill.reconcile' });
  const attempt = await require('../../models/VenuePaymentAttempt').findOne({ tenant: input.tenantId, session: visit._id, billOrder: visit.billOrder }).lean();
  if (!attempt) fail('NOT_FOUND', 'Payment attempt not found', 404);
  const receiptId = attempt.receipt || await require('../../services/venue/collections').verifyVenuePayment({ reference: attempt.reference });
  send(res, await require('../../services/venue/settlement').settleVenueBill({ tenantId: input.tenantId, receiptId: id(receiptId), actor: input.actor }));
};
exports.close = async (req, res) => {
  const input = args(req, true);
  const { visit } = await require('../../services/venue/lines').visitContext({ ...input, action: 'bill.close' });
  const bill = await require('../../services/venue/billing').getBill(input);
  if (bill.state !== 'settled' || bill.outstandingMinor !== 0 || visit.state !== 'closed') fail('PAYMENT_PENDING', 'Settle and reconcile the bill before closing');
  send(res, require('../../services/venue/service-sessions').sessionDTO(visit));
};

exports.courseFire = async (req, res) => {
  const data = await require('../../services/venue/lines').fireSessionRound({ ...args(req, true), expectedVersion: req.body.expectedVersion, courseId: req.params.courseId });
  // Post-commit broadcast (S3 Task 5): preparation items were created for the
  // fired round — emit the safe identity payload to the location's room.
  if (data.round) require('../../services/pos.realtime').emitToVenuePrep(req, id(req.user.tenant), data.locationId, 'venue.preparation.changed', require('../../services/venue/preparation').roundChangedPayload(data.id, data.round));
  send(res, data);
};
exports.courseHold = async (req, res) => send(res, await require('../../services/venue/courses').setCourseState({ ...args(req, true), expectedVersion: req.body.expectedVersion, courseId: req.params.courseId, to: req.body.to === 'planned' ? 'planned' : 'hold' }));
exports.coursesSet = async (req, res) => send(res, await require('../../services/venue/courses').setCourses({ ...args(req, true), expectedVersion: req.body.expectedVersion, courses: req.body.courses }));

exports.locationMode = async (req, res) => {
  const tenantId = id(req.user.tenant);
  const { warehouse } = await require('../../services/posShopScope.service').resolveOpeningShop(req);
  const location = await require('../../models/Warehouse').findOne({ _id: warehouse, tenant: tenantId }).select('venueServices').lean();
  send(res, { locationId: id(warehouse), canonicalCheckoutEnabled: req.tenant?.venueSettings?.identityVersion === 1 && location?.venueServices?.canonicalCheckoutEnabled === true });
};

exports.openVisits = async (req,res) => send(res,await require('../../services/venue/open-visits').listOpenVisits({...args(req),after:req.query.after}));

// S5 Task 3: gratuity ALLOCATION records — records only (no charge/refund/stock
// effect; Order.tipAmount and the receipt are never touched). The write rides
// 'collection.write' (the Batch-2 money-command class — same eligibility and
// staffCommands limiter as payer reservations) with an Idempotency-Key; the
// read rides 'bill.read', the weakest sufficient existing action (records are
// bill/receipt-anchored financial data) with no limiter, like every staff read.
exports.gratuityAllocate = async (req, res) => send(res, await require('../../services/venue/gratuity').recordAllocation({ ...args(req, true), locationId: req.body.locationId, receiptId: req.body.receiptId, sourceKind: req.body.sourceKind, amountMinor: req.body.amountMinor, policyVersion: req.body.policyVersion, shares: req.body.shares }), 201);
exports.gratuityList = async (req, res) => send(res, await require('../../services/venue/gratuity').listAllocations({ ...args(req), locationId: req.query.locationId }));

// S6 floor transfers & parties — Idempotency-Key rides args(req, true).
exports.move = async (req, res) => send(res, await require('../../services/venue/transfers').moveVisit({ ...args(req, true), targetTableIds: req.body.targetTableIds, expectedVersion: req.body.expectedVersion }));
exports.releaseTable = async (req, res) => send(res, await require('../../services/venue/transfers').releaseTable({ ...args(req, true), outcome: req.body.outcome, expectedVersion: req.body.expectedVersion }));
// S6 Task 3: move-lines — {lines:[{lineId, revision, quantity, toSessionId, toExpectedVersion?}], repricingConsent, expectedVersion}.
exports.moveLines = async (req, res) => send(res, await require('../../services/venue/transfers').moveLines({ ...args(req, true), expectedVersion: req.body.expectedVersion, lines: req.body.lines, repricingConsent: req.body.repricingConsent }));
exports.join = async (req, res) => send(res, await require('../../services/venue/parties').join({ ...args(req, true), targetSessionId: req.body.targetSessionId, expectedVersion: req.body.expectedVersion }));
exports.leaveParty = async (req, res) => send(res, await require('../../services/venue/parties').leaveParty({ ...args(req, true), expectedVersion: req.body.expectedVersion }));
exports.consolidate = async (req, res) => send(res, await require('../../services/venue/parties').consolidate({ ...args(req, true), intoSessionId: req.body.intoSessionId, expectedVersion: req.body.expectedVersion }));
