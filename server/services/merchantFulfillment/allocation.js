"use strict";
const crypto = require("node:crypto");
const { ConflictError } = require("../../utils/errors");
const id = (value) => String(value?._id || value || "");
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
function minor(value) {
  const n = Number(value);
  if (
    !Number.isFinite(n) ||
    n < 0 ||
    !Number.isSafeInteger(Math.round(n * 100)) ||
    Math.abs(n * 100 - Math.round(n * 100)) > 0.000001
  )
    throw new ConflictError("Accepted money snapshot is invalid");
  return Math.round(n * 100);
}
function prorata(total, weights) {
  const sum = weights.reduce((n, v) => n + v, 0);
  if (!Number.isSafeInteger(sum) || sum <= 0)
    throw new ConflictError("Positive merchandise basis required");
  const denominator = BigInt(sum),
    amount = BigInt(total);
  const rows = weights.map((weight, index) => {
    const product = amount * BigInt(weight);
    return {
      index,
      amount: Number(product / denominator),
      remainder: product % denominator,
    };
  });
  let remaining = total - rows.reduce((n, row) => n + row.amount, 0);
  for (const row of [...rows].sort((a, b) =>
    a.remainder === b.remainder
      ? a.index - b.index
      : a.remainder > b.remainder
        ? -1
        : 1,
  )) {
    if (!remaining) break;
    row.amount++;
    remaining--;
  }
  return rows.map((row) => row.amount);
}
function allocate(order) {
  if (order.currency !== "NGN" || !order.items?.length)
    throw new ConflictError(
      "Merchant allocation currently requires NGN mapped merchandise",
    );
  const groups = new Map();
  let gross = 0,
    discount = 0;
  for (const line of order.items) {
    if (
      !["tenant", "warehouse", "product", "subproduct", "size"].every((key) =>
        /^[a-f\d]{24}$/i.test(id(line[key])),
      ) ||
      !Number.isSafeInteger(line.quantity) ||
      line.quantity < 1
    )
      throw new ConflictError(
        "Every merchant line requires canonical location and variant identity",
      );
    const grossMinor = minor(line.itemSubtotal),
      discountMinor = minor(line.discountAmount || 0),
      netMinor = grossMinor - discountMinor;
    const tenantShareMinor = minor(line.tenantRevenueShare),
      commissionMinor = minor(line.platformCommission);
    if (netMinor < 0 || tenantShareMinor + commissionMinor !== netMinor)
      throw new ConflictError("Saved merchant revenue shares do not reconcile");
    const key = id(line.tenant) + ":" + id(line.warehouse);
    let group = groups.get(key);
    if (!group) {
      group = {
        _id: hash(id(order._id) + ":" + key),
        order: id(order._id),
        tenant: id(line.tenant),
        location: id(line.warehouse),
        currency: order.currency,
        lines: [],
        grossMinor: 0,
        discountMinor: 0,
        merchandiseMinor: 0,
        tenantShareMinor: 0,
        commissionMinor: 0,
      };
      groups.set(key, group);
    }
    group.lines.push({
      line: id(line.fulfillmentLineId || line._id),
      product: id(line.product),
      subproduct: id(line.subproduct),
      size: id(line.size),
      quantity: line.quantity,
      grossMinor,
      discountMinor,
      merchandiseMinor: netMinor,
      tenantShareMinor,
      commissionMinor,
    });
    for (const [field, value] of Object.entries({
      grossMinor,
      discountMinor,
      merchandiseMinor: netMinor,
      tenantShareMinor,
      commissionMinor,
    }))
      group[field] += value;
    gross += grossMinor;
    discount += discountMinor;
  }
  if (
    gross !== minor(order.subtotal) ||
    discount !== minor(order.discountTotal || 0)
  )
    throw new ConflictError(
      "Parent discounts and merchandise do not reconcile",
    );
  const rows = [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, value]) => value),
    weights = rows.map((row) => row.merchandiseMinor);
  const shippingMinor = minor(order.shippingFee || 0),
    taxMinor = minor(order.taxAmount || 0),
    totalMinor = minor(order.totalAmount);
  if (gross - discount + shippingMinor + taxMinor !== totalMinor)
    throw new ConflictError("Parent total does not match merchant allocation");
  const shipping = prorata(shippingMinor, weights),
    tax = prorata(taxMinor, weights);
  return rows.map((row, index) => ({
    ...row,
    shippingMinor: shipping[index],
    taxMinor: tax[index],
    totalMinor: row.merchandiseMinor + shipping[index] + tax[index],
    allocationPolicy: "merchandise-weighted-v1",
  }));
}
module.exports = { allocate, minor, prorata, id, hash };
