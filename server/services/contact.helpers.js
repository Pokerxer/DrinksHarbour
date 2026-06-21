// server/services/contact.helpers.js
//
// Pure, side-effect-free helpers for the tenant Contacts directory — a unified
// view over BOTH in-store (POSCustomer) and ecommerce (User role:'customer')
// customers. Kept DB-less so the normalisation / dedupe / merge / validation
// rules can be unit-tested without Mongo or Express — mirrors the pattern used
// by employee.helpers.js.
//
// The two stores are NEVER merged at the persistence layer; they are unified
// only here at the read/API layer via a `source` discriminator:
//   'instore'   — exists only as a POSCustomer
//   'ecommerce' — exists only as a User(role:'customer')
//   'both'      — the same person in both stores (matched by email / phone)

// Sources a contact can come from / be addressed by.
const CONTACT_SOURCES = ['instore', 'ecommerce', 'both'];

// User.status values an admin may set on an ecommerce contact here. 'deleted' is
// reserved for soft-deletes and is never settable directly nor ever exposed.
const SETTABLE_STATUSES = ['active', 'inactive', 'suspended'];

/** Basic email shape check (server-side guard, not RFC-complete). */
function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/** True for a 24-char hex string (Mongo ObjectId shape). DB-less guard. */
function isObjectIdLike(value) {
  return typeof value === 'string' && /^[a-fA-F0-9]{24}$/.test(value.trim());
}

/** Lower-cased, trimmed email used as a dedupe key. '' when absent. */
function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

/**
 * Strip formatting from a phone number so "+234 801-234" and "(234)801234"
 * compare equal. Keeps the digits (and a leading +) only. '' when absent.
 */
function normalizePhone(phone) {
  if (phone === undefined || phone === null) return '';
  const cleaned = String(phone).replace(/[\s\-().]/g, '').replace(/^\+/, '');
  return cleaned;
}

/** Escape regex metacharacters so a search like "a.b" is treated literally. */
function escapeRegex(term) {
  return term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Normalise an avatar payload into the `{ url, publicId }` shape stored on the
 * POSCustomer model. Accepts a plain URL string or an object from the upload
 * service. Returns null when there's nothing usable (so callers can "clear").
 */
function sanitizeAvatar(input) {
  if (!input) return null;
  if (typeof input === 'string') {
    const url = input.trim();
    return url ? { url } : null;
  }
  if (typeof input === 'object') {
    const url = typeof input.url === 'string' ? input.url.trim() : '';
    if (!url) return null;
    const out = { url };
    const publicId =
      typeof input.publicId === 'string' ? input.publicId.trim() : '';
    if (publicId) out.publicId = publicId;
    return out;
  }
  return null;
}

// ── Normalisers ────────────────────────────────────────────────────────────────
//
// Map a raw store document into the single canonical Contact shape:
//   { _id, source, ids, firstName, lastName, email, phone, avatar, status,
//     loyaltyPoints, totalSpent, totalOrders, notes, createdAt }
// In-store rows have no status/avatar; ecommerce rows have no loyalty/totals —
// the gaps are filled with sensible defaults so the UI never special-cases.

/** Normalise a POSCustomer document. */
function normalizePosCustomer(doc = {}) {
  return {
    _id: String(doc._id),
    source: 'instore',
    ids: { instore: String(doc._id) },
    firstName: doc.firstName || '',
    lastName: doc.lastName || '',
    email: doc.email || '',
    phone: doc.phone || '',
    avatar: doc.avatar?.url || '',
    status: 'active',
    loyaltyPoints: doc.loyaltyPoints || 0,
    walletBalance: doc.walletBalance || 0,
    totalSpent: doc.totalSpent || 0,
    totalOrders: doc.totalOrders || 0,
    // Customer-assigned pricelist id (or null) — drives the POS sell-page
    // auto-pick. In-store only; ecommerce contacts never carry one.
    pricelist: doc.pricelist ? String(doc.pricelist) : null,
    notes: doc.notes || '',
    createdAt: doc.createdAt,
  };
}

/** Normalise a User(role:'customer') document. */
function normalizeEcommerceUser(doc = {}) {
  return {
    _id: String(doc._id),
    source: 'ecommerce',
    ids: { ecommerce: String(doc._id) },
    firstName: doc.firstName || '',
    lastName: doc.lastName || '',
    email: doc.email || '',
    phone: doc.phone || '',
    avatar: doc.avatar?.url || '',
    status: doc.status || 'active',
    loyaltyPoints: 0,
    walletBalance: doc.walletBalance || 0,
    totalSpent: 0,
    totalOrders: 0,
    // Pricelists are an in-store concept; ecommerce contacts never carry one.
    pricelist: null,
    notes: '',
    createdAt: doc.createdAt,
  };
}

/**
 * The routing key the client uses for the detail page (`source:id`). A 'both'
 * contact is edited through its in-store record (the fully-editable one), so it
 * routes to the in-store id.
 */
function contactKey(c) {
  if (c.source === 'ecommerce') return `ecommerce:${c.ids.ecommerce}`;
  // instore + both both address the POSCustomer record.
  return `instore:${c.ids.instore}`;
}

/** Earlier of two dates (a customer's "first seen"); tolerant of missing values. */
function earliest(a, b) {
  if (!a) return b;
  if (!b) return a;
  return new Date(a) <= new Date(b) ? a : b;
}

/**
 * Merge a single in-store + ecommerce pair into one 'both' contact. Ecommerce
 * identity wins (name / email / status / avatar); in-store wins for the POS
 * loyalty/spend/notes it alone tracks. Loyalty + totals are summed so a person
 * who somehow accrued value on both sides keeps all of it. Pure: inputs are not
 * mutated.
 */
function mergePair(ins, eco) {
  return {
    _id: ins._id,
    source: 'both',
    ids: { instore: ins.ids.instore, ecommerce: eco.ids.ecommerce },
    firstName: eco.firstName || ins.firstName,
    lastName: eco.lastName || ins.lastName,
    email: eco.email || ins.email,
    phone: eco.phone || ins.phone,
    avatar: eco.avatar || '',
    status: eco.status || 'active',
    loyaltyPoints: (ins.loyaltyPoints || 0) + (eco.loyaltyPoints || 0),
    // The wallet is single-sided: it lives on the in-store record a 'both'
    // contact routes to (see contactKey), so its balance is the POSCustomer's.
    walletBalance: ins.walletBalance || 0,
    totalSpent: (ins.totalSpent || 0) + (eco.totalSpent || 0),
    totalOrders: (ins.totalOrders || 0) + (eco.totalOrders || 0),
    // The pricelist binding is single-sided: it lives on the in-store record a
    // 'both' contact routes to (see contactKey).
    pricelist: ins.pricelist || null,
    notes: ins.notes || '',
    createdAt: earliest(ins.createdAt, eco.createdAt),
  };
}

/**
 * De-dupe two already-normalised lists across sources. A person is "the same"
 * when their normalised email matches, else their normalised phone. Matched
 * pairs collapse into a single source:'both' contact; the rest pass through as
 * instore-only / ecommerce-only. Each ecommerce record is consumed at most once
 * (a second in-store row matching the same person stays instore-only rather than
 * duplicating it). Pure + cycle-free.
 */
function mergeContacts(instore = [], ecommerce = []) {
  const ecoByEmail = new Map();
  const ecoByPhone = new Map();
  for (const c of ecommerce) {
    const em = normalizeEmail(c.email);
    const ph = normalizePhone(c.phone);
    if (em && !ecoByEmail.has(em)) ecoByEmail.set(em, c);
    if (ph && !ecoByPhone.has(ph)) ecoByPhone.set(ph, c);
  }

  const consumed = new Set();
  const result = [];

  for (const ins of instore) {
    const em = normalizeEmail(ins.email);
    const ph = normalizePhone(ins.phone);
    let match = (em && ecoByEmail.get(em)) || (ph && ecoByPhone.get(ph)) || null;
    if (match && consumed.has(match._id)) match = null;
    if (match) {
      consumed.add(match._id);
      result.push(mergePair(ins, match));
    } else {
      result.push(ins);
    }
  }

  for (const eco of ecommerce) {
    if (!consumed.has(eco._id)) result.push(eco);
  }

  return result;
}

// ── List filters ─────────────────────────────────────────────────────────────

/**
 * Mongo filter for listing a tenant's IN-STORE (POSCustomer) contacts, or null
 * when the requested source/status excludes this store entirely (POSCustomers
 * carry no status, so they only satisfy an 'active' status filter).
 */
function buildInstoreFilter(tenantId, opts = {}) {
  const { source, status, search } = opts;
  if (source && source !== 'instore' && source !== 'both') return null;
  if (status && status !== 'active') return null;

  const filter = { tenant: tenantId };
  const term = typeof search === 'string' ? search.trim() : '';
  if (term) {
    const rx = new RegExp(escapeRegex(term), 'i');
    filter.$or = [{ firstName: rx }, { lastName: rx }, { email: rx }, { phone: rx }];
  }
  return filter;
}

/**
 * Mongo filter for listing a tenant's ECOMMERCE (User role:'customer') contacts,
 * or null when the requested source excludes this store. Deleted customers are
 * never returned.
 */
function buildEcommerceFilter(tenantId, opts = {}) {
  const { source, status, search } = opts;
  if (source && source !== 'ecommerce' && source !== 'both') return null;

  const filter = { tenant: tenantId, role: 'customer', status: { $ne: 'deleted' } };
  if (status && SETTABLE_STATUSES.includes(status)) {
    filter.status = status;
  }
  const term = typeof search === 'string' ? search.trim() : '';
  if (term) {
    const rx = new RegExp(escapeRegex(term), 'i');
    filter.$or = [{ firstName: rx }, { lastName: rx }, { email: rx }, { phone: rx }];
  }
  return filter;
}

/**
 * Build the per-store Mongo filters for a Contacts listing. Either key may be
 * null, meaning "don't query that store at all".
 */
function buildContactFilter(tenantId, opts = {}) {
  return {
    instore: buildInstoreFilter(tenantId, opts),
    ecommerce: buildEcommerceFilter(tenantId, opts),
  };
}

// ── Orders for a contact ─────────────────────────────────────────────────────
//
// An order belongs to a contact when it was placed by their ecommerce account
// (`user`), tied to their POS customer record (`paymentDetails.customer.customerId`),
// or carries their email / phone snapshot. The two stores write different shapes:
//   • ecommerce checkout → `user` + `shippingAddress.{email,phone}`
//   • POS sale           → `paymentDetails.customer.{customerId,phone}` (NO email;
//                           walk-ins have no customerId and match by phone only)

// Order.status enum, mirrored here so the listing can validate a status filter.
const ORDER_STATUSES = [
  'pending', 'confirmed', 'hold', 'processing', 'partially_shipped',
  'shipped', 'delivered', 'cancelled', 'refunded',
];

/**
 * Build the Mongo `$or` clauses that match every order belonging to a contact,
 * across both stores. Returns [] when the contact carries no usable identity
 * (the caller should then return an empty result rather than query for `{}`).
 */
function buildContactOrderMatch(contact = {}) {
  const ids = contact.ids || {};
  const or = [];
  if (ids.ecommerce) or.push({ user: ids.ecommerce });
  if (ids.instore) or.push({ 'paymentDetails.customer.customerId': ids.instore });

  const email = normalizeEmail(contact.email);
  if (email) {
    // shippingAddress.email is stored as the shopper typed it, so match loosely.
    or.push({ 'shippingAddress.email': new RegExp(`^${escapeRegex(email)}$`, 'i') });
  }

  const phone = typeof contact.phone === 'string' ? contact.phone.trim() : '';
  if (phone) {
    or.push({ 'shippingAddress.phone': phone });
    or.push({ 'paymentDetails.customer.phone': phone });
  }
  return or;
}

/**
 * Parse + clamp the listing query (status / date range / pagination) for a
 * contact's orders. `match` holds the status/date clauses to AND with the
 * identity match; page/limit/skip drive pagination (limit 1–100, default 20).
 */
function parseOrderListQuery(query = {}) {
  const match = {};

  const status = typeof query.status === 'string' ? query.status.trim() : '';
  if (status && ORDER_STATUSES.includes(status)) match.status = status;

  const placedAt = {};
  const from = query.from ? new Date(query.from) : null;
  if (from && !Number.isNaN(from.getTime())) placedAt.$gte = from;
  const to = query.to ? new Date(query.to) : null;
  if (to && !Number.isNaN(to.getTime())) {
    to.setHours(23, 59, 59, 999); // inclusive of the whole "to" day
    placedAt.$lte = to;
  }
  if (Object.keys(placedAt).length) match.placedAt = placedAt;

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  return { match, page, limit, skip: (page - 1) * limit };
}

/**
 * Index a tenant's orders so each contact's lifetime totals can be computed in
 * one pass. Every order is bucketed under each identity key it carries, and its
 * amount recorded, so a contact can sum DISTINCT matching orders (a single order
 * matched by both `user` and email is never counted twice). DB-less + pure.
 */
function buildOrderIndex(orders = []) {
  const amount = new Map();       // orderId → totalAmount
  const byUser = new Map();       // userId → Set(orderId)
  const byCustomerId = new Map(); // POSCustomer id → Set(orderId)
  const byEmail = new Map();      // normalised email → Set(orderId)
  const byPhone = new Map();      // trimmed phone → Set(orderId)

  const add = (map, key, id) => {
    if (!key) return;
    let set = map.get(key);
    if (!set) { set = new Set(); map.set(key, set); }
    set.add(id);
  };

  for (const o of orders) {
    const id = String(o._id);
    amount.set(id, o.totalAmount || 0);
    if (o.user) add(byUser, String(o.user), id);
    const cust = (o.paymentDetails && o.paymentDetails.customer) || {};
    if (cust.customerId) add(byCustomerId, String(cust.customerId), id);
    if (cust.phone) add(byPhone, String(cust.phone).trim(), id);
    const ship = o.shippingAddress || {};
    if (ship.email) add(byEmail, normalizeEmail(ship.email), id);
    if (ship.phone) add(byPhone, String(ship.phone).trim(), id);
  }

  return { amount, byUser, byCustomerId, byEmail, byPhone };
}

/**
 * Lifetime { totalOrders, totalSpent } for a contact from a buildOrderIndex
 * result, counting each matching order once across all of the contact's keys.
 */
function contactOrderTotals(contact = {}, index) {
  if (!index) return { totalOrders: 0, totalSpent: 0 };
  const ids = contact.ids || {};
  const matched = new Set();
  const pull = (set) => { if (set) for (const id of set) matched.add(id); };

  if (ids.ecommerce) pull(index.byUser.get(String(ids.ecommerce)));
  if (ids.instore) pull(index.byCustomerId.get(String(ids.instore)));
  const email = normalizeEmail(contact.email);
  if (email) pull(index.byEmail.get(email));
  const phone = typeof contact.phone === 'string' ? contact.phone.trim() : '';
  if (phone) pull(index.byPhone.get(phone));

  let totalSpent = 0;
  for (const id of matched) totalSpent += index.amount.get(id) || 0;
  return { totalOrders: matched.size, totalSpent };
}

// ── Spending summary ─────────────────────────────────────────────────────────
//
// Roll a contact's orders up into the analytics the /spent page renders: lifetime
// totals + breakdowns by month, payment method, status and top products. Kept
// pure (no DB / no Date.now) so the grouping is unit-testable. Amounts mirror the
// orders page — every matched order's totalAmount counts, so the headline "Total
// Spent" is identical across both pages.

/** 'YYYY-MM' bucket for a date, or null when unparseable. */
function monthKey(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * @param {Array} orders lean orders with { totalAmount, status, paymentMethod,
 *   placedAt|createdAt, items:[{ product:{name}, subproduct:{name}, quantity,
 *   itemSubtotal }] }.
 * @returns spending analytics for one contact.
 */
function summarizeSpending(orders = []) {
  let totalSpent = 0;
  let firstOrderAt = null;
  let lastOrderAt = null;
  const months = new Map();   // 'YYYY-MM'  → { total, count }
  const methods = new Map();  // method     → { total, count }
  const statuses = new Map(); // status     → { total, count }
  const products = new Map(); // name       → { quantity, total }

  const bump = (map, key, total, qty) => {
    const cur = map.get(key) || { total: 0, count: 0, quantity: 0 };
    cur.total += total;
    if (qty === undefined) cur.count += 1;
    else cur.quantity += qty;
    map.set(key, cur);
  };

  for (const o of orders) {
    const amt = o.totalAmount || 0;
    totalSpent += amt;

    const when = o.placedAt || o.createdAt;
    const t = when ? new Date(when).getTime() : NaN;
    if (!Number.isNaN(t)) {
      if (firstOrderAt === null || t < firstOrderAt) firstOrderAt = t;
      if (lastOrderAt === null || t > lastOrderAt) lastOrderAt = t;
      const mk = monthKey(when);
      if (mk) bump(months, mk, amt);
    }

    bump(methods, o.paymentMethod || 'unknown', amt);
    bump(statuses, o.status || 'unknown', amt);

    for (const it of o.items || []) {
      const name =
        (it.product && it.product.name) ||
        (it.subproduct && it.subproduct.name) ||
        'Unknown item';
      bump(products, name, it.itemSubtotal || 0, it.quantity || 0);
    }
  }

  const orderCount = orders.length;
  return {
    totalSpent,
    orderCount,
    avgOrderValue: orderCount ? totalSpent / orderCount : 0,
    firstOrderAt: firstOrderAt === null ? null : new Date(firstOrderAt).toISOString(),
    lastOrderAt: lastOrderAt === null ? null : new Date(lastOrderAt).toISOString(),
    byMonth: [...months.entries()]
      .map(([month, v]) => ({ month, total: v.total, count: v.count }))
      .sort((a, b) => (a.month < b.month ? -1 : 1))
      .slice(-12),
    byPaymentMethod: [...methods.entries()]
      .map(([method, v]) => ({ method, total: v.total, count: v.count }))
      .sort((a, b) => b.total - a.total),
    byStatus: [...statuses.entries()]
      .map(([status, v]) => ({ status, total: v.total, count: v.count }))
      .sort((a, b) => b.count - a.count),
    topProducts: [...products.entries()]
      .map(([name, v]) => ({ name, quantity: v.quantity, total: v.total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5),
  };
}

// ── Create / update validation ─────────────────────────────────────────────────

const num = (v) => {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

/**
 * Validate + normalise the payload for creating an IN-STORE contact (POSCustomer).
 * firstName is required; email (optional) must look valid; phone is trimmed.
 * @returns {{ ok: true, value: object } | { ok: false, message: string }}
 */
function validateContactCreate(body = {}, tenantId) {
  const { firstName, lastName, email, phone, notes, loyaltyPoints, totalSpent, totalOrders } = body;

  if (!firstName || !String(firstName).trim()) {
    return { ok: false, message: 'First name is required' };
  }
  if (email !== undefined && email !== null && String(email).trim() !== '' && !isValidEmail(email)) {
    return { ok: false, message: 'Email is not valid' };
  }

  const value = {
    tenant: tenantId,
    firstName: String(firstName).trim(),
    lastName: lastName ? String(lastName).trim() : '',
    email: email ? String(email).toLowerCase().trim() : '',
    phone: phone ? String(phone).trim() : '',
    notes: notes ? String(notes).trim() : '',
  };
  if ('avatar' in body) {
    const avatar = sanitizeAvatar(body.avatar);
    if (avatar) value.avatar = avatar;
  }
  const lp = num(loyaltyPoints);
  if (lp !== undefined) value.loyaltyPoints = Math.max(0, lp);
  const ts = num(totalSpent);
  if (ts !== undefined) value.totalSpent = ts;
  const to = num(totalOrders);
  if (to !== undefined) value.totalOrders = to;

  return { ok: true, value };
}

/**
 * Compute the field changes for updating an existing contact.
 *  - in-store: every editable field (identity, contact, loyalty/spend, notes);
 *  - ecommerce: status ONLY (storefront owns the rest), never to 'deleted'.
 * @returns {{ ok: true, changes: object } | { ok: false, message: string }}
 */
function validateContactUpdate(source, body = {}) {
  if (source === 'ecommerce') {
    const { status } = body;
    if (status === undefined) return { ok: true, changes: {} };
    if (!SETTABLE_STATUSES.includes(status)) {
      return { ok: false, message: `Status must be one of: ${SETTABLE_STATUSES.join(', ')}` };
    }
    return { ok: true, changes: { status } };
  }

  // in-store (POSCustomer) — full edit.
  const { firstName, lastName, email, phone, notes, loyaltyPoints, totalSpent, totalOrders } = body;
  const changes = {};

  if (firstName !== undefined) {
    if (!String(firstName).trim()) return { ok: false, message: 'First name cannot be empty' };
    changes.firstName = String(firstName).trim();
  }
  if (lastName !== undefined) changes.lastName = String(lastName).trim();
  if (email !== undefined) {
    const e = String(email).trim();
    if (e !== '' && !isValidEmail(e)) return { ok: false, message: 'Email is not valid' };
    changes.email = e.toLowerCase();
  }
  if (phone !== undefined) changes.phone = phone ? String(phone).trim() : '';
  if (notes !== undefined) changes.notes = notes ? String(notes).trim() : '';
  if ('avatar' in body) changes.avatar = sanitizeAvatar(body.avatar) || undefined;

  // Customer-assigned pricelist: an ObjectId string sets the binding, null/''
  // clears it; anything else is rejected. The id's tenant-membership is enforced
  // downstream at pricing time (pricelist.service), so a stale id never charges
  // an off-tenant price.
  if ('pricelist' in body) {
    const { pricelist } = body;
    if (pricelist === null || pricelist === '') {
      changes.pricelist = null;
    } else if (isObjectIdLike(pricelist)) {
      changes.pricelist = String(pricelist).trim();
    } else {
      return { ok: false, message: 'Pricelist is not a valid id' };
    }
  }

  if (loyaltyPoints !== undefined) {
    const lp = num(loyaltyPoints);
    if (lp === undefined) return { ok: false, message: 'Loyalty points must be a number' };
    changes.loyaltyPoints = Math.max(0, lp);
  }
  if (totalSpent !== undefined) {
    const ts = num(totalSpent);
    if (ts === undefined) return { ok: false, message: 'Total spent must be a number' };
    changes.totalSpent = ts;
  }
  if (totalOrders !== undefined) {
    const to = num(totalOrders);
    if (to === undefined) return { ok: false, message: 'Total orders must be a number' };
    changes.totalOrders = to;
  }

  return { ok: true, changes };
}

// ── Wallet (stored value / store credit) ────────────────────────────────────────
//
// A per-contact wallet: a running balance held on the owner record (POSCustomer
// or User) plus an append-only ledger of WalletTransactions. These helpers are
// pure so the money rules (positive-integer NGN amounts, overdraw guard, ledger
// roll-up) can be unit-tested without Mongo — the controller pairs them with an
// atomic balance mutation. A 'both' contact's wallet lives on its POSCustomer
// record, consistent with contactKey.

// WalletTransaction.type enum. Direction is derived from the type: a 'debit'
// lowers the balance; every other type ('credit'/'refund'/'adjustment') raises
// it. The admin "adjust" endpoint sends 'credit'|'debit' to pick the direction.
const WALLET_TX_TYPES = ['credit', 'debit', 'adjustment', 'refund'];

// Free-text reason cap, mirroring the model's maxlength.
const WALLET_REASON_MAX = 280;

/**
 * Validate + normalise a wallet transaction request. Amount must be a positive
 * integer (NGN has no sub-units here); type must be allowed; reason is optional,
 * trimmed and length-capped.
 * @returns {{ ok: true, value: { type, amount, reason } } | { ok: false, message: string }}
 */
function validateWalletTx(body = {}) {
  const { type, amount, reason } = body;

  if (!WALLET_TX_TYPES.includes(type)) {
    return { ok: false, message: `Type must be one of: ${WALLET_TX_TYPES.join(', ')}` };
  }

  const n = Number(amount);
  if (!Number.isInteger(n) || n <= 0) {
    return { ok: false, message: 'Amount must be a positive integer' };
  }

  const r = reason === undefined || reason === null ? '' : String(reason).trim();
  if (r.length > WALLET_REASON_MAX) {
    return { ok: false, message: `Reason must be ${WALLET_REASON_MAX} characters or fewer` };
  }

  return { ok: true, value: { type, amount: n, reason: r } };
}

/**
 * Apply a transaction to a balance, returning the new balance. Debits subtract
 * (and are refused when they would overdraw — the wallet never goes negative);
 * every other type adds. The amount is re-validated here so a balance is never
 * mutated by a bad value even if a caller skipped validateWalletTx.
 * @returns {{ ok: true, balanceAfter: number } | { ok: false, message: string }}
 */
function applyWalletDelta(currentBalance, type, amount) {
  const bal = Number(currentBalance) || 0;
  const n = Number(amount);
  if (!Number.isInteger(n) || n <= 0) {
    return { ok: false, message: 'Amount must be a positive integer' };
  }
  const balanceAfter = type === 'debit' ? bal - n : bal + n;
  if (balanceAfter < 0) {
    return { ok: false, message: 'Insufficient wallet balance' };
  }
  return { ok: true, balanceAfter };
}

/**
 * Roll a contact's ledger up into the headline figures the /wallet page renders:
 * lifetime credited vs debited, the net (== current balance for a consistent
 * ledger), the transaction count and the most recent activity timestamp. Pure
 * (no DB / no Date.now). Debits are summed under `debited`; all other types
 * under `credited`, mirroring applyWalletDelta's direction rule.
 */
function summarizeWallet(transactions = []) {
  let credited = 0;
  let debited = 0;
  let lastActivityAt = null;

  for (const t of transactions) {
    const amt = t.amount || 0;
    if (t.type === 'debit') debited += amt;
    else credited += amt;

    const when = t.createdAt;
    const ts = when ? new Date(when).getTime() : NaN;
    if (!Number.isNaN(ts) && (lastActivityAt === null || ts > lastActivityAt)) {
      lastActivityAt = ts;
    }
  }

  return {
    credited,
    debited,
    net: credited - debited,
    count: transactions.length,
    lastActivityAt: lastActivityAt === null ? null : new Date(lastActivityAt).toISOString(),
  };
}

// ── Loyalty points ──────────────────────────────────────────────────────────────
//
// A per-contact loyalty-points balance held on the in-store POSCustomer record
// (loyaltyPoints) plus an append-only ledger of LoyaltyTransactions. Loyalty is
// IN-STORE ONLY — ecommerce customers have no points — so the owner is always the
// POSCustomer; a 'both' contact uses its in-store record. These helpers are pure so
// the points rules (positive-integer points, signed adjustments, debit-direction
// overdraw guard, ledger roll-up) can be unit-tested without Mongo — the controller
// pairs them with an atomic balance mutation (loyalty.service.js).

// LoyaltyTransaction.type enum. Direction is derived from the type: 'earn'/'bonus'
// add points; 'redeem'/'expiry' subtract them; 'adjustment' is signed (a positive
// `points` adds, a negative one subtracts).
const LOYALTY_TX_TYPES = ['earn', 'redeem', 'adjustment', 'bonus', 'expiry'];

// Debit-direction types always lower the balance (subtract their magnitude). A
// signed 'adjustment' with negative points is a debit too — handled separately.
const LOYALTY_DEBIT_TYPES = ['redeem', 'expiry'];

// Free-text reason cap, mirroring the model's maxlength.
const LOYALTY_REASON_MAX = 280;

/**
 * Signed effect a transaction has on the points balance. Add-types contribute
 * their magnitude; debit-types subtract it; a signed 'adjustment' contributes its
 * own sign. Shared by validateLoyaltyTx's overdraw guard, summarizeLoyalty and the
 * service's atomic $inc so the three never disagree on direction.
 */
function loyaltyDelta(type, points) {
  const n = Number(points) || 0;
  if (type === 'adjustment') return n;          // signed
  if (LOYALTY_DEBIT_TYPES.includes(type)) return -Math.abs(n);
  return Math.abs(n);                            // earn / bonus
}

/**
 * Validate + normalise a loyalty transaction request. Points must be a positive
 * integer for every type except 'adjustment', which is signed (a non-zero integer,
 * negative to deduct). Type must be allowed; reason is required, trimmed and
 * length-capped. When `currentBalance` is supplied, a debit-direction transaction
 * that would drive the balance below 0 is refused (the balance never goes negative).
 * @returns {{ ok: true, value: { type, points, reason } } | { ok: false, message: string }}
 */
function validateLoyaltyTx(body = {}, currentBalance) {
  const { type, points, reason } = body;

  if (!LOYALTY_TX_TYPES.includes(type)) {
    return { ok: false, message: `Type must be one of: ${LOYALTY_TX_TYPES.join(', ')}` };
  }

  const n = Number(points);
  if (!Number.isInteger(n)) {
    return { ok: false, message: 'Points must be an integer' };
  }
  if (type === 'adjustment') {
    if (n === 0) return { ok: false, message: 'Adjustment points cannot be zero' };
  } else if (n <= 0) {
    return { ok: false, message: 'Points must be a positive integer' };
  }

  const r = reason === undefined || reason === null ? '' : String(reason).trim();
  if (!r) {
    return { ok: false, message: 'Reason is required' };
  }
  if (r.length > LOYALTY_REASON_MAX) {
    return { ok: false, message: `Reason must be ${LOYALTY_REASON_MAX} characters or fewer` };
  }

  if (currentBalance !== undefined) {
    const delta = loyaltyDelta(type, n);
    if (delta < 0 && (Number(currentBalance) || 0) + delta < 0) {
      return { ok: false, message: 'Insufficient loyalty points' };
    }
  }

  return { ok: true, value: { type, points: n, reason: r } };
}

/**
 * Roll a contact's ledger up into the headline figures the /loyalty page renders:
 * lifetime points earned vs redeemed, the net (== current balance for a consistent
 * ledger), the transaction count and the most recent activity timestamp. Pure (no
 * DB / no Date.now). Each row is classified by its signed effect (loyaltyDelta):
 * positive contributes to `earned`, negative to `redeemed`.
 */
function summarizeLoyalty(transactions = []) {
  let earned = 0;
  let redeemed = 0;
  let lastActivityAt = null;

  for (const t of transactions) {
    const delta = loyaltyDelta(t.type, t.points);
    if (delta >= 0) earned += delta;
    else redeemed += -delta;

    const when = t.createdAt;
    const ts = when ? new Date(when).getTime() : NaN;
    if (!Number.isNaN(ts) && (lastActivityAt === null || ts > lastActivityAt)) {
      lastActivityAt = ts;
    }
  }

  return {
    earned,
    redeemed,
    net: earned - redeemed,
    count: transactions.length,
    lastActivityAt: lastActivityAt === null ? null : new Date(lastActivityAt).toISOString(),
  };
}

module.exports = {
  CONTACT_SOURCES,
  SETTABLE_STATUSES,
  ORDER_STATUSES,
  WALLET_TX_TYPES,
  WALLET_REASON_MAX,
  LOYALTY_TX_TYPES,
  LOYALTY_DEBIT_TYPES,
  LOYALTY_REASON_MAX,
  isValidEmail,
  normalizeEmail,
  normalizePhone,
  sanitizeAvatar,
  normalizePosCustomer,
  normalizeEcommerceUser,
  contactKey,
  mergePair,
  mergeContacts,
  buildInstoreFilter,
  buildEcommerceFilter,
  buildContactFilter,
  buildContactOrderMatch,
  parseOrderListQuery,
  buildOrderIndex,
  contactOrderTotals,
  summarizeSpending,
  validateContactCreate,
  validateContactUpdate,
  validateWalletTx,
  applyWalletDelta,
  summarizeWallet,
  loyaltyDelta,
  validateLoyaltyTx,
  summarizeLoyalty,
};
