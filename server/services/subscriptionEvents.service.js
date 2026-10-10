// services/subscriptionEvents.service.js
'use strict';
const SubscriptionEvent = require('../models/SubscriptionEvent');
const { PLAN_ORDER } = require('../config/erm-plans');

/**
 * The subscription change ledger behind the retention report.
 *
 * `Tenant.plan` is a single current value, so "how many tenants expanded or
 * churned last month" has no answer without a record of the transitions. This
 * writes one row per *effective* change and reads them back for the report.
 *
 * Two properties matter more than the reporting itself:
 *   - Idempotent. Providers redeliver webhooks, so a repeated cancellation must
 *     not inflate churn. `dedupeKey` carries a unique index.
 *   - Never fabricated. If there is no ledger row, the report says so rather than
 *     deriving a history that never existed.
 */

/**
 * A move up or down the plan ladder.
 *
 * `custom` is deliberately in the Tenant.plan enum but absent from PLAN_ORDER,
 * so it has no rank. An unranked plan returns null rather than being treated as
 * the bottom rung, which would report every custom->pro move as an expansion.
 * Returns null when nothing changed or either side is unrankable.
 */
function classifyPlanChange(fromPlan, toPlan) {
  const from = PLAN_ORDER.indexOf(fromPlan);
  const to = PLAN_ORDER.indexOf(toPlan);
  if (from === -1 || to === -1 || from === to) return null;
  return to > from ? 'expansion' : 'contraction';
}

/**
 * Stable identity for a change.
 *
 * Prefers the provider subscription code or the transition operation id, since
 * those survive redelivery. Falls back to the effective instant when there is no
 * source id — coarser, but it still collapses a retry of the same change onto
 * one row instead of counting it twice.
 */
function dedupeKey({ tenant, kind, effectiveAt, source }) {
  const stamp = new Date(effectiveAt).toISOString();
  return source ? `${tenant}:${kind}:${source}` : `${tenant}:${kind}:${stamp}`;
}

/**
 * Record a change, ignoring a redelivery of one already stored.
 *
 * Never throws: a retention ledger is reporting infrastructure, and failing a
 * billing webhook because the audit row could not be written would be the wrong
 * trade. The caller proceeds either way.
 */
async function recordEvent({ tenant, kind, fromPlan = '', toPlan = '', addOn = '', quantity = null, effectiveAt, source = '' }) {
  const at = effectiveAt ? new Date(effectiveAt) : new Date();
  if (!tenant || !at.getTime()) return null;
  try {
    return await SubscriptionEvent.create({
      tenant,
      kind,
      fromPlan,
      toPlan,
      addOn,
      quantity,
      effectiveAt: at,
      dedupeKey: dedupeKey({ tenant: String(tenant), kind, effectiveAt: at, source }),
      source,
    });
  } catch (error) {
    // 11000 is the unique-index violation that means "already recorded".
    if (error?.code === 11000) return null;
    console.error('SubscriptionEvent write failed:', error.message);
    return null;
  }
}

/**
 * Record a plan change, choosing the kind from the ladder.
 * No-ops when the change is not a movement, so callers need no guard.
 */
async function recordPlanChange({ tenant, fromPlan, toPlan, effectiveAt, source = '' }) {
  const kind = classifyPlanChange(fromPlan, toPlan);
  if (!kind) return null;
  return recordEvent({ tenant, kind, fromPlan, toPlan, effectiveAt, source });
}

/** Events effective inside a window, oldest first. */
async function listEvents({ tenant, from, to }) {
  const query = { effectiveAt: { $gte: new Date(from), $lte: new Date(to) } };
  if (tenant) query.tenant = tenant;
  return SubscriptionEvent.find(query).sort({ effectiveAt: 1 }).lean();
}

module.exports = { classifyPlanChange, dedupeKey, recordEvent, recordPlanChange, listEvents };
