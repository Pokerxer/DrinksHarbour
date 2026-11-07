"use strict";
const { ConflictError } = require("../../utils/errors");
const providers = require("./refundProviders");
function stripe() {
  if (!process.env.STRIPE_SECRET_KEY)
    throw new ConflictError(
      "Original platform Stripe refund account is unavailable",
    );
  return require("stripe")(process.env.STRIPE_SECRET_KEY);
}
function paystackOptions() {
  if (!process.env.PAYSTACK_SECRET_KEY)
    throw new ConflictError(
      "Original platform Paystack refund account is unavailable",
    );
  return {
    timeout: 15000,
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
  };
}
function data(response) {
  if (response.data?.status !== true || !response.data.data)
    throw new ConflictError("Provider refund outcome requires reconciliation");
  return response.data.data;
}
async function submit(row) {
  if (row.account !== "platform")
    throw new ConflictError("Original refund account requires review");
  if (row.provider === "paystack")
    return data(
      await require("axios").post(
        "https://api.paystack.co/refund",
        {
          transaction: row.providerReference,
          amount: row.amountMinor,
          currency: row.currency,
          merchant_note: providers.note(row),
        },
        paystackOptions(),
      ),
    );
  if (row.provider !== "stripe")
    throw new ConflictError("Original refund provider requires review");
  return stripe().refunds.create(
    {
      payment_intent: row.providerReference,
      amount: row.amountMinor,
      metadata: {
        merchant_refund_allocation: String(row._id),
        merchant_order: row.merchantOrder,
        parent_order: String(row.order),
      },
    },
    { idempotencyKey: `merchant-refund:${row._id}` },
  );
}
async function fetch(id, row) {
  if (row?.provider === "paystack") {
    if (row.account !== "platform" || !providers.validRefundId("paystack", id))
      throw new ConflictError("Original provider refund evidence required");
    return data(
      await require("axios").get(
        `https://api.paystack.co/refund/${encodeURIComponent(id)}`,
        paystackOptions(),
      ),
    );
  }
  if (row && row.provider !== "stripe")
    throw new ConflictError("Original refund provider requires review");
  return stripe().refunds.retrieve(id);
}
module.exports = { submit, fetch };
