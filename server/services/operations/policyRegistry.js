"use strict";
// Policy-registry projection (v1). Read-only, super-admin-only operator view
// of every reviewed mechanism's POLICY RECORDING state: per mechanism — the
// default-off flag state, the recorded immutable version list (whitelisted:
// version/state/decisionReference/effective window only — never the recorded
// contract content, hashes or account material), the active version resolved
// through each authority's documented read-only resolution functions, and the
// explicit "no recorded policy; all surfaces fail-closed" states in each
// mechanism's OWN verbatim wording. The registry read mirrors the
// authorities' own access level: every documented list() read path asserts
// super_admin, so a plain admin is refused here with a registry-worded 403
// while the queue/readiness surfaces stay super_admin/admin. Readiness
// evidence is not activation permission; nothing here enables, flips or
// executes anything.
const { ForbiddenError } = require("../../utils/errors");
const RegistryVersion = 1;
const GATE =
  "Platform operations policy registry requires a platform super admin.";
// Registry-display-only recorded-state text (introduced by the operations
// lead — not a recorded runtime reason string). Every none_recorded state
// below reuses the mechanism's own fail-closed wording verbatim instead.
const RECORDED_NOTE =
  "Recorded policy versions exist; this read-only registry projects them as data and never executes anything.";
// Kora/payout = the instances' own transport-seal refusals, quoted verbatim
// with provenance (they are runtime refusal outputs when flag AND recorded
// policy are both present but the transport is deliberately sealed).
const KORA_SEAL =
  "Kora refund transport is not installed; the recorded protocol contract requires external certification before a real transport is wired.";
// provenance: koraRefund/adapter.js sealedTransport() refusal (exact).
const PAYOUT_SEAL =
  "Payout transfer transport is sealed; no reviewed provider money-rails contract exists for this payout policy (recorded external evidence gate).";
// provenance: payout/transport.js submit() seal refusal (exact).
// display-only flag notes (provenance: the mechanisms' own policy headers).
const FEE_FLAG_NOTE =
  "No execution flag exists; the fee-treatment authority is a pure record authority by documented mechanism choice (feeTreatment/policy.js header).";
const SERVICE_LEVEL_NOTE =
  "No execution flag exists; the command has no HTTP surface (service-level by documented mechanism choice).";
const PAYOUT_POSTURE = require("../merchantFulfillment/payout/support").PAYOUT_REASON;
const feeProjection = require("../merchantFulfillment/feeTreatment/projection");
// Per-tenant display note (not a recorded runtime string): the zero-only and
// return-disposition executors resolve policy per tenant through their own
// activePolicy() authorities, so a global active version is not projected.
const PER_TENANT_NOTE =
  "Recorded versions are listed per tenant; active resolution is the executor's own per-tenant activePolicy authority.";

function assertSuperAdmin(actor) {
  if (actor?.role !== "super_admin") throw new ForbiddenError(GATE);
}
const flagState = (name) => ({ name, enabled: name ? process.env[name] === "true" : false });

// Whitelisted recorded-version projection: never the recorded contract
// content, never hashes, never ids beyond the version identity itself.
function whitelistedVersion(row) {
  return {
    version: row.version,
    state: row.state !== undefined ? row.state : (row.status ?? null),
    decisionReference: row.decisionReference ?? null,
    effectiveFrom: row.effectiveFrom ?? null,
    effectiveUntil: row.effectiveUntil ?? null,
  };
}

function entry(mechanism, flagName, rows, activeVersion, reason, extras = {}) {
  return {
    mechanism,
    readOnly: true,
    flag: flagState(flagName),
    policy: {
      state: rows.length ? "recorded" : "none_recorded",
      recordedVersions: rows.length,
      versions: rows.map(whitelistedVersion),
      activeVersion: activeVersion ?? null,
    },
    reason,
    failureState: rows.length ? null : "none_recorded_all_surfaces_fail_closed",
    ...extras,
  };
}

async function registrations(actor) {
  const kora = require("../merchantFulfillment/koraRefund/policy");
  const payout = require("../merchantFulfillment/payout/policy");
  const disposition = require("../delivery/returnDisposition/policy");
  const shipping = require("../merchantFulfillment/shippingRefund/policy");
  const component = require("../merchantFulfillment/componentRefund/policy");
  const zero = require("../merchantFulfillment/quantity/zeroOnlyRelease/policy");
  const storedValue = require("../merchantFulfillment/refundSources/policyAuthority");
  const feePolicy = require("../merchantFulfillment/feeTreatment/policy");
  const [koraRows, payoutRows, feeRows, dispositionRows, shippingRows, componentRows, zeroRows, storedValueRows] =
    await Promise.all([
      kora.list(actor),
      payout.list(actor),
      feePolicy.list(actor),
      disposition.listPolicies(actor),
      shipping.list(actor),
      component.list(actor),
      zero.listPolicies(actor),
      storedValue.list(actor),
    ]);
  const [
    koraActive,
    payoutActive,
    feeProjectionState,
    shippingActive,
    componentTaxActive,
    componentDiscountActive,
    walletActive,
    giftActive,
  ] = await Promise.all([
    kora.active(),
    payout.active(),
    feeProjection.projectView(),
    shipping.active(),
    component.active("tax"),
    component.active("discount"),
    storedValue.active("wallet"),
    storedValue.active("gift_card"),
  ]);
  const readiness = require("./readiness");
  const TENDER = readiness.TENDER_REVIEW_REASON;
  const RETURN_EFFECTS =
    require("./exceptionsQueue").RETURN_EFFECTS_UNSUPPORTED;
  const fee = feeProjectionState;
  return [
    entry(
      "kora_refund",
      "MERCHANT_KORA_REFUNDS_ENABLED",
      koraRows,
      koraActive?.version,
      koraActive
        ? process.env.MERCHANT_KORA_REFUNDS_ENABLED === "true"
          ? KORA_SEAL
          : TENDER
        : TENDER
    ),
    entry(
      "payout_transfer",
      "MERCHANT_PAYOUT_TRANSFERS_ENABLED",
      payoutRows,
      payoutActive?.version,
      payoutActive
        ? process.env.MERCHANT_PAYOUT_TRANSFERS_ENABLED === "true"
          ? PAYOUT_SEAL
          : PAYOUT_POSTURE
        : PAYOUT_POSTURE
    ),
    {
      mechanism: "fee_treatment",
      readOnly: true,
      flag: flagState(null),
      flagNote: FEE_FLAG_NOTE,
      policy: {
        state: fee.flows.some((flow) => flow.state === "recorded")
          ? "recorded"
          : "none_recorded",
        recordedVersions: feeRows.length,
        versions: feeRows.map(whitelistedVersion),
        activeVersion: null,
      },
      feeFlows: fee.flows.map((flow) => ({
        flow: flow.flow,
        state: flow.state,
        bearer: flow.bearer,
        policyVersion: flow.policyVersion,
        reason: flow.reason,
      })),
      reason: fee.note,
      failureState: feeRows.length ? null : "none_recorded_all_surfaces_fail_closed",
    },
    entry(
      "return_disposition",
      "MERCHANT_RETURN_EFFECTS_ENABLED",
      dispositionRows,
      null,
      dispositionRows.length ? RECORDED_NOTE : RETURN_EFFECTS,
      { resolutionNote: PER_TENANT_NOTE }
    ),
    entry(
      "shipping_refund_allocation",
      "MERCHANT_SHIPPING_REFUND_ALLOCATIONS_ENABLED",
      shippingRows,
      shippingActive?.version,
      shippingRows.length ? RECORDED_NOTE : readiness.SHIPPING_REASON
    ),
    entry(
      "tax_component_refund",
      null,
      componentRows.filter((row) => row.kind === "tax"),
      componentTaxActive?.version,
      componentTaxActive ? RECORDED_NOTE : readiness.TAX_REASON,
      { flagNote: SERVICE_LEVEL_NOTE }
    ),
    entry(
      "discount_component_refund",
      null,
      componentRows.filter((row) => row.kind === "discount"),
      componentDiscountActive?.version,
      componentDiscountActive ? RECORDED_NOTE : TENDER,
      { flagNote: SERVICE_LEVEL_NOTE }
    ),
    entry(
      "zero_only_release",
      "MERCHANT_ZERO_ONLY_RELEASE_ENABLED",
      zeroRows,
      null,
      zeroRows.length ? RECORDED_NOTE : readiness.ZERO_VALUE_REASON,
      { resolutionNote: PER_TENANT_NOTE }
    ),
    entry(
      "stored_value_wallet_refund",
      "MERCHANT_STORED_VALUE_REFUNDS_ENABLED",
      storedValueRows.filter((row) => row.kind === "wallet"),
      walletActive?.version,
      walletActive ? RECORDED_NOTE : TENDER
    ),
    entry(
      "stored_value_gift_card_refund",
      "MERCHANT_STORED_VALUE_REFUNDS_ENABLED",
      storedValueRows.filter((row) => row.kind === "gift_card"),
      giftActive?.version,
      giftActive ? RECORDED_NOTE : TENDER
    ),
  ];
}

async function snapshot(actor) {
  assertSuperAdmin(actor);
  return {
    registryVersion: RegistryVersion,
    notice: require("./readiness").NOTICE,
    readOnly: true,
    mechanisms: await registrations(actor),
  };
}

module.exports = { snapshot, RegistryVersion, GATE };
