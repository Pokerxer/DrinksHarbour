"use strict";
// Once-only write-off: reverses the frozen goods cost basis of the decided
// ranges through the postCost precedent (Journal.exists refDoc guard). Money
// lives only in the journal and goods-cost basis — never on the return record.
const mongoose = require("mongoose"),
  { ConflictError } = require("../../../utils/errors"),
  { id } = require("../../merchantFulfillment/allocation"),
  { basisFor, postCost } = require("../../merchantFulfillment/goodsCostBasis"),
  quantityRanges = require("../../merchantFulfillment/quantity/ranges");
async function writeOff(record, child, parent, lines, effectsRef, actor, session) {
  const { basis, original } = await basisFor(parent, child, session, 2);
  const selected = [];
  let amount = 0;
  for (const entry of lines) {
    const childLine = child.lines.find((line) => id(line.line) === entry.line);
    if (!childLine)
      throw new ConflictError("Write-off ranges must match original recorded units");
    const ranges = quantityRanges.checked(childLine.quantity, entry.ranges);
    for (const prior of basis.cancellations || [])
      for (const priorLine of prior.unitRanges || [])
        if (
          priorLine.line === entry.line &&
          ranges.some(
            (range) =>
              (priorLine.ranges || []).some(
                (row) =>
                  row.start < range.start + range.quantity &&
                  range.start < row.start + row.quantity,
              ),
          )
        )
          throw new ConflictError(
            "Original goods cost for these units already carries a cancellation effect",
          );
    const cost = basis.lines.find(
      (row) => row.line === entry.line && row.merchantOrder === id(child),
    );
    if (!cost) throw new ConflictError("Frozen goods cost basis requires reconciliation");
    amount += quantityRanges.rangeAmount(cost.costMinor, childLine.quantity, ranges);
    selected.push({ line: entry.line, ranges });
  }
  await postCost({
    basis,
    original,
    child,
    amount,
    journalRef: new mongoose.Types.ObjectId(effectsRef.slice(0, 24)),
    actor,
    session,
    evidence: { allocation: record.shipmentAllocation, unitRanges: selected },
  });
  return selected;
}
module.exports = { writeOff };
