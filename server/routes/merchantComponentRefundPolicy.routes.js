"use strict";
const router = require("express").Router();
const { protect, authorize } = require("../middleware/auth.middleware"),
  asyncHandler = require("../utils/asyncHandler");
// Super-admin-only recording surface for immutable merchant component refund
// policies (workstream T). Recording is audited inside the service; reads are
// super_admin-only too. No other roles, no tenant scope: policy records are
// platform authority records.
router.use(protect, authorize("super_admin"));
router.post(
  "/",
  asyncHandler(async (req, res) =>
    res.status(201).json({
      success: true,
      data: {
        policy: await require("../services/merchantFulfillment/componentRefund/policy").record(
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
        policies: await require("../services/merchantFulfillment/componentRefund/policy").list(
          req.user,
        ),
      },
    }),
  ),
);
module.exports = router;
