"use strict";
const router = require("express").Router(),
  service = require("../services/deliveryProviders/localDispatch"),
  engine = require("../services/delivery.service"),
  disposition = require("../services/delivery/returnDisposition");
const { protect, authorize } = require("../middleware/auth.middleware"),
  asyncHandler = require("../utils/asyncHandler"),
  dispositionPolicy = require("../services/delivery/returnDisposition/policy");
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
router.get('/configuration/locations', asyncHandler(async (req, res) => res.json({ success: true, data: await service.listConfigurationLocations(req.query, req.user) })));
router.get('/configuration/:tenant/:location', asyncHandler(async (req, res) => res.json({ success: true, data: await service.getConfiguration(req.params.tenant, req.params.location, req.query, req.user) })));
router.get(
  "/orders/:id/options",
  asyncHandler(async (req, res) =>
    res.json({
      success: true,
      data: await service.getDispatchOptions(req.params.id, req.user),
    }),
  ),
);
router.post(
  "/contracts",
  asyncHandler(async (req, res) =>
    res
      .status(201)
      .json({
        success: true,
        data: { contract: service.contractDTO(await service.reviewContract(req.body, req.user)) },
      }),
  ),
);
router.post(
  "/contracts/:id/revoke",
  asyncHandler(async (req, res) =>
    res.json({
      success: true,
      data: { contract: service.contractDTO(await service.revokeContract(req.params.id, req.user)) },
    }),
  ),
);
router.post(
  "/orders/:id/quotes",
  asyncHandler(async (req, res) =>
    res
      .status(201)
      .json({
        success: true,
        data: {
          quote: await service.quoteDispatch(req.params.id, req.body, req.user),
        },
      }),
  ),
);
router.post(
  "/orders/:id/bookings",
  asyncHandler(async (req, res) =>
    res.json({
      success: true,
      data: {
        booking: await service.bookDispatch(req.params.id, req.body, req.user),
      },
    }),
  ),
);
router.get(
  "/bookings/:id",
  asyncHandler(async (req, res) =>
    res.json({
      success: true,
      data: { booking: await service.getBooking(req.params.id, req.user) },
    }),
  ),
);
router.post(
  "/bookings/:id/cancel",
  asyncHandler(async (req, res) =>
    res.json({
      success: true,
      data: {
        booking: await service.cancelBooking(req.params.id, req.body, req.user),
      },
    }),
  ),
);
router.post(
  "/bookings/:id/dispatch",
  asyncHandler(async (req, res) =>
    res.json({
      success: true,
      data: {
        booking: await engine.dispatchManagedDelivery(
          req.params.id,
          req.body,
          req.user,
        ),
      },
    }),
  ),
);
router.post(
  "/bookings/:id/resolve",
  asyncHandler(async (req, res) =>
    res.json({
      success: true,
      data: {
        booking: await engine.resolveManagedDelivery(
          req.params.id,
          req.body,
          req.user,
        ),
      },
    }),
  ),
);
router.post("/bookings/:id/recover",asyncHandler(async(req,res)=>res.json({success:true,data:{booking:await service.recoverManagedDelivery(req.params.id,req.body,req.user)}})));
// Immutable disposition policy authority: recording and exact-ID revocation are
// super_admin-only (tenant roles are rejected by the router guard above; the
// narrower authorize below also excludes plain platform admins).
router.post(
  "/return-disposition-policies",
  authorize("super_admin"),
  asyncHandler(async (req, res) =>
    res.status(201).json({
      success: true,
      data: { policy: await dispositionPolicy.recordPolicy(req.body, req.user) },
    })
  ),
);
router.get(
  "/return-disposition-policies",
  authorize("super_admin"),
  asyncHandler(async (req, res) =>
    res.json({
      success: true,
      data: { policies: await dispositionPolicy.listPolicies(req.user) },
    })
  ),
);
router.post(
  "/return-disposition-policies/:id/revoke",
  authorize("super_admin"),
  asyncHandler(async (req, res) =>
    res.json({
      success: true,
      data: { policy: await dispositionPolicy.revokePolicy(req.params.id, req.user) },
    })
  ),
);
router.get(
  "/bookings/:id/return",
  asyncHandler(async (req, res) =>
    res.json({
      success: true,
      data: { return: await disposition.readDisposition(req.params.id, req.user) },
    }),
  ),
);
router.post(
  "/bookings/:id/return/inspect",
  asyncHandler(async (req, res) =>
    res.json({
      success: true,
      data: { return: await disposition.recordInspection(req.params.id, req.body, req.user) },
    }),
  ),
);
router.post(
  "/bookings/:id/return/decision",
  asyncHandler(async (req, res) =>
    res.json({
      success: true,
      data: { return: await disposition.recordDecision(req.params.id, req.body, req.user) },
    }),
  ),
);
router.post(
  "/bookings/:id/return/effects",
  asyncHandler(async (req, res) =>
    res.json({
      success: true,
      data: await disposition.requestEffects(req.params.id, req.body, req.user),
    }),
  ),
);
module.exports = router;
