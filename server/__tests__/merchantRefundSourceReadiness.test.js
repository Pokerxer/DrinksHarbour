"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { project } = require("../services/merchantFulfillment/refundReadiness");

const child = {
  currency: "NGN",
  merchandiseMinor: 1000,
  shippingMinor: 0,
  taxMinor: 0,
  refundReservedMinor: 0,
  refundedMinor: 0,
};

test("readiness enumerates per-original-source states without disclosing private identities", () => {
  const value = project(
    child,
    { provider: "paystack" },
    "",
    [
      {
        provider: "paystack",
        state: "supported",
        reason: "Original allocated receipt identity is supported for merchandise refunds.",
        reference: "dhm-secret-ref",
        transactionId: "918273",
        claimId: "paystack:platform:dhm-secret-ref",
      },
      {
        provider: "korapay",
        state: "review_required",
        reason:
          "Original tender refund capability requires review. Korapay fallback transactionId identity is ambiguous.",
        reference: "korapay-secret-ref",
        transactionId: "korapay-secret-ref",
      },
      {
        provider: "wallet",
        state: "review_required",
        reason: "Original tender refund capability requires review.",
        checkoutDebitId: "507f1f77bcf86cd799439011",
      },
    ],
  );
  assert.deepEqual(value.sources, [
    {
      provider: "paystack",
      state: "supported",
      reason:
        "Original allocated receipt identity is supported for merchandise refunds.",
    },
    {
      provider: "korapay",
      state: "review_required",
      reason:
        "Original tender refund capability requires review. Korapay fallback transactionId identity is ambiguous.",
    },
    {
      provider: "wallet",
      state: "review_required",
      reason: "Original tender refund capability requires review.",
    },
  ]);
  const serialized = JSON.stringify(value);
  for (const secret of [
    "dhm-secret-ref",
    "918273",
    "korapay-secret-ref",
    "507f1f77bcf86cd799439011",
    "providerReference",
  ])
    assert.equal(
      serialized.includes(secret),
      false,
      `projection leaked private identity fragment: ${secret}`,
    );
});

test("readiness derives fail-closed source states when discovery input is absent", () => {
  assert.deepEqual(project(child, { provider: "stripe" }, "").sources, [
    {
      provider: "stripe",
      state: "supported",
      reason:
        "Original allocated receipt identity is supported for merchandise refunds.",
    },
  ]);
  assert.deepEqual(project(child, { provider: "gift_card" }, "").sources, [
    {
      provider: "gift_card",
      state: "review_required",
      reason: "Original tender refund capability requires review.",
    },
  ]);
  assert.deepEqual(project(child, undefined, "issue").sources, [
    {
      provider: "unknown",
      state: "review_required",
      reason: "Original tender refund capability requires review.",
    },
  ]);
  assert.equal(
    project(child, { provider: "gift_card" }, "").merchandise.state,
    "review_required",
  );
});

test("malformed discovery entries fail closed to an unknown review-required source", () => {
  const value = project(child, undefined, "", [null, {}, 42]);
  assert.deepEqual(value.sources, [
    {
      provider: "unknown",
      state: "review_required",
      reason: "Original tender refund capability requires review.",
    },
    {
      provider: "unknown",
      state: "review_required",
      reason: "Original tender refund capability requires review.",
    },
    {
      provider: "unknown",
      state: "review_required",
      reason: "Original tender refund capability requires review.",
    },
  ]);
});

test("readiness states that zero-only cancellation has no approved no-money policy", () => {
  const value = project(child, { provider: "paystack" }, "");
  assert.deepEqual(value.zeroValueCancellation, {
    state: "review_required",
    reason:
      "Zero-only cancellation has no approved no-money policy; zero-value units release only within a positive supported refund.",
  });
});
