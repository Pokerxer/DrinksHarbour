"use strict";
// Strict input gates for return disposition commands. Unknown keys, invented
// units and out-of-bounds text are rejected before any authority is loaded.
const { ValidationError } = require("../../../utils/errors");
const CONDITIONS = ["sealed", "damaged", "expired", "unverifiable"];
const TREATMENTS = ["restock", "retain_quarantine", "write_off"];
const EVIDENCE_KINDS = ["photo", "batch_reference", "operator_note"];
const OPERATION_LIMIT = 20;
// Fail-closed eligibility guards (not commercial policy): a treatment may only
// be decided on units whose recorded inspection condition allows it.
const ELIGIBLE = {
  restock: ["sealed"],
  write_off: ["damaged", "expired"],
  retain_quarantine: CONDITIONS,
};
const bounded = (value, max) =>
  typeof value === "string" && value.trim().length > 0 && value.length <= max;
const isRange = (range) =>
  !!range &&
  Number.isSafeInteger(range.start) &&
  range.start >= 0 &&
  Number.isSafeInteger(range.quantity) &&
  range.quantity > 0;
const isEvidence = (item) =>
  !!item &&
  EVIDENCE_KINDS.includes(item.kind) &&
  (item.reference === undefined || bounded(item.reference, 120));
function keys(input, allowed) {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    Object.keys(input).some((key) => !allowed.includes(key))
  )
    throw new ValidationError("Explicit disposition command payload required");
}
function ranges(value) {
  if (!Array.isArray(value) || !value.length || !value.every(isRange))
    throw new ValidationError("Exact recorded unit ranges required");
  return value.map((range) => ({ start: range.start, quantity: range.quantity }));
}
function validateVersioned(input) {
  keys(input, ["expectedVersion", "idempotencyKey", "note", "lines"]);
  if (
    !Number.isSafeInteger(input.expectedVersion) ||
    input.expectedVersion < 1 ||
    !bounded(input.idempotencyKey, 128) ||
    (input.note !== undefined && !bounded(input.note, 300))
  )
    throw new ValidationError(
      "Current version, stable key and bounded note required",
    );
}
function validateLines(input, pick) {
  if (
    !Array.isArray(input.lines) ||
    !input.lines.length ||
    !input.lines.every((line) => {
      if (
        !line ||
        typeof line.line !== "string" ||
        !line.line.trim() ||
        !Array.isArray(line.evidence === undefined ? [] : line.evidence) ||
        (line.evidence !== undefined && !line.evidence.every(isEvidence)) ||
        (line.note !== undefined && !bounded(line.note, 300))
      )
        return false;
      return pick(line);
    })
  )
    throw new ValidationError("Explicit per-line disposition payload required");
}
function validateInspection(input) {
  validateVersioned(input);
  validateLines(input, (line) =>
    CONDITIONS.includes(line.condition) ? ranges(line.ranges) : false,
  );
}
function validateDecision(input) {
  validateVersioned(input);
  validateLines(input, (line) =>
    TREATMENTS.includes(line.treatment) ? ranges(line.ranges) : false,
  );
}
const rangeKey = (range) => `${range.start}:${range.quantity}`;
module.exports = {
  CONDITIONS,
  TREATMENTS,
  ELIGIBLE,
  OPERATION_LIMIT,
  rangeKey,
  validateInspection,
  validateDecision,
};
