"use strict";
const mongoose = require("mongoose"),
  { Schema } = mongoose;
// Physical receipt into quarantine only; no saleable stock or financial authority.
const schema = new Schema(
  {
    _id: String,
    booking: { type: String, required: true, immutable: true },
    merchantOrder: { type: String, required: true, immutable: true },
    order: { type: Schema.Types.ObjectId, required: true, immutable: true },
    tenant: { type: Schema.Types.ObjectId, required: true, immutable: true },
    location: { type: Schema.Types.ObjectId, required: true, immutable: true },
    shipmentAllocation: { type: String, required: true, immutable: true },
    lines: {
      type: [
        new Schema(
          {
            line: String,
            quantity: Number,
            ranges: [
              new Schema({ start: Number, quantity: Number }, { _id: false }),
            ],
          },
          { _id: false },
        ),
      ],
      required: true,
      immutable: true,
    },
    disposition: {
      type: String,
      enum: ["quarantined"],
      required: true,
      immutable: true,
    },
    receivedBy: {
      type: Schema.Types.ObjectId,
      required: true,
      immutable: true,
    },
    receivedAt: { type: Date, required: true, immutable: true },
    reason: { type: String, required: true, immutable: true },
    // Additive disposition evidence. Commands append bounded, key-scoped
    // subdocuments only; stock/COGS/money effects stay policy-gated elsewhere.
    version: { type: Number, default: 1 },
    operations: [
      new Schema(
        {
          key: { type: String, required: true },
          fingerprint: { type: String, required: true },
          kind: { type: String, required: true },
          at: { type: Date, required: true },
        },
        { _id: false },
      ),
    ],
    inspections: [
      new Schema(
        {
          line: { type: String, required: true },
          ranges: [
            new Schema({ start: Number, quantity: Number }, { _id: false }),
          ],
          condition: { type: String, required: true },
          evidence: [
            new Schema(
              { kind: { type: String, required: true }, reference: String },
              { _id: false },
            ),
          ],
          note: String,
          inspectedBy: { type: Schema.Types.ObjectId, required: true },
          inspectedAt: { type: Date, required: true },
        },
        { _id: false },
      ),
    ],
    decisions: [
      new Schema(
        {
          line: { type: String, required: true },
          ranges: [
            new Schema({ start: Number, quantity: Number }, { _id: false }),
          ],
          treatment: { type: String, required: true },
          note: String,
          decidedBy: { type: Schema.Types.ObjectId, required: true },
          decidedAt: { type: Date, required: true },
        },
        { _id: false },
      ),
    ],
    // Additive once-only consumption tracking for executed stock/COGS effects.
    // No money fields: the journal and goods-cost basis stay the single
    // financial ledger; this records which recorded units were consumed and
    // under which recorded policy version.
    consumptions: [
      new Schema(
        {
          line: { type: String, required: true },
          ranges: [
            new Schema({ start: Number, quantity: Number }, { _id: false }),
          ],
          action: {
            type: String,
            enum: ["restock", "write_off"],
            required: true,
          },
          effectsRef: { type: String, required: true },
          policyVersion: { type: Number, required: true },
          actor: { type: Schema.Types.ObjectId, required: true },
          at: { type: Date, required: true },
        },
        { _id: false },
      ),
    ],
  },
  { timestamps: true, autoIndex: false },
);
module.exports =
  mongoose.models.MerchantDeliveryReturn ||
  mongoose.model("MerchantDeliveryReturn", schema);
