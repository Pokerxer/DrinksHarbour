"use strict";
// Fee-treatment PROJECTION (workstream Fb) — a PURE RECORD projection of the
// recorded provider fee bearer / accounting treatment authority.
//
// NOT a measurement engine. Discovered facts (Q9 / accounting.orders.js):
// the marketplace posting set has NO provider-fee account at all (the tenant
// journal posts 1300/6500/4000, 2100 pos-only, 4100 tenant-direct) and no
// provider-fee record, journal or measurement exists in the merchant refund
// path. Historical fees therefore stay unknown FOREVER — never backfilled,
// never inferred. This module reads recorded MerchantFeeTreatmentPolicy
// versions and surfaces them verbatim as data; nothing here writes.
//
// Per-flow completeness is NOT required: an unrecorded flow surfaces an
// explicit fail-closed "not recorded" state. The only executable historical
// rule is `none_recorded_stays_unknown`; any other recorded rule is surfaced
// as requiring a future measurement mechanism. No fee figure is EVER output:
// the projection carries no amounts and never will without a separate
// reviewed fee-measurement mechanism.
const projectionVersion = 1;
const FLOWS = require("../../../models/MerchantFeeTreatmentPolicy").FLOWS;
const { activeForFlow } = require("./policy");

const NOTE =
  "No provider fee records exist; treatment is recorded-not-measured. Recorded bearer decisions surface as data only.";
const FIGURES = "none";
const STAYS_UNKNOWN =
  "No provider fee records exist in the marketplace path; historical fees stay unknown forever and are never backfilled or inferred.";
const MEASUREMENT =
  "Recorded historical-fee rule describes records a measurement mechanism does not exist to produce; historical fee figures stay unknown until such a mechanism is separately reviewed.";
const NOT_RECORDED =
  "Provider fee bearer, future-fee treatment and historical-fee rule for this flow are not recorded; fee treatment authority fails closed until a super admin records a version.";
const ACCOUNTING = {
  feeAccountExists: false,
  note:
    "The marketplace posting set has no fee account (accounting.orders.js): the tenant journal posts 1300/6500/4000 with no provider-fee line, and no fee journal write exists in this package.",
};

function notRecorded(flow) {
  return {
    flow,
    state: "not_recorded",
    bearer: null,
    policyId: null,
    policyVersion: null,
    decisionReference: null,
    futureJournalTreatment: null,
    historical: {
      rule: null,
      state: "stays_unknown",
      reason: STAYS_UNKNOWN,
      figures: FIGURES,
    },
    reason: NOT_RECORDED,
  };
}

// Explicit per-flow read — the fail-closed resolver other mechanisms and the
// readiness UI may also call. Recorded wording is surfaced verbatim.
async function forFlow(flow, { session, now = new Date() } = {}) {
  if (!FLOWS.includes(String(flow))) return notRecorded(String(flow));
  const policy = await activeForFlow(String(flow), { session, now });
  if (!policy) return notRecorded(String(flow));
  return {
    flow: String(flow),
    state: "recorded",
    bearer: policy.bearer,
    policyId: String(policy._id),
    policyVersion: policy.version,
    decisionReference: policy.decisionReference ?? null,
    futureJournalTreatment: policy.futureJournalTreatment,
    historical:
      policy.historicalFeeRule === "none_recorded_stays_unknown"
        ? {
            rule: policy.historicalFeeRule,
            state: "stays_unknown",
            reason: STAYS_UNKNOWN,
            figures: FIGURES,
          }
        : {
            rule: policy.historicalFeeRule,
            state: "requires_measurement_mechanism",
            reason: MEASUREMENT,
            figures: FIGURES,
          },
    reason:
      "Recorded fee-treatment policy governs this flow as data; nothing is measured or executed by this projection.",
  };
}

// Operator view: every flow with an explicit state, honest accounting reality
// and zero fee figures. Pure read; no session held across flows.
async function projectView({ now = new Date() } = {}) {
  const flows = [];
  for (const flow of FLOWS) flows.push(await forFlow(flow, { now }));
  return {
    projectionVersion,
    readOnly: true,
    note: NOTE,
    statementFeed: {
      importPoint:
        "server/services/merchantFulfillment/feeTreatment/policy.js activeForFlow(flow) — read-only import for the other refund mechanisms (kora bearer fields, payout gating) and readiness UI",
    },
    accounting: ACCOUNTING,
    flows,
  };
}

// Statement-sibling surfacing: what a statement consumer may compose
// additively (see statementFeeView.js). Documented additive shape only.
module.exports = { forFlow, projectView, notRecorded, projectionVersion, FIGURES };
