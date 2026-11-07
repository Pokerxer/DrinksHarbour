"use strict";
// Mechanism reservations queue (v1). Read-only platform-ops projection of the
// operator-facing recorded states of the kora-refund (K) and payout-transfer
// (P) mechanisms — kora reservations in `requested|uncertain` and payout
// transfers in `executing|uncertain`: the mechanisms' own reserved states with
// no terminal release (uncertainty reconciles by evidence; a requested orphan
// from a process death between the kora reserve and finalize phases is
// operator-facing by that mechanism's own documented behavior). Mirrors the
// exceptionsQueue idioms (batched count/find, whitelisted entries, zero
// writes, page/limit validation). There is deliberately NO mutation route for
// these commands — both mechanisms' command surfaces are service-level and
// the only mutation routes remain the four super-admin policy recording
// routes on their own routers.
const Refund = require("../../models/MerchantKoraRefundAllocation"),
  Transfer = require("../../models/MerchantPayoutTransfer"),
  { NotFoundError, ValidationError } = require("../../utils/errors");
const VERSION = 1;
const KINDS = ["kora_refund", "payout_transfer"];
const KORA_STATES = ["requested", "uncertain"];
const PAYOUT_STATES = ["executing", "uncertain"];
// Exact recorded wordings first: an uncertain kora row carries its own
// recorded issue verbatim (row.issue) and an executing/uncertain payout row
// carries row.lastError verbatim when recorded. The strings below are
// queue-display-only texts introduced by the operations lead (not recorded
// runtime reason strings), each with provenance:
const KORA_REQUESTED_WORDING =
  "Kora refund reservation is committed and awaits the provider outcome or operator reconciliation.";
// display-only (requested = phase-1 reserve commit before phase-3 finalize;
// mirrors the O-lead cancel_requested display precedent).
const KORA_AMBIGUOUS_DEFAULT =
  "Provider refund outcome requires reconciliation; do not resubmit";
// display-only fallback for an uncertain row that carries no recorded issue.
const PAYOUT_EXECUTING_WORDING =
  "Payout transfer reservation is claimed by its executing state; responsibility is never released without evidence.";
// display-only (provenance: the payout transfer executing-claim semantics in
// payout/transfer.js — responsibility is never released without evidence).
const PAYOUT_UNCERTAIN_WORDING =
  "Awaiting once-only authenticated provider transfer evidence; a provider report never becomes a financial fact.";
// display-only (provenance: the MerchantPayoutTransfer model header comment —
// "A provider REPORT never becomes a financial fact").
// Platform operations exposes no mutation surface for the mechanism commands
// (service-level by design): reconcile blocks in the detail views are
// read-only statements, display-only text (operations-lead wording).
const KORA_RECONCILE_REASON =
  "Kora refund reconciliation is a service-level mechanism command; platform operations exposes no mutation route for it.";
const PAYOUT_RECONCILE_REASON =
  "Payout transfer reconciliation is a service-level mechanism command; platform operations exposes no mutation route for it.";

const platformOps = (...args) => require("./exceptionsQueue").platformOps(...args);
function ageDays(from) {
  const time = new Date(from).getTime();
  if (!Number.isFinite(time)) return null;
  return Math.max(0, Math.floor((Date.now() - time) / 86400000));
}
function integer(value, name, fallback, max) {
  if (value === undefined) return fallback;
  if (typeof value !== "number" && typeof value !== "string")
    throw new ValidationError(`Queue ${name} must be a positive integer`);
  if (!/^\d+$/.test(String(value)))
    throw new ValidationError(`Queue ${name} must be a positive integer`);
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1 || number > max)
    throw new ValidationError(`Queue ${name} exceeds its supported range`);
  return number;
}
function options(input) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new ValidationError("Unsupported platform-ops queue filters");
  if (Object.keys(input).some((key) => !["kind", "page", "limit"].includes(key)))
    throw new ValidationError("Unsupported platform-ops queue filters");
  if (!KINDS.includes(input.kind))
    throw new ValidationError("Unknown platform-ops queue kind");
  return {
    kind: input.kind,
    page: integer(input.page, "page", 1, 10000),
    limit: integer(input.limit, "limit", 25, 100),
  };
}
// Whitelisted list entries: no claim identity, no provider refund id, no
// account reference, no submitted provider identity — those details belong to
// the super-admin-gated inspect detail only.
function koraEntry(row) {
  const uncertain = row.state === "uncertain";
  const reason = uncertain
    ? row.issue || KORA_AMBIGUOUS_DEFAULT
    : KORA_REQUESTED_WORDING;
  return {
    _id: row._id,
    order: String(row.order),
    tenant: null,
    currency: row.currency,
    amountMinor: row.amountMinor,
    state: row.state,
    ...(uncertain ? { issue: reason } : {}),
    reason,
    createdAt: row.createdAt ?? null,
    ageDays: ageDays(row.createdAt),
  };
}
function payoutEntry(row) {
  return {
    _id: row._id,
    child: row.child,
    order: String(row.order),
    tenant: String(row.tenant),
    currency: row.currency,
    amountMinor: row.amountMinor,
    statementVersion: row.statementVersion,
    state: row.state,
    reason:
      row.lastError ||
      (row.state === "executing"
        ? PAYOUT_EXECUTING_WORDING
        : PAYOUT_UNCERTAIN_WORDING),
    createdAt: row.createdAt ?? null,
    ageDays: ageDays(row.createdAt),
  };
}
const FILTERS = {
  kora_refund: { state: { $in: KORA_STATES } },
  payout_transfer: { state: { $in: PAYOUT_STATES } },
};
const MODELS = { kora_refund: Refund, payout_transfer: Transfer };
const PROJECT = { kora_refund: koraEntry, payout_transfer: payoutEntry };
const SORT = {
  kora_refund: { createdAt: -1, _id: -1 },
  payout_transfer: { createdAt: -1, _id: -1 },
};

async function list(actor, input = {}) {
  platformOps(actor);
  const query = options(input);
  const filter = { ...FILTERS[query.kind] };
  const Model = MODELS[query.kind];
  const [total, rows] = await Promise.all([
    Model.countDocuments(filter),
    Model.find(filter)
      .sort(SORT[query.kind])
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
  ]);
  return {
    mechanismQueueVersion: VERSION,
    kind: query.kind,
    entries: rows.map(PROJECT[query.kind]),
    total,
    page: query.page,
    pages: Math.max(1, Math.ceil(total / query.limit)),
    limit: query.limit,
  };
}
function koraDetail(row) {
  return {
    ...koraEntry(row),
    claim: row.claim,
    providerReference: row.providerReference,
    receiptTransactionId: row.receiptTransactionId ?? null,
    fallbackAccepted: row.fallbackAccepted,
    providerRefundId: row.providerRefundId ?? null,
    policyVersion: row.policyVersion,
    remainderMinorAfter: row.remainderMinorAfter,
    reconcile: { supported: false, reason: KORA_RECONCILE_REASON },
  };
}
function payoutDetail(row) {
  return {
    ...payoutEntry(row),
    submittedTransferId: row.submittedTransferId ?? null,
    lastError: row.lastError ?? null,
    reviewedAt: row.reviewedAt ?? null,
    balanceClaimedMinor: row.balanceClaimedMinor ?? 0,
    reconcile: { supported: false, reason: PAYOUT_RECONCILE_REASON },
  };
}
const DETAILS = { kora_refund: koraDetail, payout_transfer: payoutDetail };

async function loadException(kind, id) {
  if (!KINDS.includes(kind))
    throw new ValidationError("Unknown platform-ops queue kind");
  const row = await MODELS[kind]
    .findOne({ ...FILTERS[kind], _id: String(id) })
    .lean();
  if (!row) throw new NotFoundError("Platform operations exception not found");
  return row;
}

async function inspect(actor, kind, id) {
  platformOps(actor);
  const row = await loadException(kind, id);
  const detail = DETAILS[kind](row);
  detail.audit = await require("./auditView").forEntity(kind, row);
  return detail;
}

// Unresolved recorded reservation/transfer counts for the readiness snapshot.
async function counts() {
  const [kora_refund, payout_transfer] = await Promise.all([
    Refund.countDocuments({ state: { $in: KORA_STATES } }),
    Transfer.countDocuments({ state: { $in: PAYOUT_STATES } }),
  ]);
  return { kora_refund, payout_transfer };
}

module.exports = {
  VERSION,
  KINDS,
  counts,
  list,
  inspect,
  loadException,
};
