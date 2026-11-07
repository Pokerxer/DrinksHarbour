"use strict";
const router = require("express").Router();
const { protect, authorize } = require("../middleware/auth.middleware"),
  asyncHandler = require("../utils/asyncHandler"),
  authority = require("../services/merchantFulfillment/quantity/zeroOnlyRelease/policy");
// Super-admin-only recording surface for immutable zero-only no-money release
// policies (workstream Z). Recording is audited inside the service; reads are
// super_admin-only too. No tenant scope: policy records are platform
// authority records, and no version is ever defaulted or updated.
router.use(protect, authorize("super_admin"));
router.post(
  "/",
  asyncHandler(async (req, res) =>
    res.status(201).json({
      success: true,
      data: {
        policy: await authority.recordPolicy(req.body, req.user),
      },
    }),
  ),
);
router.get(
  "/",
  asyncHandler(async (req, res) =>
    res.json({
      success: true,
      data: { policies: await authority.listPolicies(req.user) },
    }),
  ),
);
module.exports = router;
