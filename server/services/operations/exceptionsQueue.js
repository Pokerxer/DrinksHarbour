"use strict";
// Platform operations exceptions queue (v1). Read-only projection over the
// existing reviewed models: uncertain/pending refund allocations, uncertain
// carrier operations and quarantined returns with pending/complete
// dispositions. No business engine, no writes, no new models. Platform-ops
// (super_admin/admin) only; tenant identity inside entries is informational
// and no query is scoped by caller tenant.
const mongoose = require("mongoose"),
  Refund = require("../../models/MerchantRefundAllocation"),
  Booking = require("../../models/MerchantCarrierBooking"),
  Return = require("../../models/MerchantDeliveryReturn"),
  { ForbiddenError, NotFoundError, ValidationError } = require("../../utils/errors");

const VERSION = 1;
const KINDS = ["refund", "carrier", "return"];
const REFUND_STATES = ["submitting", "uncertain"];
const CARRIER_STATES = ["submitting", "uncertain", "cancel_pending", "cancel_requested"];
// Exact reviewed wordings (refunds.js, external/tracking.js, external/bookings.js,
// delivery/returnDisposition contract). Never paraphrased.
const REFUND_ISSUE_WORDING =
  "Provider or ledger outcome requires reconciliation; do not resubmit";
const CARRIER_RECONCILIATION_WORDING = "Platform financial reconciliation required";
// Queue-display-only text introduced by the operations lead — not a recorded
// runtime reason string. Source artifact: the code comment at
// deliveryProviders/external/tracking.js:118 (covers cancel_pending only).
const CARRIER_CANCEL_PENDING_WORDING =
  "Ambiguous cancel is not retryable and does not release budget.";
// Queue-display-only text introduced by the operations lead — not a recorded
// runtime reason string (no recorded provenance artifact exists for this
// wording outside this queue display).
const CARRIER_CANCEL_REQUESTED_WORDING =
  "Cancellation was requested; confirmation requires authenticated provider evidence.";
const CARRIER_EVIDENCE_WORDING = "Carrier booking financial evidence requires review";
const CARRIER_REQUIREMENT_WORDING =
  "Known original provider shipment ID required; responsibility remains uncertain";
const REFUND_REQUIREMENT_WORDING =
  "Known original provider refund evidence required";
const RETURN_EFFECTS_UNSUPPORTED =
  "Return stock/cost treatment policy is not recorded; restock, write-off and COGS effects are unsupported";

function platformOps(actor) {
  if (!["super_admin", "admin"].includes(actor?.role))
    throw new ForbiddenError("Platform operations access required");
}
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
function refundEntry(row) {
  return {
    _id: String(row._id),
    merchantOrder: row.merchantOrder,
    order: String(row.order),
    tenant: String(row.tenant),
    currency: row.currency,
    amountMinor: row.amountMinor,
    state: row.state,
    issue: row.issue || REFUND_ISSUE_WORDING,
    createdAt: row.createdAt ?? null,
    ageDays: ageDays(row.createdAt),
  };
}
function carrierReason(row) {
  if (row.state === "cancel_pending") return CARRIER_CANCEL_PENDING_WORDING;
  if (row.state === "cancel_requested") return CARRIER_CANCEL_REQUESTED_WORDING;
  return CARRIER_RECONCILIATION_WORDING;
}
function carrierEntry(row) {
  const money =
    Number.isSafeInteger(row.rate?.amountMinor) &&
    row.rate.amountMinor >= 0 &&
    Number.isSafeInteger(row.rate?.displayMinor) &&
    row.rate.displayMinor >= 0;
  return {
    _id: row._id,
    merchantOrder: row.merchantOrder,
    order: String(row.order),
    tenant: String(row.tenant),
    allocationId: row.allocationId,
    state: row.state,
    providerStatus: row.providerStatus ?? null,
    amountMinor: money ? row.rate.amountMinor : null,
    displayMinor: money ? row.rate.displayMinor : null,
    currency: money ? "NGN" : null,
    lastObservedAt: row.lastObservedAt ?? null,
    createdAt: row.createdAt ?? null,
    ageDays: ageDays(row.createdAt),
    reason: money ? carrierReason(row) : CARRIER_EVIDENCE_WORDING,
  };
}
const rangeKey = (line, range) => `${line}:${range?.start}:${range?.quantity}`;
function returnEntry(row) {
  const inspected = [];
  for (const inspection of row.inspections || [])
    for (const range of inspection.ranges || [])
      inspected.push(rangeKey(inspection.line, range));
  const decided = new Set();
  for (const decision of row.decisions || [])
    for (const range of decision.ranges || [])
      decided.add(rangeKey(decision.line, range));
  return {
    _id: row._id,
    booking: row.booking,
    merchantOrder: row.merchantOrder,
    order: String(row.order),
    tenant: String(row.tenant),
    location: String(row.location),
    shipmentAllocation: row.shipmentAllocation,
    disposition: row.disposition,
    receivedAt: row.receivedAt ?? null,
    ageDays: ageDays(row.receivedAt),
    inspectedRanges: inspected.length,
    decidedRanges: inspected.filter((key) => decided.has(key)).length,
    dispositionState:
      inspected.length > 0 && inspected.every((key) => decided.has(key))
        ? "decided"
        : "pending",
    reason: RETURN_EFFECTS_UNSUPPORTED,
  };
}
const FILTERS = {
  refund: { state: { $in: REFUND_STATES } },
  carrier: { state: { $in: CARRIER_STATES } },
  return: { disposition: "quarantined" },
};
const MODELS = { refund: Refund, carrier: Booking, return: Return };
const PROJECT = { refund: refundEntry, carrier: carrierEntry, return: returnEntry };
const SORT = { refund: { createdAt: -1, _id: -1 }, carrier: { createdAt: -1, _id: -1 }, return: { receivedAt: -1, _id: -1 } };

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
    queueVersion: VERSION,
    kind: query.kind,
    entries: rows.map(PROJECT[query.kind]),
    total,
    page: query.page,
    pages: Math.max(1, Math.ceil(total / query.limit)),
    limit: query.limit,
  };
}

async function resolveSources(orderId) {
  try {
    return await require("../merchantFulfillment/refundSources/discovery").resolveOrderSources(
      orderId
    );
  } catch {
    return {
      status: "unknown",
      reason: "Original payment source discovery requires review.",
      sources: [],
    };
  }
}

async function refundDetail(row) {
  const sources = await resolveSources(row.order);
  // Wired reviewer-note helper: corroborate the exact recorded funding
  // identity through resolveStoredValueFunding. Only an already-resolved
  // funding provider+reference is used — never inferred. Wallet funding
  // stays honest-by-absence (not_recorded).
  let storedValueFunding = null;
  const source = sources.sources.length === 1 ? sources.sources[0] : null;
  if (source && ["wallet", "gift_card"].includes(source.provider)) {
    const funding = source.storedValue?.funding;
    if (funding?.status === "resolved" && funding.provider && funding.reference) {
      try {
        storedValueFunding =
          await require("../merchantFulfillment/refundSources/discovery")
            .resolveStoredValueFunding(funding.provider, funding.reference);
      } catch {
        storedValueFunding = {
          status: "unknown",
          reason: "Stored-value funding resolution requires review.",
        };
      }
    } else {
      storedValueFunding =
        funding ?? {
          status: "unknown",
          reason: "Stored-value funding resolution requires review.",
        };
    }
  }
  return {
    ...refundEntry(row),
    sources,
    storedValueFunding,
    reconcile: {
      supported: true,
      kind: 'refund',
      requirement: REFUND_REQUIREMENT_WORDING,
      wording:
        "Reconcile only with the known original provider refund ID; an authenticated processed retrieval settles once.",
    },
  };
}
function carrierDetail(row) {
  return {
    ...carrierEntry(row),
    reconcile: {
      supported: true,
      kind: 'carrier',
      requirement: CARRIER_REQUIREMENT_WORDING,
      providerIdKnown: /^SB-[A-Z0-9]{1,80}$/.test(row.providerId || ""),
    },
  };
}
function returnDetail(row) {
  return {
    ...returnEntry(row),
    lines: (row.lines || []).map((line) => ({
      line: line.line,
      quantity: line.quantity,
      ranges: (line.ranges || []).map((range) => ({
        start: range.start,
        quantity: range.quantity,
      })),
    })),
    effects: { supported: false, reasons: [RETURN_EFFECTS_UNSUPPORTED] },
    reconcile: { supported: false, reason: RETURN_EFFECTS_UNSUPPORTED },
  };
}
const DETAILS = { refund: refundDetail, carrier: carrierDetail, return: returnDetail };

async function loadException(kind, id) {
  if (!KINDS.includes(kind))
    throw new ValidationError("Unknown platform-ops queue kind");
  const Model = MODELS[kind];
  const filter = { ...FILTERS[kind] };
  if (kind === "refund") {
    if (!mongoose.isValidObjectId(String(id)))
      throw new NotFoundError("Platform operations exception not found");
    filter._id = id;
  } else filter._id = String(id);
  const row = await Model.findOne(filter).lean();
  if (!row) throw new NotFoundError("Platform operations exception not found");
  return row;
}

async function inspect(actor, kind, id) {
  platformOps(actor);
  const row = await loadException(kind, id);
  const detail = await DETAILS[kind](row);
  detail.audit = await require("./auditView").forEntity(kind, row);
  return detail;
}

module.exports = {
  VERSION,
  KINDS,
  RETURN_EFFECTS_UNSUPPORTED,
  platformOps,
  list,
  inspect,
  loadException,
};
