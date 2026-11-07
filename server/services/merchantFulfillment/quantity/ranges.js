"use strict";
const { ConflictError } = require("../../../utils/errors");
function checked(total, ranges) {
  if (!Number.isSafeInteger(total) || total < 1 || !Array.isArray(ranges))
    throw new ConflictError("Invalid original unit quantity");
  const rows = ranges
    .map((row) => ({ start: row.start, quantity: row.quantity }))
    .sort((a, b) => a.start - b.start);
  let end = 0;
  for (const row of rows) {
    if (
      !Number.isSafeInteger(row.start) ||
      row.start < 0 ||
      !Number.isSafeInteger(row.quantity) ||
      row.quantity < 1 ||
      row.start + row.quantity > total
    )
      throw new ConflictError("Invalid original unit range");
    if (row.start < end) throw new ConflictError("Unit ranges overlap");
    end = row.start + row.quantity;
  }
  return rows;
}
function select(total, used, blocked, quantity) {
  if (!Number.isSafeInteger(quantity) || quantity < 1)
    throw new ConflictError("Positive quantity required");
  const intervals = [...checked(total, used), ...checked(total, blocked)].sort(
      (a, b) => a.start - b.start,
    ),
    free = [];
  let cursor = 0;
  for (const row of intervals) {
    if (row.start > cursor)
      free.push({ start: cursor, quantity: row.start - cursor });
    cursor = Math.max(cursor, row.start + row.quantity);
  }
  if (cursor < total) free.push({ start: cursor, quantity: total - cursor });
  const result = [];
  let need = quantity;
  for (const row of free) {
    const take = Math.min(need, row.quantity);
    if (take) result.push({ start: row.start, quantity: take });
    need -= take;
    if (!need) break;
  }
  if (need) throw new ConflictError("Quantity exceeds remaining owned units");
  return result;
}
function batchSlice(allocations, ranges, total) {
  const wanted = checked(total, ranges);
  if (!allocations.length) return [];
  if (allocations.reduce((n, row) => n + row.quantity, 0) !== total)
    throw new ConflictError("Original batch quantity does not cover units");
  const result = [];
  let cursor = 0;
  for (const row of allocations) {
    const end = cursor + row.quantity;
    let take = 0;
    for (const range of wanted)
      take += Math.max(
        0,
        Math.min(end, range.start + range.quantity) -
          Math.max(cursor, range.start),
      );
    if (take) result.push({ batch: row.batch, quantity: take });
    cursor = end;
  }
  return result;
}
function rangeAmount(total, quantity, ranges) {
  if (!Number.isSafeInteger(total) || total < 0)
    throw new ConflictError("Invalid original minor-unit amount");
  const rows = checked(quantity, ranges),
    base = Math.floor(total / quantity),
    extra = total % quantity;
  return rows.reduce(
    (n, row) =>
      n +
      base * row.quantity +
      Math.max(0, Math.min(extra, row.start + row.quantity) - row.start),
    0,
  );
}
function money(line, ranges) {
  const rows = checked(line.quantity, ranges),
    merchandiseMinor = rangeAmount(line.merchandiseMinor, line.quantity, rows);
  if (
    !Number.isSafeInteger(line.commissionMinor) ||
    line.commissionMinor < 0 ||
    line.commissionMinor > line.merchandiseMinor
  )
    throw new ConflictError("Invalid original commission share");
  const prefix = (through) =>
    through
      ? rangeAmount(line.merchandiseMinor, line.quantity, [
          { start: 0, quantity: through },
        ])
      : 0;
  const fee = (amount) =>
    line.merchandiseMinor
      ? Number(
          (BigInt(amount) * BigInt(line.commissionMinor)) /
            BigInt(line.merchandiseMinor),
        )
      : 0;
  const commissionMinor = rows.reduce(
    (n, row) =>
      n + fee(prefix(row.start + row.quantity)) - fee(prefix(row.start)),
    0,
  );
  return {
    merchandiseMinor,
    commissionMinor,
    tenantShareMinor: merchandiseMinor - commissionMinor,
  };
}
module.exports = { checked, select, batchSlice, rangeAmount, money };
