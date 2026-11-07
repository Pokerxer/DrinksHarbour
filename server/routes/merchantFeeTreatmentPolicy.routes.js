"use strict";
const router = require("express").Router();
const { protect, authorize } = require("../middleware/auth.middleware"),
  asyncHandler = require("../utils/asyncHandler");
// Super-admin-only recording surface for immutable, versioned fee-treatment
// policies (workstream Fb). Recording is audited inside the service; reads are
// super_admin-only too. No other roles, no tenant scope: policy records are
// platform authority records. Recording a policy authorizes nothing by
// itself — the provider fee bearer decision and future-journal treatment are
// RECORDED DATA surfaced by the fee-projection readers; no fee journal writer
// exists in this package, so there is no execution surface and no flag.
router.use(protect, authorize("super_admin"));
router.post(
  "/",
  asyncHandler(async (req, res) =>
    res.status(201).json({
      success: true,
      data: {
        policy: await require("../services/merchantFulfillment/feeTreatment/policy").record(
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
        policies: await require("../services/merchantFulfillment/feeTreatment/policy").list(
          req.user,
        ),
      },
    }),
  ),
);
module.exports = router;
