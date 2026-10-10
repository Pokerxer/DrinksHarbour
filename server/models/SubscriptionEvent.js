// models/SubscriptionEvent.js
'use strict';
const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * An append-only record of subscription state changes.
 *
 * Why this exists: `Tenant.plan` only ever holds the tenant's *current* plan, so
 * an upgrade history cannot be reconstructed from it — there is no record that a
 * tenant was ever on `starter` before moving to `pro`. Retention reporting
 * ("how many tenants expanded or churned this month?") therefore has no source
 * at all without a ledger like this one.
 *
 * Events are written by the billing webhook and the plan-change scheduler as
 * they take effect, so the ledger reflects *effective* state rather than intent.
 * `dedupeKey` makes redelivery safe: providers retry webhooks, and a retried
 * `subscription.disable` must not be counted as a second cancellation.
 */
const SubscriptionEventSchema = new Schema(
  {
    tenant: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },

    kind: {
      type: String,
      enum: ['activation', 'expansion', 'contraction', 'cancellation', 'reactivation', 'payment_failure'],
      required: true,
      index: true,
    },

    fromPlan: { type: String, default: '' },
    toPlan: { type: String, default: '' },

    /** Set when the change was an add-on rather than a plan change. */
    addOn: { type: String, default: '' },
    /** Add-ons: the resulting total quantity, so quantity is reconstructable. */
    quantity: { type: Number, default: null },

    /** When the change actually takes effect, not when the event arrived. */
    effectiveAt: { type: Date, required: true },

    /**
     * Stable identity of the change, so a redelivered provider event or a
     * retried scheduler pass is a no-op. See dedupeKey() in the service.
     */
    dedupeKey: { type: String, required: true },

    /** Where the record came from, for debugging: provider event or operation id. */
    source: { type: String, default: '' },
  },
  { timestamps: true }
);

SubscriptionEventSchema.index({ dedupeKey: 1 }, { unique: true });
SubscriptionEventSchema.index({ createdAt: 1 });
SubscriptionEventSchema.index({ tenant: 1, effectiveAt: 1 });
SubscriptionEventSchema.index({ kind: 1, effectiveAt: 1 });

module.exports = mongoose.models.SubscriptionEvent
  || mongoose.model('SubscriptionEvent', SubscriptionEventSchema);
