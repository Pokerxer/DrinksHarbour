"use strict";
// Once-only exact restock: binds every decided range to the original consumed
// shipment evidence and restores the exact recorded batch/location units.
const { ConflictError } = require("../../../utils/errors"),
  { id } = require("../../merchantFulfillment/allocation"),
  quantityRanges = require("../../merchantFulfillment/quantity/ranges"),
  ownership = require("../../merchantFulfillment/quantity/ownership");
// Exact original batch evidence: the allocation's recorded batchAllocations
// were assigned over its recorded unit ranges in order, so restoring a subset
// of those units maps each wanted unit back to its original batch.
function batchEvidence(allocationLine, ranges) {
  const queue = [];
  for (const slice of allocationLine?.batchAllocations || [])
    for (let unit = 0; unit < slice.quantity; unit++) queue.push(slice.batch);
  if (!queue.length) return [];
  const owned = new Map();
  let cursor = 0;
  for (const range of [...(allocationLine.ranges || [])].sort((a, b) => a.start - b.start))
    for (let unit = range.start; unit < range.start + range.quantity; unit++)
      owned.set(unit, queue[cursor++]);
  const result = new Map();
  for (const range of ranges)
    for (let unit = range.start; unit < range.start + range.quantity; unit++) {
      const batch = owned.get(unit);
      if (!batch)
        throw new ConflictError("Original batch evidence is unavailable for restock");
      result.set(String(batch), (result.get(String(batch)) || 0) + 1);
    }
  return [...result].map(([batch, quantity]) => ({ batch, quantity }));
}
async function restock(record, child, parent, lines, effectsRef, actor, session) {
  const Stock = require("../../../models/WarehouseStock"),
    Batch = require("../../../models/WarehouseBatch"),
    Movement = require("../../../models/WarehouseMovement"),
    Allocation = require("../../../models/MerchantShipmentAllocation");
  const allocation = await Allocation.findOne({
    _id: record.shipmentAllocation,
    merchantOrder: record.merchantOrder,
    order: record.order,
    tenant: record.tenant,
    location: record.location,
  }).session(session);
  if (!allocation)
    throw new ConflictError("Original shipment allocation requires reconciliation");
  const restored = [];
  for (const entry of lines) {
    const childLine = child.lines.find((line) => id(line.line) === entry.line);
    if (!childLine)
      throw new ConflictError("Restock ranges must match original recorded units");
    const ranges = quantityRanges.checked(childLine.quantity, entry.ranges);
    const { hold } = await ownership.owned(child, parent, entry.line, session);
    const consumed = (hold.unitDispositions || []).filter(
      (row) =>
        row.action === "consume" && row.allocation === record.shipmentAllocation,
    );
    if (
      ranges.some(
        (range) =>
          !consumed.some(
            (row) => row.start === range.start && row.quantity === range.quantity,
          ),
      )
    )
      throw new ConflictError(
        "Restock ranges must match the original consumed shipment evidence",
      );
    const allocationLine = allocation.lines.find(
      (line) => String(line.line) === entry.line,
    );
    const batches = batchEvidence(allocationLine, ranges);
    const key = {
      tenant: record.tenant,
      warehouse: record.location,
      subProduct: hold.subProduct,
      size: hold.size,
    };
    const quantity = ranges.reduce((sum, range) => sum + range.quantity, 0);
    const stock = await Stock.findOneAndUpdate(
      key,
      { $inc: { currentQuantity: quantity } },
      { session, returnDocument: "after" },
    );
    if (!stock)
      throw new ConflictError("Original restock location stock requires reconciliation");
    for (const slice of batches) {
      const restoredBatch = await Batch.updateOne(
        { _id: slice.batch, ...key },
        { $inc: { quantity: slice.quantity } },
        { session },
      );
      if (!restoredBatch.modifiedCount)
        throw new ConflictError("Original batch evidence is unavailable for restock");
    }
    const balanceAfter = stock.currentQuantity;
    await Movement.create(
      [
        {
          ...key,
          type: "returned",
          quantity,
          balanceBefore: balanceAfter - quantity,
          balanceAfter,
          stockChange: quantity,
          reference: effectsRef,
          performedBy: actor._id,
        },
      ],
      { session },
    );
    await require("../../salesReservations/stock").rollup(key, session);
    restored.push({ line: entry.line, ranges });
  }
  return restored;
}
module.exports = { restock, batchEvidence };
