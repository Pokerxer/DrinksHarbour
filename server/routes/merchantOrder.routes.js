"use strict";
const router = require("express").Router();
const { protect, authorize } = require("../middleware/auth.middleware"),
  asyncHandler = require("../utils/asyncHandler");
router.use(
  protect,
  authorize(
    "super_admin",
    "admin",
    "tenant_owner",
    "tenant_admin",
    "tenant_staff",
  ),
);
router.use((req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  next();
});
router.get(
  "/",
  asyncHandler(async (req, res) =>
    res.json({
      success: true,
      data: await require("../services/merchantFulfillment/queue").page(req.user,req.query),
    }),
  ),
);
router.get(
  "/:id",
  asyncHandler(async (req, res) =>
    res.json({
      success: true,
      data: {
        order: await require("../services/merchantFulfillment").get(
          req.params.id,
          req.user,
        ),
      },
    }),
  ),
);
router.post(
  "/:id/actions",
  asyncHandler(async (req, res) =>
    res.json({
      success: true,
      data: {
        order: await require("../services/merchantFulfillment/actions").act(
          req.params.id,
          req.body,
          req.user,
        ),
      },
    }),
  ),
);
router.get("/:id/refund-readiness", asyncHandler(async(req,res)=>res.json({success:true,data:{readiness:await require("../services/merchantFulfillment/refundReadiness").get(req.params.id,req.user)}})));
router.get(
  "/:id/settlement-statement",
  asyncHandler(async (req, res) =>
    res.json({
      success: true,
      data: {
        statement: await require("../services/merchantFulfillment/settlement/statement").child(
          req.params.id,
          req.user,
        ),
      },
    }),
  ),
);
router.get(
  "/:id/refunds",
  asyncHandler(async (req, res) =>
    res.json({
      success: true,
      data: {
        refunds: await require("../services/merchantFulfillment/refunds").list(
          req.params.id,
          req.user,
        ),
      },
    }),
  ),
);
router.post(
  "/:id/refunds",
  asyncHandler(async (req, res) =>
    res
      .status(201)
      .json({
        success: true,
        data: {
          refund:
            await require("../services/merchantFulfillment/refunds").request(
              req.params.id,
              req.body,
              req.user,
            ),
        },
      }),
  ),
);
async function ownRefund(req) {
  const refunds = require("../services/merchantFulfillment/refunds"),
    row = await refunds.get(req.params.refundId, req.user);
  if (row.merchantOrder !== req.params.id)
    throw new (require("../utils/errors").NotFoundError)(
      "Refund allocation not found",
    );
  return refunds;
}
router.post(
  "/:id/refunds/:refundId/execute",
  authorize("super_admin", "admin"),
  asyncHandler(async (req, res) => {
    if (Object.keys(req.body || {}).length)
      throw new (require("../utils/errors").ValidationError)(
        "Execution accepts no browser payment fields",
      );
    const refunds = await ownRefund(req);
    res.json({
      success: true,
      data: { refund: await refunds.execute(req.params.refundId, req.user) },
    });
  }),
);
router.post(
  "/:id/refunds/:refundId/reconcile",
  authorize("super_admin", "admin"),
  asyncHandler(async (req, res) => {
    if (Object.keys(req.body || {}).some((key) => key !== "providerRefundId"))
      throw new (require("../utils/errors").ValidationError)(
        "Provide only the original provider refund evidence ID",
      );
    const refunds = await ownRefund(req);
    res.json({
      success: true,
      data: {
        refund: await refunds.reconcile(
          req.params.refundId,
          req.user,
          req.body?.providerRefundId,
        ),
      },
    });
  }),
);
router.use('/:id/quantity',require('./merchantQuantity.routes'));
router.post('/:id/quantity-refunds',asyncHandler(async(req,res)=>res.status(201).json({success:true,data:{refund:await require('../services/merchantFulfillment/quantity/refunds').request(req.params.id,req.body,req.user)}})));
module.exports = router;
