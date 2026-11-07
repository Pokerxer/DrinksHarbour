"use strict";
const router = require("express").Router();
const { protect, authorize } = require("../middleware/auth.middleware"),
  asyncHandler = require("../utils/asyncHandler");
// Super-admin-only recording surface for immutable Kora refund protocol/identity
// policies (workstream K). Recording is audited inside the service; reads are
// super_admin-only too. No other roles, no tenant scope: policy records are
// platform authority records. No policy is seeded; the real protocol review
// and identity decision remain external evidence recorded through these fields.
router.use(protect, authorize("super_admin"));
router.post(
  "/",
  asyncHandler(async (req, res) =>
    res.status(201).json({
      success: true,
      data: {
        policy: await require("../services/merchantFulfillment/koraRefund/policy").record(
          req.body,
          req.user,
        ),
      },
    }),
  ),
);
router.get(
  "/",
  asyncHandler(async (req, res) =>
    res.json({
      success: true,
      data: {
        policies: await require("../services/merchantFulfillment/koraRefund/policy").list(
          req.user,
        ),
      },
    }),
  ),
);
module.exports = router;
