// server/controllers/whatsappOrder.controller.js
'use strict';
const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/response');
const { ValidationError } = require('../utils/errors');
const svc = require('../services/whatsappOrderInvoice');

// POST /api/whatsapp-orders/:id/invoice — issue or re-send the invoice (super_admin)
exports.issueInvoice = asyncHandler(async (req, res) => {
  const out = await svc.issueInvoice(req.params.id, req.user, { force: req.body?.force === true });
  successResponse(res, {
    invoiceUrl: out.invoiceUrl,
    reference: out.order.invoice.paymentReference,
    authorizationUrl: out.authorizationUrl,
    resendOnly: out.resendOnly,
  }, out.resendOnly ? 'Invoice re-sent' : 'Invoice issued');
});

// GET /api/whatsapp-orders/:id/invoice?token= — public, token-gated page data
exports.getInvoice = asyncHandler(async (req, res) => {
  const data = await svc.publicInvoice(req.params.id, req.query.token);
  res.set('Cache-Control', 'private, no-store');
  successResponse(res, data, 'Invoice retrieved');
});

// POST /api/whatsapp-orders/:id/pay-verify — public settlement of the invoice
// Token OR gateway reference. The token gates the invoice PAGE; the settlement
// itself is fail-closed on the claim binding (claim.order === order._id) plus
// gateway-verified evidence, so a reference-only call — what Korapay's redirect
// may deliver if it rewrites the query string — is still safe.
exports.verifyPayment = asyncHandler(async (req, res) => {
  const { token, reference } = req.body || {};
  if (!token && !reference) throw new ValidationError('Invoice token or payment reference required');
  if (token) {
    // The token gate: publicInvoice throws NotFoundError on a bad token.
    await svc.publicInvoice(req.params.id, token);
  }
  const saved = await svc.verifyAndAttach(req.params.id, reference);
  successResponse(res, { paid: true, orderNumber: saved.orderNumber, paymentStatus: saved.paymentStatus }, 'Payment confirmed');
});
