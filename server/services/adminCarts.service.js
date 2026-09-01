// server/services/adminCarts.service.js
//
// Admin-facing read model for marketplace carts — the pre-order pipeline shown
// on the admin Orders page's "Live Carts" tab.
//
// Isolation rule, identical to salesOrder.service.getCustomerCartForQuote: a
// tenant admin sees only the cart lines whose SubProduct belongs to their
// tenant. Other tenants' lines are counted into `skippedCount` and NEVER named
// — a tenant must not learn what a competitor sold the same shopper. Platform
// admins (admin / super_admin) see every line.
//
// Prices here are the shopper's `priceAtAddition` marketplace snapshot. They
// are a *forecast*, not a quotable price: the tenant's own pricelist engine
// re-prices everything the moment these lines become a quotation. The UI must
// label them as such.
'use strict';

/** Age buckets, measured from the cart's last update. */
const BUCKETS = {
  active: { label: 'Active', maxHours: 24 },
  at_risk: { label: 'At risk', maxHours: 24 * 7 },
  abandoned: { label: 'Abandoned', maxHours: Infinity },
};

const BUCKET_IDS = ['active', 'at_risk', 'abandoned'];

/**
 * Which age bucket a cart falls in. Exported for the unit tests — the boundary
 * is inclusive at the bottom (exactly 24h old is already 'at_risk').
 */
function bucketFor(updatedAt, now) {
  const ms = now.getTime() - new Date(updatedAt).getTime();
  const hours = ms / 3_600_000;
  if (hours < BUCKETS.active.maxHours) return 'active';
  if (hours < BUCKETS.at_risk.maxHours) return 'at_risk';
  return 'abandoned';
}

/**
 * Shape one cart document into an admin row, keeping only the lines this
 * caller may see. Pure — no DB access — so the isolation rule is unit-testable
 * without a live Mongo.
 *
 * @param cart          lean Cart doc ({ _id, user, items, updatedAt, createdAt })
 * @param subById       Map<subProductId, { _id, tenant, sku, product }>
 * @param sizeNameById  Map<sizeId, sizeLabel>
 * @param userById      Map<userId, lean User>
 * @param tenantId      caller's tenant, or null for a platform admin
 * @param isPlatformAdmin  true → no tenant filtering at all
 * @param now           clock injection; every caller passes an explicit Date
 */
function buildCartRow({
  cart,
  subById,
  sizeNameById,
  userById,
  tenantId,
  isPlatformAdmin,
  now,
}) {
  const rawItems = Array.isArray(cart.items) ? cart.items : [];
  const items = [];
  let skippedCount = 0;

  for (const it of rawItems) {
    const sp = it.subproduct ? subById.get(String(it.subproduct)) : null;
    // A line whose subproduct no longer resolves is not attributable to any
    // tenant, so it can never be shown to one — but a platform admin still
    // sees it (that deletion is exactly the kind of thing they investigate).
    const visible = isPlatformAdmin
      ? true
      : !!sp && String(sp.tenant) === String(tenantId);
    if (!visible) {
      skippedCount++;
      continue;
    }
    const quantity = Number(it.quantity) || 0;
    const unitPrice = Number(it.priceAtAddition) || 0;
    items.push({
      productId: sp && sp.product && sp.product._id ? sp.product._id : it.product,
      subProductId: it.subproduct,
      sizeId: it.size || undefined,
      name: (sp && sp.product && sp.product.name) || 'Unknown product',
      sku: (sp && sp.sku) || '',
      sizeName: it.size ? sizeNameById.get(String(it.size)) || '' : '',
      quantity,
      unitPrice,
      lineTotal: unitPrice * quantity,
      addedAt: it.addedAt,
      // Only meaningful to a platform admin — a tenant admin never sees a line
      // that isn't theirs, so this is always their own id for them.
      tenantId: sp ? sp.tenant : it.tenant,
    });
  }

  const user = cart.user ? userById.get(String(cart.user)) : null;
  const updatedAt = cart.updatedAt || cart.createdAt || now;

  return {
    kind: 'cart',
    _id: cart._id,
    user: user
      ? {
          _id: user._id,
          name:
            `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
            user.email ||
            'Unknown shopper',
          email: user.email || '',
          phone: user.phone || '',
        }
      : // A cart whose owner was deleted still matters — it is stock held
        // hostage by a row nobody can act on. Show it rather than drop it.
        { _id: cart.user || null, name: 'Deleted account', email: '', phone: '' },
    items,
    itemCount: items.length,
    totalQuantity: items.reduce((s, i) => s + i.quantity, 0),
    // Value of the lines this caller can see — NOT the cart's full value.
    value: items.reduce((s, i) => s + i.lineTotal, 0),
    skippedCount,
    createdAt: cart.createdAt,
    updatedAt,
    ageHours: Math.max(
      0,
      Math.round((now.getTime() - new Date(updatedAt).getTime()) / 3_600_000)
    ),
    bucket: bucketFor(updatedAt, now),
  };
}

/**
 * Roll shaped rows into the header stat cards. Kept separate from the query so
 * the numbers are always derived from exactly the rows that were returned —
 * a second count query would drift from the list under concurrent writes.
 */
function summarize(rows) {
  const counts = { all: rows.length, active: 0, at_risk: 0, abandoned: 0 };
  let value = 0;
  let units = 0;
  for (const r of rows) {
    counts[r.bucket] = (counts[r.bucket] || 0) + 1;
    value += r.value;
    units += r.totalQuantity;
  }
  return {
    counts,
    totalValue: value,
    totalUnits: units,
    averageValue: rows.length ? Math.round(value / rows.length) : 0,
  };
}

/**
 * Inclusive lower bound of the registration window.
 * '30'/'90' are days back from `now`; 'month' is the start of the current UTC
 * month; 'all' has no lower bound (returns null).
 */
function registrationWindowSince(registeredWithin, now) {
  if (registeredWithin === 'all') return null;
  if (registeredWithin === 'month') {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }
  const days = Number(registeredWithin); // '30' | '90'
  return new Date(now.getTime() - days * 24 * 3_600_000);
}

/**
 * A new customer who has no non-empty cart anywhere. Never names another
 * tenant: a shopper whose only cart is full of other tenants' lines is a cart
 * row with skippedCount, NOT a signup — the caller decides that; this function
 * just shapes the row.
 */
function buildSignupRow(user, now, registeredWithin) {
  return {
    kind: 'signup',
    _id: user._id,
    user: {
      _id: user._id,
      name:
        `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
        user.email ||
        'Unknown shopper',
      email: user.email || '',
      phone: user.phone || '',
    },
    joinedAt: user.createdAt || now,
    registrationWindow: registeredWithin,
  };
}

/**
 * Conversion-mode summary, derived from exactly the rows returned (same
 * page-local honesty rule as `summarize`).
 */
function summarizeNewCustomers(rows) {
  let withCart = 0;
  let noCart = 0;
  let totalValue = 0;
  for (const r of rows) {
    if (r.kind === 'cart') {
      withCart += 1;
      totalValue += r.value || 0;
    } else {
      noCart += 1;
    }
  }
  return { shoppers: rows.length, withCart, noCart, totalValue };
}

module.exports = {
  BUCKETS,
  BUCKET_IDS,
  bucketFor,
  buildCartRow,
  buildSignupRow,
  registrationWindowSince,
  summarize,
  summarizeNewCustomers,
};
