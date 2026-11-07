"use strict";
const mongoose = require("mongoose"),
  { Schema } = mongoose;

// Recorded payout balance guard (workstream P): the per-child conservation
// ledger of the statement-linked transferable receivable. `netMinor` is the
// child's freshest settlement-statement net receivable (refreshed, only ever
// decreased); `heldMinor` the recorded holds total; `transferredMinor` the
// total consumed by transfers. All advances are conditional server-side
// predicates against the CURRENT committed document, so concurrent commands
// can never over-transfer:
//   transferredMinor + heldMinor + amount ≤ netMinor
// Triggered hold is exactly one conservation mechanism; there is no second
// ledger — the settlement statement remains the money authority.
module.exports =
  mongoose.models.MerchantPayoutBalance ||
  mongoose.model(
    "MerchantPayoutBalance",
    new Schema(
      {
        _id: { type: String, required: true },
        netMinor: { type: Number, required: true },
        heldMinor: {
          type: Number,
          default: 0,
          validate: { validator: Number.isSafeInteger, message: "Balance guard fields must be safe integers" },
        },
        transferredMinor: {
          type: Number,
          default: 0,
          validate: { validator: Number.isSafeInteger, message: "Balance guard fields must be safe integers" },
        },
      },
      { timestamps: true, autoIndex: false },
    ),
  );
