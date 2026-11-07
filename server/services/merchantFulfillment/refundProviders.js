"use strict";
const { ConflictError } = require("../../utils/errors");
const note = (row) => `Merchant refund allocation ${row._id}`;
function validRefundId(provider, value) {
  return (
    typeof value === "string" &&
    (provider === "paystack"
      ? /^[1-9]\d{0,15}$/.test(value) && Number.isSafeInteger(Number(value))
      : /^re_[A-Za-z0-9_]{1,150}$/.test(value))
  );
}
function paystackEvidence(row, result) {
  const transaction = result?.transaction;
  const identity =
    transaction && typeof transaction === "object"
      ? transaction.id
      : transaction;
  const refundId = String(result?.id);
  if (
    !result ||
    !validRefundId("paystack", refundId) ||
    !row.providerTransactionId ||
    String(identity) !== row.providerTransactionId ||
    (transaction &&
      typeof transaction === "object" &&
      transaction.reference !== row.providerReference) ||
    result.amount !== row.amountMinor ||
    String(result.currency).toUpperCase() !== row.currency ||
    (row.providerRefundId
      ? row.providerRefundId !== refundId
      : result.merchant_note !== note(row))
  )
    throw new ConflictError(
      "Provider refund evidence does not match saved allocation",
    );
}
const succeeded = (row, result) =>
  result?.status === (row.provider === "paystack" ? "processed" : "succeeded");
module.exports = { note, validRefundId, paystackEvidence, succeeded };
