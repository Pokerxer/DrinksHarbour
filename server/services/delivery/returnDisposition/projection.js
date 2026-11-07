"use strict";
// Private merchant disposition projection. Never exposes cost, money or
// customer data; always carries the explicit fail-closed effects state.
const UNSUPPORTED_EFFECTS = Object.freeze({
  supported: false,
  reasons: [
    "Return stock/cost treatment policy is not recorded; restock, write-off and COGS effects are unsupported",
  ],
});
function effectsState(source) {
  const consumptions = source.consumptions || [];
  if (consumptions.length)
    return {
      supported: true,
      policyVersion: consumptions[consumptions.length - 1].policyVersion,
      effectsRef: consumptions[consumptions.length - 1].effectsRef,
    };
  return { ...UNSUPPORTED_EFFECTS, reasons: [...UNSUPPORTED_EFFECTS.reasons] };
}
const pick = (value, keys) =>
  Object.fromEntries(
    keys.filter((key) => value?.[key] !== undefined).map((key) => [key, value[key]]),
  );
function dispositionDTO(row) {
  const source = row.toObject ? row.toObject() : row;
  return {
    ...pick(source, [
      "_id",
      "booking",
      "merchantOrder",
      "order",
      "tenant",
      "location",
      "shipmentAllocation",
      "disposition",
      "version",
      "receivedBy",
      "receivedAt",
      "reason",
    ]),
    lines: (source.lines || []).map((line) => ({
      line: String(line.line),
      quantity: line.quantity,
      ranges: (line.ranges || []).map((range) => ({
        start: range.start,
        quantity: range.quantity,
      })),
    })),
    inspections: (source.inspections || []).map((item) => ({
      ...pick(item, ["line", "condition", "note", "inspectedBy", "inspectedAt"]),
      ranges: (item.ranges || []).map((range) => ({
        start: range.start,
        quantity: range.quantity,
      })),
      evidence: (item.evidence || []).map((item) =>
        pick(item, ["kind", "reference"]),
      ),
    })),
    decisions: (source.decisions || []).map((item) => ({
      ...pick(item, ["line", "treatment", "note", "decidedBy", "decidedAt"]),
      ranges: (item.ranges || []).map((range) => ({
        start: range.start,
        quantity: range.quantity,
      })),
    })),
    operations: (source.operations || []).length,
    consumptions: (source.consumptions || []).map((item) => ({
      ...pick(item, ["line", "action", "effectsRef", "policyVersion", "actor", "at"]),
      ranges: (item.ranges || []).map((range) => ({
        start: range.start,
        quantity: range.quantity,
      })),
    })),
    effects: effectsState(source),
  };
}
module.exports = { dispositionDTO, UNSUPPORTED_EFFECTS, effectsState };
