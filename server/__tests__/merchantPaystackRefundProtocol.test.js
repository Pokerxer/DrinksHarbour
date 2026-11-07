"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const authority = require("../services/merchantFulfillment/refundAuthority");
const row = {
  _id: "allocation",
  merchantOrder: "child",
  order: "parent",
  provider: "paystack",
  account: "platform",
  providerReference: "original_reference",
  providerTransactionId: "1641",
  amountMinor: 2501,
  currency: "NGN",
};
const evidence = {
  id: 71,
  transaction: 1641,
  amount: 2501,
  currency: "NGN",
  status: "processed",
  merchant_note: "Merchant refund allocation allocation",
};
test("Paystack numeric original transaction evidence binds exact saved allocation and preserves subunit amount", () => {
  assert.doesNotThrow(() => authority.evidence(row, evidence));
  assert.doesNotThrow(() =>
    authority.evidence(row, {
      ...evidence,
      transaction: { id: 1641, reference: "original_reference" },
    }),
  );
});
test("Paystack equal-value refund cannot substitute foreign original transaction, currency, allocation or known refund ID", () => {
  for (const changed of [
    { transaction: 1642 },
    { amount: 2500 },
    { currency: "GHS" },
    { merchant_note: "unrelated" },
    { transaction: { id: 1641, reference: "foreign" } },
  ])
    assert.throws(
      () => authority.evidence(row, { ...evidence, ...changed }),
      /evidence|allocation/,
    );
  assert.throws(
    () => authority.evidence({ ...row, providerRefundId: "72" }, evidence),
    /evidence|allocation/,
  );
  assert.throws(
    () =>
      authority.evidence(
        { ...row, providerTransactionId: undefined },
        evidence,
      ),
    /evidence|allocation/,
  );
});
test("saved Paystack create identity permits retrieval without note but never permits another same-amount refund", () => {
  assert.doesNotThrow(() =>
    authority.evidence(
      { ...row, providerRefundId: "71" },
      { ...evidence, merchant_note: undefined },
    ),
  );
  assert.throws(
    () =>
      authority.evidence(
        { ...row, providerRefundId: "72" },
        { ...evidence, merchant_note: undefined },
      ),
    /evidence|allocation/,
  );
});
