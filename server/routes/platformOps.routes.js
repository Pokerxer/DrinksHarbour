"use strict";
// Platform operations routes. Super-admin/admin only. Read-only queue,
// inspect, readiness and audit-history views plus exactly two reconcile
// controls that delegate to the existing reviewed services — no new mutation
// behavior is invented here.
const router = require("express").Router();
const { protect, authorize } = require("../middleware/auth.middleware");
const asyncHandler = require("../utils/asyncHandler");
const { ValidationError } = require("../utils/errors");
const { logAudit } = require("../utils/auditLog");
const service = require("../services/operations/exceptionsQueue");
const readiness = require("../services/operations/readiness");
const auditView = require("../services/operations/auditView");
// Final-mechanisms package additions (workstream UI-W, all READ-ONLY):
// policyRegistry — super-admin-only policy recording-state projection;
// mechanismsQueue — operator-facing kora/payout reservation states. NO
// mutation routes are added for the mechanism commands (deliberately
// service-level; the only mutation surfaces remain the four super-admin
// policy recording routes on their own routers).
const registry = require("../services/operations/policyRegistry");
const mechanismsQueue = require("../services/operations/mechanismsQueue");

router.use(protect, authorize("super_admin", "admin"));
router.use((req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  next();
});

router.get(
  "/exceptions",
  asyncHandler(async (req, res) =>
    res.json({ success: true, data: await service.list(req.user, req.query) })
  )
);
router.get(
  "/exceptions/:kind/:id",
  asyncHandler(async (req, res) =>
    res.json({
      success: true,
      data: await service.inspect(req.user, req.params.kind, req.params.id),
    })
  )
);
router.get(
  "/readiness",
  asyncHandler(async (req, res) =>
    res.json({ success: true, data: await readiness.snapshot(req.user) })
  )
);
router.get(
  "/audit",
  asyncHandler(async (req, res) =>
    res.json({
      success: true,
      data: {
        entries: await auditView.byId(req.user, req.query.kind, req.query.id),
      },
    })
  )
);
// Policy-registry projection: super-admin-only at the service level too (the
// authorities' own documented list() read paths are super_admin-asserted), so
// an explicit super_admin gate on the route is defense-in-depth with the
// established pattern.
router.get(
  "/policy-registry",
  authorize("super_admin"),
  asyncHandler(async (req, res) =>
    res.json({ success: true, data: await registry.snapshot(req.user) })
  )
);
// Mechanisms queue: read-only kora/payout reservation states matching the
// operations-queue conventions. No mutation control is offered.
router.get(
  "/mechanism-exceptions",
  asyncHandler(async (req, res) =>
    res.json({ success: true, data: await mechanismsQueue.list(req.user, req.query) })
  )
);
router.get(
  "/mechanism-exceptions/:kind/:id",
  asyncHandler(async (req, res) =>
    res.json({
      success: true,
      data: await mechanismsQueue.inspect(req.user, req.params.kind, req.params.id),
    })
  )
);
// Existing reviewed refund reconcile (processed-retrieval settle). Requires the
// exact known original provider refund evidence ID and nothing else.
router.post(
  "/refund-exceptions/:id/reconcile",
  asyncHandler(async (req, res) => {
    if (Object.keys(req.body || {}).some((key) => key !== "providerRefundId"))
      throw new ValidationError(
        "Provide only the original provider refund evidence ID"
      );
    const refund = await require("../services/merchantFulfillment/refunds").reconcile(
      req.params.id,
      req.user,
      req.body?.providerRefundId
    );
    await logAudit({
      req,
      action: "PLATFORM_OPS_REFUND_RECONCILE",
      actionCategory: "update",
      targetType: "MerchantRefundAllocation",
      targetId: refund._id,
      targetTenantId: refund.tenant,
      justification:
        "Platform operations reconciliation of an uncertain refund allocation",
    });
    res.json({ success: true, data: { refund } });
  })
);
// Existing reviewed carrier reconciliation by known original provider ID.
// Accepts no payload; the underlying service enforces that exactly.
router.post(
  "/carrier-exceptions/:id/reconcile",
  asyncHandler(async (req, res) => {
    const booking = await require("../services/deliveryProviders/external").reconcile(
      req.params.id,
      req.body || {},
      req.user
    );
    // The reviewed service returns the whitelisted DTO; audit metadata is read
    // from the sealed booking record itself (read-only).
    const record = await require("../models/MerchantCarrierBooking")
      .findOne({ _id: String(booking._id) })
      .lean();
    await logAudit({
      req,
      action: "PLATFORM_OPS_CARRIER_RECONCILE",
      actionCategory: "update",
      targetType: "MerchantCarrierBooking",
      ...(record?.order ? { targetId: record.order } : {}),
      ...(record?.tenant ? { targetTenantId: record.tenant } : {}),
      justification:
        "Platform operations reconciliation of an uncertain carrier booking",
      changes: {
        after: {
          merchantOrder: String(record?.merchantOrder ?? ""),
          booking: String(booking._id),
          state: booking.state,
        },
      },
    });
    res.json({ success: true, data: { booking } });
  })
);

module.exports = router;
