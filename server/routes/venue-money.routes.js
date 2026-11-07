'use strict';
const asyncHandler = require('../utils/asyncHandler');
const { protect } = require('../middleware/auth.middleware');
const { id } = require('../services/venue/eligibility');
const { validateKey } = require('../services/venue/operations');
function customerRoutes(router, send) {
  const limiter = require('express-rate-limit')({ windowMs: 60000, limit: 20 });
  router.get('/payers/:portionId', protect, asyncHandler(async (req, res) => send(res, await require('../services/venue/payers').status({ customerId: id(req.user), portionId: req.params.portionId, token: req.query.token }))));
  router.post('/payers/:portionId/verify', protect, limiter, asyncHandler(async (req,res) => send(res, await require('../services/venue/payers').verifyPortion({customerId:id(req.user),portionId:req.params.portionId,token:req.body.token}))));
  router.post('/payers/:portionId/collect', protect, limiter, asyncHandler(async (req, res) => send(res, await require('../services/venue/payers').collectPortion({ customerId: id(req.user), portionId: req.params.portionId, token: req.body.token, email: req.body.email, idempotencyKey: validateKey(req.get('Idempotency-Key')) }))));
  router.post('/me/requests/:reference/financial-terms', protect, limiter, asyncHandler(async(req,res)=>send(res,await require('../services/venue/financial-consent').accept({customerId:id(req.user),reference:req.params.reference,acceptedTerms:req.body.acceptedTerms,expectedVersion:req.body.expectedVersion,policyVersion:req.body.policyVersion,idempotencyKey:validateKey(req.get('Idempotency-Key'))}))));
  router.post('/me/requests/:reference/deposit', protect, limiter, asyncHandler(async (req, res) => send(res, await require('../services/venue/advances').startDeposit({ customerId: id(req.user), reference: req.params.reference, email: req.body.email, acceptedTerms: req.body.acceptedTerms, expectedVersion: req.body.expectedVersion, policyVersion: req.body.policyVersion, idempotencyKey: validateKey(req.get('Idempotency-Key')) }))));
  router.get('/me/requests/:reference/deposit', protect, asyncHandler(async (req, res) => {
    const booking = await require('../services/venue/advances').ownedBooking({ customerId: id(req.user), reference: req.params.reference });
    const attempt = await require('../models/VenuePaymentAttempt').findOne({ tenant: booking.tenant, booking: booking._id, purpose: 'venue_deposit', payer: req.user._id }).select('+authorizationUrl').lean();
    send(res, attempt ? require('../services/venue/advances').attemptDTO(attempt) : null);
  }));
  router.post('/me/requests/:reference/deposit/verify', protect, limiter, asyncHandler(async (req, res) => {
    const booking = await require('../services/venue/advances').ownedBooking({ customerId: id(req.user), reference: req.params.reference });
    const attempt = await require('../models/VenuePaymentAttempt').findOne({ tenant: booking.tenant, booking: booking._id, purpose: 'venue_deposit', payer: req.user._id }).lean();
    if (!attempt) require('../services/venue/errors').fail('NOT_FOUND', 'Deposit attempt not found', 404);
    await require('../services/venue/collections').verifyVenuePayment({ reference: attempt.reference });
    send(res, await require('../services/venue/reservations').ownedRequest({ customerId: id(req.user), reference: req.params.reference }));
  }));
}
function staffRoutes(router, args, send) {
  const { staffSupport } = require('../middleware/venue-rate-limit.middleware');
  const route = (path, handler, limiter) => router.post(path, ...(limiter ? [limiter] : []), asyncHandler(async (req, res) => send(res, await handler(req))));
  for(const action of ['execute','reconcile'])route(`/staff/locations/:locationId/refunds/:caseId/${action}`,async(req)=>{const context=args(req),refund=await require('../models/VenueRefundCase').findOne({_id:require('../services/venue/errors').requireId(req.params.caseId),tenant:context.tenantId}).lean();if(!refund)require('../services/venue/errors').fail('NOT_FOUND','Refund not found',404);await require('../services/venue/money-support').supportReceipt({...context,receiptId:id(refund.receipt)});return require('../services/venue/refunds')[action==='execute'?'executeRefund':'reconcileRefund']({tenantId:context.tenantId,caseId:id(refund)});},staffSupport);
  route('/staff/locations/:locationId/refunds/:caseId/link-evidence',async(req)=>require('../services/venue/refunds').linkRefundEvidence({...args(req),caseId:req.params.caseId,expectedVersion:req.body.expectedVersion,providerRefundId:req.body.providerRefundId,reason:req.body.reason,evidence:req.body.evidence,idempotencyKey:validateKey(req.get('Idempotency-Key'))}),staffSupport);
  router.get('/staff/locations/:locationId/money-cases',asyncHandler(async(req,res)=>send(res,await require('../services/venue/refunds').listCases({...args(req),after:req.query.after}))));
  route('/staff/locations/:locationId/refunds/receipts/:receiptId',async(req)=>require('../services/venue/refunds').requestRefund({...args(req),receiptId:req.params.receiptId,amountMinor:req.body.amountMinor,reason:req.body.reason,evidence:req.body.evidence,idempotencyKey:validateKey(req.get('Idempotency-Key'))}),staffSupport);
  route('/staff/locations/:locationId/refunds/:caseId/approve',async(req)=>require('../services/venue/refunds').approveRefund({...args(req),caseId:req.params.caseId,expectedVersion:req.body.expectedVersion,reason:req.body.reason,idempotencyKey:validateKey(req.get('Idempotency-Key'))}),staffSupport);
  router.get('/staff/locations/:locationId/visits/:sessionId/payers',asyncHandler(async(req,res)=>send(res,await require('../services/venue/payers').listPortions({...args(req),sessionId:req.params.sessionId}))));
  route('/staff/locations/:locationId/visits/:sessionId/payers/:portionId/release',async(req)=>require('../services/venue/payers').releasePortion({...args(req),sessionId:req.params.sessionId,portionId:req.params.portionId,idempotencyKey:validateKey(req.get('Idempotency-Key'))}),staffSupport);
  route('/staff/locations/:locationId/visits/:sessionId/payers/:portionId/cash',async(req)=>require('../services/venue/payer-cash').collect({...args(req),sessionId:req.params.sessionId,portionId:req.params.portionId,expectedVersion:req.body.expectedVersion,amountTenderedMinor:req.body.amountTenderedMinor,idempotencyKey:validateKey(req.get('Idempotency-Key'))}),staffSupport);
  route('/staff/locations/:locationId/visits/:sessionId/payers',async(req)=>require('../services/venue/payers').createPortions({...args(req),sessionId:req.params.sessionId,expectedVersion:req.body.expectedVersion,amountsMinor:req.body.amountsMinor,equalCount:req.body.equalCount,itemsByPortion:req.body.itemsByPortion,financialPolicyVersion:req.body.financialPolicyVersion,idempotencyKey:validateKey(req.get('Idempotency-Key'))}),staffSupport);
}
module.exports = { customerRoutes, staffRoutes };
