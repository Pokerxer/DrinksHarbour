"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
test("opt-in merchant model imports do not schedule production index migrations", () => {
  for (const name of [
    "MerchantOrder",
    "MerchantOrderSet",
    "MerchantFulfillmentOperation",
    "MerchantRefundAllocation",
    "MerchantRefundEvidence",
    "MerchantShipmentAllocation",
    "MerchantQuantityCancellation",
  ])
    assert.equal(
      require(`../models/${name}`).schema.options.autoIndex,
      false,
      name,
    );
});
