"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
test("readiness preserves accepted shipping and tax components without inventing refund or payout authority", () => {
  const source = require("../services/merchantFulfillment/refundReadiness");
  const value = source.project(
    {
      currency: "NGN",
      merchandiseMinor: 1001,
      shippingMinor: 301,
      taxMinor: 71,
      refundReservedMinor: 100,
      refundedMinor: 200,
    },
    { provider: "paystack" },
    "",
  );
  assert.equal(value.merchandise.availableMinor, 701);
  assert.deepEqual(value.shipping, {
    acceptedMinor: 301,
    state: "review_required",
    reason:
      "Original shipping refund and carrier-charge allocation policy requires review.",
  });
  assert.equal(value.tax.acceptedMinor, 71);
  assert.equal(value.tax.state, "review_required");
  assert.equal(value.payout.state, "review_required");
  assert.equal(value.goods.state, "independent");
  assert.equal(JSON.stringify(value).includes("providerReference"), false);
});
test("full financial cancellation cannot claim readiness while any merchandise outcome is reserved or unsettled", () => {
  const source = require("../services/merchantFulfillment/refundReadiness");
  for (const counters of [
    { refundReservedMinor: 1001, refundedMinor: 0 },
    { refundReservedMinor: 0, refundedMinor: 0 },
  ]) {
    const value = source.project(
      {
        currency: "NGN",
        merchandiseMinor: 1001,
        shippingMinor: 0,
        taxMinor: 0,
        ...counters,
      },
      { provider: "paystack" },
      "",
    );
    assert.equal(value.fullCancellationReady, false);
  }
});
