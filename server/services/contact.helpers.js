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
    totalSpent: doc.totalSpent || 0,
    totalOrders: doc.totalOrders || 0,
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
    totalSpent: 0,
    totalOrders: 0,
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
    totalSpent: (ins.totalSpent || 0) + (eco.totalSpent || 0),
    totalOrders: (ins.totalOrders || 0) + (eco.totalOrders || 0),
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

module.exports = {
  CONTACT_SOURCES,
  SETTABLE_STATUSES,
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
  validateContactCreate,
  validateContactUpdate,
};
