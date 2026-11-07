"use strict";
function bookingDTO(row) {
  const source = row.toObject ? row.toObject() : row;
  const view = Object.fromEntries(
    [
      "_id",
      "merchantOrder",
      "tenant",
      "location",
      "quote",
      "delivery",
      "activeDelivery",
      "amountMinor",
      "currency",
      "lines",
      "expectedVersion",
      "state",
      "version",
      "shipmentAllocation",
      "createdBy",
      "cancelledBy",
      "dispatchedBy",
      "resolvedBy",
      "createdAt",
      "updatedAt",
      "events",
    ]
      .filter((k) => source[k] !== undefined)
      .map((k) => [k, source[k]]),
  );
  const pick = (value, keys) =>
    Object.fromEntries(
      keys
        .filter((key) => value?.[key] !== undefined)
        .map((key) => [key, value[key]]),
    );
  view.lines = (source.lines || []).map((line) =>
    pick(line, ["line", "quantity"]),
  );
  view.events = (source.events || []).map((event) => ({
    ...pick(event, [
      "key",
      "source",
      "state",
      "allocation",
      "actor",
      "at",
      "reason",
    ]),
    ...(event.proof
      ? { proof: pick(event.proof, ["recipientName", "note"]) }
      : {}),
  }));
  return view;
}
module.exports = { bookingDTO };
