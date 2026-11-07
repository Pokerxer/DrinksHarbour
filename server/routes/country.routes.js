"use strict";
const router = require("express").Router();
const asyncHandler = require("express-async-handler");
const { protect, authorize } = require("../middleware/auth.middleware");
const country = require("../services/country");
const privateResponse = (req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  next();
};
// Public projections explicitly exclude all private evidence and audit history.
router.get(
  "/",
  asyncHandler(async (req, res) => {
    res
      .set("Cache-Control", "no-store")
      .json({ success: true, data: await country.listCountries() });
  }),
);
router.get(
  "/admin",
  protect,
  authorize("super_admin"),
  privateResponse,
  asyncHandler(async (req, res) => {
    res.json({
      success: true,
      data: await country.listCountries({ admin: true }),
    });
  }),
);
router.post(
  "/admin",
  protect,
  authorize("super_admin"),
  privateResponse,
  asyncHandler(async (req, res) => {
    res
      .status(201)
      .json({
        success: true,
        data: await country.createCountry(req.body, req.user, req.body.reason),
      });
  }),
);
router.put(
  "/admin/:code",
  protect,
  authorize("super_admin"),
  privateResponse,
  asyncHandler(async (req, res) => {
    res.json({
      success: true,
      data: await country.updateCountry(
        req.params.code,
        req.body,
        req.user,
        req.body.reason,
      ),
    });
  }),
);
router.post(
  "/admin/:code/review",
  protect,
  authorize("super_admin"),
  privateResponse,
  asyncHandler(async (req, res) => {
    res.json({
      success: true,
      data: await country.reviewCountry(
        req.params.code,
        req.body,
        req.user,
        req.body.reason,
      ),
    });
  }),
);
router.post(
  "/admin/:code/activation",
  protect,
  authorize("super_admin"),
  privateResponse,
  asyncHandler(async (req, res) => {
    res.json({
      success: true,
      data: await country.activateCountry(
        req.params.code,
        req.body,
        req.user,
        req.body.reason,
      ),
    });
  }),
);
router.get(
  "/:code",
  asyncHandler(async (req, res) => {
    res
      .set("Cache-Control", "no-store")
      .json({
        success: true,
        data: country.publicCountry(
          await country.resolveCountry(req.params.code),
        ),
      });
  }),
);
module.exports = router;
