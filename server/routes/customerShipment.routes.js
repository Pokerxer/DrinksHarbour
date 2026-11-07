"use strict";
const router = require("express").Router(),
  { protect } = require("../middleware/auth.middleware"),
  asyncHandler = require("../utils/asyncHandler");
router.use((req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  next();
});
router.get(
  "/:id",
  protect,
  asyncHandler(async (req, res) =>
    res.json({
      success: true,
      data: await require("../services/customerShipments/read").read(
        req.params.id,
        req.user,
        req.query,
      ),
    }),
  ),
);
module.exports = router;
