"use strict";
function derive(child) {
  const total = child.lines.reduce((n, line) => n + line.quantity, 0),
    progress = child.quantityProgress || [],
    shipped = progress.reduce((n, row) => n + row.shipped, 0),
    delivered = progress.reduce((n, row) => n + row.delivered, 0),
    cancelled = progress.reduce((n, row) => n + row.cancelled, 0);
  if (cancelled === total) return "cancelled";
  if (shipped + cancelled === total)
    return delivered === shipped ? "delivered" : "shipped";
  if (shipped > 0) return "partially_shipped";
  return child.state === "picking"
    ? "picking"
    : child.state === "pending"
      ? "pending"
      : "accepted";
}
function parentState(rows) {
  const active = rows.filter((row) => row.state !== "cancelled");
  if (!active.length) return "cancelled";
  if (active.every((row) => row.state === "delivered")) return "delivered";
  if (active.every((row) => ["shipped", "delivered"].includes(row.state)))
    return "shipped";
  if (
    active.some((row) =>
      ["partially_shipped", "shipped", "delivered"].includes(row.state),
    )
  )
    return "partially_shipped";
  if (active.some((row) => ["accepted", "picking"].includes(row.state)))
    return "processing";
  return "confirmed";
}
module.exports = { derive, parentState };
