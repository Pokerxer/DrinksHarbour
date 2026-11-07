"use strict";
const Hold = require("../../../models/OnlineStockReservation"),
  { id } = require("../allocation"),
  { ConflictError, ValidationError } = require("../../../utils/errors"),
  ranges = require("./ranges");
function lines(input) {
  if (
    !Array.isArray(input?.lines) ||
    !input.lines.length ||
    input.lines.length > 100 ||
    Object.keys(input).some(
      (key) => !["lines", "expectedVersion", "idempotencyKey"].includes(key),
    )
  )
    throw new ValidationError("Provide owned original line quantities");
  const result = input.lines
    .map((row) => {
      if (
        !row ||
        typeof row !== "object" ||
        Object.keys(row).some((key) => !["line", "quantity"].includes(key)) ||
        !/^[a-f\d]{24}$/i.test(row.line || "") ||
        !Number.isSafeInteger(row.quantity) ||
        row.quantity < 1
      )
        throw new ValidationError("Invalid original line quantity");
      return { line: row.line.toLowerCase(), quantity: row.quantity };
    })
    .sort((a, b) => a.line.localeCompare(b.line));
  if (new Set(result.map((row) => row.line)).size !== result.length)
    throw new ValidationError("Duplicate original line quantity");
  return result;
}
async function owned(child, parent, lineId, session) {
  const snapshot = child.lines.find((line) => id(line.line) === lineId),
    progress = child.quantityProgress?.find((row) => row.line === lineId),
    actual = parent.items.find((line) => id(line.fulfillmentLineId) === lineId);
  if (
    !snapshot ||
    !progress ||
    !actual ||
    id(actual.tenant) !== id(child.tenant) ||
    id(actual.warehouse) !== id(child.location) ||
    actual.quantity !== snapshot.quantity ||
    ["product", "subproduct", "size"].some(
      (key) => id(actual[key]) !== id(snapshot[key]),
    )
  )
    throw new ConflictError(
      "Original quantity line is not owned by this merchant",
    );
  const hold = await Hold.findOne({
    order: parent._id,
    tenant: child.tenant,
    warehouse: child.location,
    merchantOrder: child._id,
    fulfillmentLineId: lineId,
    reservationVersion: 2,
  }).session(session);
  if (
    !hold ||
    id(hold.product) !== id(snapshot.product) ||
    id(hold.subProduct) !== id(snapshot.subproduct) ||
    id(hold.size) !== id(snapshot.size) ||
    hold.quantity !== snapshot.quantity ||
    hold.consumedQuantity !== progress.shipped ||
    hold.releasedQuantity !== progress.cancelled
  )
    throw new ConflictError("Line reservation counters need reconciliation");
  const used = ranges.checked(hold.quantity, hold.unitDispositions || []);
  const count = (action) =>
    (hold.unitDispositions || [])
      .filter((row) => row.action === action)
      .reduce((n, row) => n + row.quantity, 0);
  if (
    count("consume") !== hold.consumedQuantity ||
    count("release") !== hold.releasedQuantity
  )
    throw new ConflictError("Original unit disposition needs reconciliation");
  return { snapshot, progress, actual, hold, used };
}
module.exports = { lines, owned };
