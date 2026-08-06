// services/mailContext.service.js
//
// Who is this sender, as a DrinksHarbour customer? A read-only lookup that backs
// the Customer panel in the support reading pane, so an operator can see the
// person's order history before typing a reply instead of alt-tabbing to the
// orders module and searching by hand.
//
// Two outcomes are deliberately kept apart:
//   - A sender we have never sold to is NORMAL. It resolves to `customer: null`
//     and the panel says "No customer record".
//   - A database we cannot reach is NOT that, and raises. Reporting "no customer
//     record" over an unreachable database would state the opposite of the truth
//     about somebody the operator is one click away from replying to.
//
// Nothing here writes. The caller's role is checked by the controller through
// mailAccount.service.assertMailReader before any of this runs.

const mongoose = require('mongoose');
const { ValidationError, AppError } = require('../utils/errors');

// Lazy so requiring this module never depends on mongoose model registration
// order — the same reason mailAccount.service defers MailAccount.
const User = () => require('../models/User');
const Order = () => require('../models/Order');

/** How much history the panel shows inline. The count covers the rest. */
const RECENT_ORDER_LIMIT = 5;

/** RFC 5321 caps a path at 256 octets including the angle brackets. */
const MAX_EMAIL_LENGTH = 254;

const ANGLE_ADDRESS = /<([^<>]+)>\s*$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Normalises the `email` query param to a bare, lowercased address.
 *
 * The reading pane passes `from.address`, which is already bare — but this is a
 * query string, so the value is whatever the caller sends. A display-name form
 * ("Ada <ada@example.com>") is unwrapped rather than refused because that is
 * what a header looks like and refusing it would be a puzzle, not a safeguard.
 * Everything else is refused: the value is interpolated into a RegExp for the
 * guest-order match, and the length bound plus the shape check are what keep
 * that from becoming a catastrophically backtracking pattern built from
 * attacker text.
 */
function normalizeContextEmail(value) {
  if (typeof value !== 'string') {
    throw new ValidationError('An email address is required');
  }
  let raw = value.trim();
  const angled = raw.match(ANGLE_ADDRESS);
  if (angled) raw = angled[1].trim();

  const email = raw.toLowerCase();
  if (!email) throw new ValidationError('An email address is required');
  if (email.length > MAX_EMAIL_LENGTH || !EMAIL_RE.test(email)) {
    throw new ValidationError('That email address is not valid');
  }
  return email;
}

const iso = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

/**
 * Every order belonging to this address, however it was placed.
 *
 * Two clauses, matching contact.helpers' rule for the same question: orders
 * placed while signed in carry `user`, and a guest checkout carries only the
 * email the shopper typed — stored as typed, hence the anchored case-insensitive
 * match rather than an equality test.
 */
function orderMatch(email, userId) {
  const or = [
    { 'shippingAddress.email': new RegExp(`^${escapeRegex(email)}$`, 'i') },
  ];
  if (userId) or.push({ user: userId });
  return { $or: or };
}

/** The fields the panel shows, and nothing else. */
function presentOrder(doc) {
  return {
    id: String(doc._id),
    orderNumber: doc.orderNumber || null,
    date: iso(doc.placedAt || doc.createdAt),
    status: doc.status || 'pending',
    paymentStatus: doc.paymentStatus || null,
    total: Number(doc.totalAmount) || 0,
    currency: doc.currency || 'NGN',
  };
}

function presentCustomer(doc, callerTenantId) {
  // The admin Contacts directory is scoped to the operator's own tenant
  // (contact.helpers' buildEcommerceFilter), so the key is only handed over
  // when it will actually resolve. A link that 404s is worse than no link.
  const sameTenant = Boolean(
    callerTenantId && doc.tenant && String(doc.tenant) === String(callerTenantId)
  );
  return {
    id: String(doc._id),
    name: [doc.firstName, doc.lastName].filter(Boolean).join(' ') || doc.email,
    email: doc.email,
    phone: doc.phone || '',
    role: doc.role || 'customer',
    status: doc.status || null,
    customerSince: iso(doc.createdAt),
    contactKey: sameTenant ? `ecommerce:${doc._id}` : null,
  };
}

/**
 * The stored-value balances this customer holds.
 *
 * `platformBalance` is the platform e-wallet and `storeBalance` the tenant-
 * scoped one; they are separate ledgers on purpose (see the User model) and are
 * never summed here. Loyalty rides along because an operator handling a
 * complaint needs to know what the customer can be compensated with.
 */
function presentWallet(doc) {
  return {
    platformBalance: Number(doc.platformWalletBalance) || 0,
    storeBalance: Number(doc.walletBalance) || 0,
    loyaltyPoints: Number(doc.loyaltyPoints) || 0,
    loyaltyTier: doc.loyaltyTier || null,
  };
}

const CUSTOMER_FIELDS =
  'firstName lastName email phone role status tenant createdAt ' +
  'walletBalance platformWalletBalance loyaltyPoints loyaltyTier';

const ORDER_FIELDS = 'orderNumber placedAt createdAt status paymentStatus totalAmount currency';

/**
 * Resolve one sender address to the customer record behind it.
 *
 * @param {string} rawEmail   the `email` query param, unvalidated
 * @param {*} callerTenantId  the operator's tenant, for the contacts deep link
 */
async function getCustomerContext(rawEmail, callerTenantId) {
  const email = normalizeContextEmail(rawEmail);

  if (!mongoose.connection || mongoose.connection.readyState !== 1) {
    throw new AppError('Customer records are unavailable right now', 503, true);
  }

  const doc = await User()
    .findOne({ email, status: { $ne: 'deleted' } })
    .select(CUSTOMER_FIELDS)
    .lean();

  const match = orderMatch(email, doc?._id);
  const [orders, orderCount] = await Promise.all([
    Order()
      .find(match)
      .sort({ placedAt: -1, createdAt: -1 })
      .limit(RECENT_ORDER_LIMIT)
      .select(ORDER_FIELDS)
      .lean(),
    Order().countDocuments(match),
  ]);

  return {
    email,
    customer: doc ? presentCustomer(doc, callerTenantId) : null,
    wallet: doc ? presentWallet(doc) : null,
    orders: (orders || []).map(presentOrder),
    orderCount: Number(orderCount) || 0,
  };
}

module.exports = {
  getCustomerContext,
  normalizeContextEmail,
  presentOrder,
  presentCustomer,
  presentWallet,
  RECENT_ORDER_LIMIT,
};
