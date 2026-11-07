"use strict";
const router = require("express").Router({ mergeParams: true }),
  { protect, authorize } = require("../middleware/auth.middleware"),
  asyncHandler = require("../utils/asyncHandler"),
  commands = require("../services/merchantFulfillment/quantity/commands"),
  reads = require("../services/merchantFulfillment/quantity/reads");
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
  "/allocations",
  asyncHandler(async (req, res) =>
    res.json({
      success: true,
      data: await reads.list(req.params.id, req.user, req.query),
    }),
  ),
);
router.post(
  "/ship",
  asyncHandler(async (req, res) =>
    res
      .status(201)
      .json({
        success: true,
        data: {
          allocation: reads.dto(
            await commands.shipQuantities(req.params.id, req.body, req.user),
          ),
        },
      }),
  ),
);
router.post(
  "/allocations/:allocationId/deliver",
  asyncHandler(async (req, res) =>
    res.json({
      success: true,
      data: {
        allocation: reads.dto(
          await commands.deliverAllocation(
            req.params.id,
            req.params.allocationId,
            req.body,
            req.user,
          ),
        ),
      },
    }),
  ),
);
router.post(
  "/cancel",
  asyncHandler(async (req, res) => {
    const result = await commands.cancelQuantities(
      req.params.id,
      req.body,
      req.user,
    );
    res.json({
      success: true,
      data: {
        cancellation: {
          _id: result._id,
          lines: result.lines.map((line) => ({
            line: line.line,
            quantity: line.quantity,
            ranges: line.ranges.map((range) => ({
              start: range.start,
              quantity: range.quantity,
            })),
          })),
        },
      },
    });
  }),
);
router.post(
  "/zero-release",
  asyncHandler(async (req, res) => {
    const record = await require(
      "../services/merchantFulfillment/quantity/zeroOnlyRelease/release",
    ).releaseZeroUnits(req.params.id, req.body, req.user);
    res.json({
      success: true,
      data: {
        release: {
          _id: record._id,
          kind: record.kind,
          policyVersion: record.policyVersion,
          auditWording: record.auditWording,
          financials: record.financials,
          providerTransaction: record.providerTransaction,
          lines: record.lines.map((line) => ({
            line: line.line,
            quantity: line.quantity,
            ranges: line.ranges.map((range) => ({
              start: range.start,
              quantity: range.quantity,
            })),
          })),
        },
      },
    });
  }),
);
module.exports = router;
