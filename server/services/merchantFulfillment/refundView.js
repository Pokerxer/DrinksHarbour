"use strict";
function unitRanges(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((row) => typeof row?.line === "string" && Array.isArray(row.ranges))
    .map((row) => ({
      line: row.line,
      ranges: row.ranges
        .filter((range) => Number.isSafeInteger(range?.start) && range.start >= 0 && Number.isSafeInteger(range?.quantity) && range.quantity > 0)
        .map((range) => ({ start: range.start, quantity: range.quantity })),
    }));
}
function dto(row) {
  const value = row.toObject ? row.toObject() : row;
  return Object.fromEntries(
    [
      "_id",
      "merchantOrder",
      "order",
      "tenant",
      "amountMinor",
      "fulfillmentVersion",
      "unitRanges",
      "currency",
      "reason",
      "state",
      "issue",
      "createdAt",
      "processedAt",
    ]
      .filter((key) => value[key] !== undefined)
      .map((key) => [key, key === "unitRanges" ? unitRanges(value[key]) : value[key]]),
  );
}
module.exports = dto;
