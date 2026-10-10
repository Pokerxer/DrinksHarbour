const { id, DAY } = require("./series");
const { outstanding } = require("./transfer-evidence");
const num = (v) => (Number.isFinite(v) && v >= 0 ? v : 0);
function arrival(value, now) {
  const at = Date.parse(value);
  return Number.isFinite(at) && at >= now.getTime()
    ? new Date(at).toISOString()
    : null;
}
function incomingSupply(purchases, transfers, now) {
  const rows = [];
  for (const po of purchases) {
    if (
      po.type === "rfq" ||
      !["confirmed", "partially_received", "received", "validated"].includes(
        po.status,
      )
    )
      continue;
    for (const it of po.items || []) {
      let pending = Math.max(0, num(it.receivedQty) - num(it.postedQty));
      const outstanding = Math.max(
        0,
        num(it.quantity) - num(it.receivedQty) - num(it.returnedQty),
      );
      for (const receipt of po.receipts || []) {
        if (receipt.status !== "pending") continue;
        for (const received of receipt.items || []) {
          if (
            id(received.subProductId) !== id(it.subProductId) ||
            id(received.sizeId) !== id(it.sizeId) ||
            received.status === "cancelled"
          )
            continue;
          const quantity = Math.min(pending, num(received.quantityReceived));
          if (quantity > 0)
            rows.push({
              subProductId: id(it.subProductId),
              sizeId: id(it.sizeId),
              warehouseId: id(receipt.warehouseId || po.warehouse),
              quantity,
              arrival: now.toISOString(),
              source: "received_unposted",
              reference: receipt.receiptNumber || po.poNumber || id(po),
            });
          pending -= quantity;
        }
      }
      if (pending > 0)
        rows.push({
          subProductId: id(it.subProductId),
          sizeId: id(it.sizeId),
          warehouseId: id(po.warehouse),
          quantity: pending,
          arrival: now.toISOString(),
          source: "received_unposted",
          reference: po.poNumber || id(po),
        });
      if (outstanding > 0)
        rows.push({
          subProductId: id(it.subProductId),
          sizeId: id(it.sizeId),
          warehouseId: id(po.warehouse),
          quantity: outstanding,
          arrival: arrival(po.expectedArrival, now),
          source: "purchase_order",
          reference: po.poNumber || id(po),
        });
    }
  }
  for (const transfer of transfers) {
    if (
      !["confirmed", "in_transit", "partially_received"].includes(
        transfer.status,
      )
    )
      continue;
    for (const it of transfer.items || []) {
      const quantity = outstanding(transfer, it);
      if (quantity > 0)
        rows.push({
          subProductId: id(it.subProductId),
          sizeId: id(it.sizeId),
          warehouseId: id(transfer.destinationWarehouse),
          quantity,
          arrival: null,
          source: "transfer",
          reference: transfer.transferNumber || id(transfer),
        });
    }
  }
  return rows;
}
function vendorLeadTimes(purchases, now = new Date()) {
  const groups = new Map();
  for (const po of purchases) {
    if (!["received", "validated"].includes(po.status) || !po.fullyReceivedDate)
      continue;
    const start = Date.parse(po.confirmationDate || po.orderDate),
      end = Date.parse(po.fullyReceivedDate);
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      end < start ||
      end > now.getTime()
    )
      continue;
    const vendor = id(po.vendor),
      values = groups.get(vendor) || [];
    values.push(Math.max(1, Math.ceil((end - start) / DAY)));
    groups.set(vendor, values);
  }
  return new Map(
    [...groups]
      .filter(([, v]) => v.length >= 3)
      .map(([vendor, v]) => {
        v.sort((a, b) => a - b);
        const m = Math.floor(v.length / 2);
        return [vendor, v.length % 2 ? v[m] : Math.ceil((v[m - 1] + v[m]) / 2)];
      }),
  );
}
module.exports = { incomingSupply, vendorLeadTimes };
