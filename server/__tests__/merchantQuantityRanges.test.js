"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const target = path.resolve(
  __dirname,
  "../services/merchantFulfillment/quantity/ranges.js",
);
const load = () => (fs.existsSync(target) ? require(target) : {});
test("quantity ranges select exact remaining units without borrowing shipped, cancelled or financially blocked units", () => {
  const { select } = load();
  assert.equal(typeof select, "function");
  assert.deepEqual(
    select(
      6,
      [
        { start: 0, quantity: 1 },
        { start: 3, quantity: 1 },
      ],
      [{ start: 1, quantity: 1 }],
      2,
    ),
    [
      { start: 2, quantity: 1 },
      { start: 4, quantity: 1 },
    ],
  );
  assert.throws(
    () => select(3, [{ start: 0, quantity: 2 }], [], 2),
    /remaining|quantity/i,
  );
  assert.throws(
    () =>
      select(
        3,
        [
          { start: 0, quantity: 2 },
          { start: 1, quantity: 1 },
        ],
        [],
        1,
      ),
    /overlap/i,
  );
});
test("original FEFO batch ranges retain ownership when units are consumed out of order", () => {
  const { batchSlice } = load();
  assert.equal(typeof batchSlice, "function");
  assert.deepEqual(
    batchSlice(
      [
        { batch: "first", quantity: 2 },
        { batch: "second", quantity: 3 },
      ],
      [
        { start: 1, quantity: 1 },
        { start: 3, quantity: 2 },
      ],
      5,
    ),
    [
      { batch: "first", quantity: 1 },
      { batch: "second", quantity: 2 },
    ],
  );
});
test("exact unit money and commission ranges sum to original accepted pennies and shares", () => {
  const { money } = load();
  assert.equal(typeof money, "function");
  const pieces = [0, 1, 2].map((start) =>
    money({ quantity: 3, merchandiseMinor: 1001, commissionMinor: 130 }, [
      { start, quantity: 1 },
    ]),
  );
  assert.equal(
    pieces.reduce((n, p) => n + p.merchandiseMinor, 0),
    1001,
  );
  assert.equal(
    pieces.reduce((n, p) => n + p.commissionMinor, 0),
    130,
  );
  assert.equal(
    pieces.reduce((n, p) => n + p.tenantShareMinor, 0),
    871,
  );
  assert.deepEqual(
    money({ quantity: 3, merchandiseMinor: 1001, commissionMinor: 130 }, [
      { start: 0, quantity: 3 },
    ]),
    { merchandiseMinor: 1001, commissionMinor: 130, tenantShareMinor: 871 },
  );
});
