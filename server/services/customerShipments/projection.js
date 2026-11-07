"use strict";
const id = (value) => String(value?._id || value || "");
const text = (value) => (typeof value === "string" ? value : undefined);
const lifecycle = (value) =>
  [
    "pending",
    "accepted",
    "picking",
    "partially_shipped",
    "shipped",
    "delivered",
    "cancelled",
    "booked",
    "dispatched",
    "failed",
    "returning",
    "returned",
  ].includes(value)
    ? value
    : "awaiting_update";
const count = (value) =>
  Number.isSafeInteger(value) && value >= 0 ? value : 0;
function owns(row, child) {
  return (
    id(row.order) === id(child.order) &&
    id(row.tenant) === id(child.tenant) &&
    id(row.location) === id(child.location) &&
    row.merchantOrder === child._id
  );
}
function originalLines(child, parent) {
  const originals = new Map(
    (parent.items || [])
      .filter(
        (item) =>
          id(item.tenant) === id(child.tenant) &&
          id(item.warehouse) === id(child.location),
      )
      .map((item) => [id(item.fulfillmentLineId), item]),
  );
  if (
    !child.lines?.length ||
    child.lines.some((line) => {
      const saved = originals.get(id(line.line));
      return (
        !saved ||
        saved.quantity !== line.quantity ||
        ["product", "subproduct", "size"].some(
          (key) => id(saved[key]) !== id(line[key]),
        )
      );
    })
  )
    return null;
  return originals;
}
function shipmentItems(lines, child) {
  if (!Array.isArray(lines) || !lines.length) return null;
  const own = new Map(
    child.lines.map((line) => [id(line.line), line.quantity]),
  );
  const seen = new Set();
  if (
    lines.some(
      (line) =>
        !own.has(id(line.line)) ||
        seen.has(id(line.line)) ||
        !Number.isSafeInteger(line.quantity) ||
        line.quantity < 1 ||
        line.quantity > own.get(id(line.line)) ||
        (seen.add(id(line.line)), false),
    )
  )
    return null;
  return lines.map((line) => ({
    line: id(line.line),
    quantity: line.quantity,
  }));
}
function project({
  parent,
  children,
  allocations,
  bookings,
  pickups,
  refunds,
  tenants,
  products,
  carriers = [],
}) {
  const groups = [];
  for (const child of children) {
    const originals = originalLines(child, parent);
    if (!originals) continue;
    const items = child.lines.map((line) => {
      const quantity = count(line.quantity),
        progress = (child.quantityProgress || []).find(
          (row) => row.line === id(line.line),
        );
      const v2 = child.fulfillmentVersion === 2;
      const shipped = v2
        ? Math.min(quantity, count(progress?.shipped))
        : ["shipped", "delivered"].includes(child.state)
          ? quantity
          : 0;
      return {
        line: id(line.line),
        name:
          text(products.get(id(line.product))?.name) ||
          text(originals.get(id(line.line))?.productName) ||
          "Purchased item",
        quantity,
        shipped,
        delivered: v2
          ? Math.min(shipped, count(progress?.delivered))
          : child.state === "delivered"
            ? quantity
            : 0,
        cancelled: v2
          ? Math.min(quantity - shipped, count(progress?.cancelled))
          : child.state === "cancelled"
            ? quantity
            : 0,
      };
    });
    const ownBookings = bookings.filter((row) => owns(row, child));
    const shipments = [];
    for (const allocation of allocations.filter((row) => owns(row, child))) {
      const lines = shipmentItems(allocation.lines, child);
      if (!lines) continue;
      const booking = ownBookings.find(
        (row) =>
          row.shipmentAllocation === allocation._id &&
          (!allocation.dispatchBooking ||
            allocation.dispatchBooking === row._id),
      );
      const carrier = !booking && !allocation.dispatchBooking && carriers.find(row => owns(row, child) && row.allocationId === allocation._id);
      const carrierStatus = carrier && !['submitting', 'uncertain'].includes(carrier.state)
        ? ({ pending: 'booked', confirmed: 'booked', picked_up: 'dispatched', in_transit: 'dispatched', completed: 'carrier_reported_delivered', cancelled: 'carrier_cancelled' })[carrier.providerStatus]
        : undefined;
      shipments.push({
        id: allocation._id,
        method: booking || allocation.dispatchBooking ? "local_delivery" : carrier ? "carrier" : "merchant",
        status: booking
          ? lifecycle(booking.state)
          : allocation.dispatchBooking
            ? "awaiting_update"
            : carrier ? carrierStatus || 'awaiting_update' : lifecycle(allocation.state),
        items: lines,
      });
    }
    for (const booking of ownBookings.filter(
      (row) => !row.shipmentAllocation,
    )) {
      const lines = shipmentItems(booking.lines, child);
      if (!lines) continue;
      shipments.push({
        id: booking._id,
        method: "local_delivery",
        status: lifecycle(booking.state),
        items: lines,
      });
    }
    for (const pickup of pickups.filter(
      (row) =>
        owns(row, child) &&
        id(row.customer) === id(parent.user) &&
        row.provider === "pickup",
    )) {
      const pickupItems = items
        .map((item) => ({
          line: item.line,
          quantity:
            child.fulfillmentVersion === 2
              ? child.state === "delivered"
                ? item.delivered
                : item.quantity - item.cancelled
              : item.quantity,
        }))
        .filter((item) => item.quantity > 0);
      if (pickupItems.length)
        shipments.push({
          id: pickup._id,
          method: "pickup",
          status:
            child.state === "delivered"
              ? "delivered"
              : child.state === "cancelled"
                ? "cancelled"
                : "booked",
          items: pickupItems,
        });
    }
    const states = {
      reserved: "pending",
      submitting: "processing",
      uncertain: "needs_review",
      succeeded: "completed",
    };
    groups.push({
      id: child._id,
      merchantName: text(tenants.get(id(child.tenant))?.name) || "Merchant",
      status: lifecycle(child.state),
      items,
      shipments,
      refunds: refunds
        .filter(
          (row) =>
            row.merchantOrder === child._id &&
            id(row.order) === id(parent._id) &&
            id(row.tenant) === id(child.tenant) &&
            id(row.customer) === id(parent.user) &&
            states[row.state] &&
            Number.isSafeInteger(row.amountMinor) &&
            row.amountMinor >= 0 &&
            row.currency === child.currency,
        )
        .map((row) => ({
          status: states[row.state],
          amountMinor: row.amountMinor,
          currency: row.currency,
        })),
    });
  }
  return { orderId: id(parent._id), managed: true, groups };
}
module.exports = { project, originalLines };
