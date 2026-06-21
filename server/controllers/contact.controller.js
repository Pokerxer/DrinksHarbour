// server/controllers/contact.controller.js
//
// Unified tenant Contacts directory. Reads every customer of the tenant from BOTH
// stores — in-store POSCustomer rows and ecommerce User(role:'customer') rows —
// and presents them as one searchable, filterable list with a `source`
// discriminator. The two collections are kept separate on disk; they are unified
// only here at the API layer.
//
// All routes are guarded by tenantAdminOrSuperAdmin and every query is scoped to
// req.tenant._id so one tenant can never see or touch another's customers.

const POSCustomer = require('../models/POSCustomer');
const User = require('../models/User');
const Order = require('../models/Order');
const WalletTransaction = require('../models/WalletTransaction');
const asyncHandler = require('../utils/asyncHandler');
const {
  buildContactFilter,
  buildContactOrderMatch,
  parseOrderListQuery,
  buildOrderIndex,
  contactOrderTotals,
  summarizeSpending,
  normalizePosCustomer,
  normalizeEcommerceUser,
  mergeContacts,
  contactKey,
  validateContactCreate,
  validateContactUpdate,
  validateWalletTx,
  summarizeWallet,
  WALLET_TX_TYPES,
} = require('../services/contact.helpers');

// Attach the client routing key (`source:id`) to a normalised contact.
function present(c) {
  return { ...c, key: contactKey(c) };
}

// ─── List ──────────────────────────────────────────────────────────────────────

exports.listContacts = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const { source, status, search } = req.query;
  const filters = buildContactFilter(tenantId, { source, status, search });

  const [posDocs, userDocs] = await Promise.all([
    filters.instore
      ? POSCustomer.find(filters.instore).sort({ createdAt: -1 }).lean()
      : Promise.resolve([]),
    filters.ecommerce
      ? User.find(filters.ecommerce)
          .select('firstName lastName email phone avatar status walletBalance createdAt')
          .sort({ createdAt: -1 })
          .lean()
      : Promise.resolve([]),
  ]);

  const instore = posDocs.map(normalizePosCustomer);
  const ecommerce = userDocs.map(normalizeEcommerceUser);
  let contacts = mergeContacts(instore, ecommerce);

  // `source:'both'` is a post-merge property, so honour that filter here.
  if (source === 'both') {
    contacts = contacts.filter((c) => c.source === 'both');
  }

  // Overlay real order activity. The stored totalSpent/totalOrders are only ever
  // hand-entered on in-store POSCustomers (ecommerce rows carry none), so when a
  // contact has actual orders we trust those; otherwise we keep the stored value.
  const orderDocs = await Order.find({ 'items.tenant': tenantId })
    .select('user totalAmount paymentDetails.customer.customerId paymentDetails.customer.phone shippingAddress.email shippingAddress.phone')
    .lean();
  const orderIndex = buildOrderIndex(orderDocs);
  for (const c of contacts) {
    const { totalOrders, totalSpent } = contactOrderTotals(c, orderIndex);
    if (totalOrders > 0) {
      c.totalOrders = totalOrders;
      c.totalSpent = totalSpent;
    }
  }

  contacts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // Headline stats over the unmerged + merged sets.
  const stats = {
    total: contacts.length,
    instore: contacts.filter((c) => c.source === 'instore').length,
    ecommerce: contacts.filter((c) => c.source === 'ecommerce').length,
    both: contacts.filter((c) => c.source === 'both').length,
    totalSpent: contacts.reduce((sum, c) => sum + (c.totalSpent || 0), 0),
    loyaltyPoints: contacts.reduce((sum, c) => sum + (c.loyaltyPoints || 0), 0),
  };

  res.json({ success: true, data: { contacts: contacts.map(present), stats } });
});

// ─── Get one ───────────────────────────────────────────────────────────────────

async function loadContact(source, id, tenantId) {
  if (source === 'ecommerce') {
    const user = await User.findOne({
      _id: id,
      tenant: tenantId,
      role: 'customer',
    }).select('firstName lastName email phone avatar status walletBalance createdAt');
    if (!user || user.status === 'deleted') return null;
    return normalizeEcommerceUser(user);
  }
  // default: in-store POSCustomer
  const cust = await POSCustomer.findOne({ _id: id, tenant: tenantId }).lean();
  if (!cust) return null;
  return normalizePosCustomer(cust);
}

exports.getContact = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const { source, id } = req.params;
  const contact = await loadContact(source, id, tenantId);
  if (!contact) {
    return res.status(404).json({ success: false, message: 'Contact not found' });
  }
  res.json({ success: true, data: { contact: present(contact) } });
});

// ─── Create (in-store only) ──────────────────────────────────────────────────

exports.createContact = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;

  const built = validateContactCreate(req.body, tenantId);
  if (!built.ok) {
    return res.status(400).json({ success: false, message: built.message });
  }

  const cust = await POSCustomer.create(built.value);
  res.status(201).json({
    success: true,
    data: { contact: present(normalizePosCustomer(cust.toObject())) },
  });
});

// ─── Update ────────────────────────────────────────────────────────────────────

exports.updateContact = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const { source, id } = req.params;

  const built = validateContactUpdate(source, req.body);
  if (!built.ok) {
    return res.status(400).json({ success: false, message: built.message });
  }

  if (source === 'ecommerce') {
    const user = await User.findOne({ _id: id, tenant: tenantId, role: 'customer' });
    if (!user || user.status === 'deleted') {
      return res.status(404).json({ success: false, message: 'Contact not found' });
    }
    // Ecommerce customers are storefront-owned: status is the only field an admin
    // may change here.
    if (built.changes.status !== undefined) user.status = built.changes.status;
    await user.save();
    return res.json({
      success: true,
      data: { contact: present(normalizeEcommerceUser(user.toObject())) },
    });
  }

  // in-store
  const cust = await POSCustomer.findOne({ _id: id, tenant: tenantId });
  if (!cust) {
    return res.status(404).json({ success: false, message: 'Contact not found' });
  }
  Object.assign(cust, built.changes);
  await cust.save();
  res.json({
    success: true,
    data: { contact: present(normalizePosCustomer(cust.toObject())) },
  });
});

// ─── Delete ──────────────────────────────────────────────────────────────────
//
// In-store contacts are hard-deleted (the POSCustomer is fully owned here).
// Ecommerce customers are soft-deleted (status:'deleted') so their orders /
// history stay intact and they never reappear in this directory.

exports.deleteContact = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const { source, id } = req.params;

  if (source === 'ecommerce') {
    const user = await User.findOne({ _id: id, tenant: tenantId, role: 'customer' });
    if (!user || user.status === 'deleted') {
      return res.status(404).json({ success: false, message: 'Contact not found' });
    }
    user.status = 'deleted';
    await user.save();
    return res.json({ success: true, message: 'Contact removed' });
  }

  const cust = await POSCustomer.findOneAndDelete({ _id: id, tenant: tenantId });
  if (!cust) {
    return res.status(404).json({ success: false, message: 'Contact not found' });
  }
  res.json({ success: true, message: 'Contact removed' });
});

// ─── Orders for a contact ──────────────────────────────────────────────────────
//
// Returns the tenant's orders for one contact, paginated and optionally filtered
// by status / date range. An order belongs to the contact when it was placed by
// their ecommerce account (`user`/`shippingAddress`) or tied to their POS record
// (`paymentDetails.customer.customerId` / phone). Every query is scoped to the
// tenant's own order lines via `items.tenant` so one tenant never sees another's
// sales. See buildContactOrderMatch for the exact identity rules.

exports.listContactOrders = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const { source, id } = req.params;

  const contact = await loadContact(source, id, tenantId);
  if (!contact) {
    return res.status(404).json({ success: false, message: 'Contact not found' });
  }

  const or = buildContactOrderMatch(contact);

  // No identity to match on → no orders (never query the whole collection).
  if (or.length === 0) {
    return res.json({
      success: true,
      data: {
        contact: present(contact),
        orders: [],
        stats: { count: 0, totalSpent: 0, delivered: 0, cancelled: 0 },
        pagination: { page: 1, limit: 20, total: 0, pages: 0 },
      },
    });
  }

  const baseMatch = { 'items.tenant': tenantId, $or: or };
  const { match, page, limit, skip } = parseOrderListQuery(req.query);
  const listMatch = { ...baseMatch, ...match };

  // Stats are lifetime (identity-only), so the cards stay stable as the table is
  // filtered by status / date; the table + count honour the active filters.
  const [statDocs, total, orders] = await Promise.all([
    Order.find(baseMatch).select('status totalAmount').lean(),
    Order.countDocuments(listMatch),
    Order.find(listMatch)
      .sort({ placedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'firstName lastName email')
      .populate('items.product', 'name images')
      .lean(),
  ]);

  const stats = {
    count: statDocs.length,
    totalSpent: statDocs.reduce((s, o) => s + (o.totalAmount || 0), 0),
    delivered: statDocs.filter((o) => o.status === 'delivered').length,
    cancelled: statDocs.filter((o) => o.status === 'cancelled').length,
  };

  res.json({
    success: true,
    data: {
      contact: present(contact),
      orders,
      stats,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    },
  });
});

// ─── Spending analytics for a contact ───────────────────────────────────────────
//
// Lifetime spend rolled up for the /spent page: totals + breakdowns by month,
// payment method, status and top products. Matches the same orders as
// listContactOrders (see buildContactOrderMatch), so the headline spend agrees
// across both pages.

exports.getContactSpending = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const { source, id } = req.params;

  const contact = await loadContact(source, id, tenantId);
  if (!contact) {
    return res.status(404).json({ success: false, message: 'Contact not found' });
  }

  const or = buildContactOrderMatch(contact);
  let orders = [];
  if (or.length > 0) {
    orders = await Order.find({ 'items.tenant': tenantId, $or: or })
      .select('totalAmount status paymentMethod placedAt createdAt items.product items.subproduct items.quantity items.itemSubtotal')
      .populate('items.product', 'name')
      .populate('items.subproduct', 'name')
      .lean();
  }

  res.json({
    success: true,
    data: { contact: present(contact), spending: summarizeSpending(orders) },
  });
});

// ─── Wallet (stored value / store credit) ────────────────────────────────────────
//
// A per-contact wallet: an authoritative running balance held on the owner record
// (POSCustomer.walletBalance / User.walletBalance) plus an append-only ledger of
// WalletTransactions. The owner record + a ledger row are mutated together; the
// balance change is an atomic, guarded $inc so it can never overdraw and never
// trusts a client-supplied figure (balanceAfter is always read back from the DB).
// A 'both' contact's wallet lives on its in-store POSCustomer record, consistent
// with contactKey. Every query is scoped to the tenant.

// Resolve which store record holds a contact's wallet + the model that owns it.
function walletOwner(contact) {
  if (contact.source === 'ecommerce') {
    return {
      Model: User,
      ownerType: 'User',
      ownerId: contact.ids.ecommerce,
      // re-assert the customer scope at write time, never touch a deleted account
      filter: (tenantId) => ({
        _id: contact.ids.ecommerce,
        tenant: tenantId,
        role: 'customer',
        status: { $ne: 'deleted' },
      }),
    };
  }
  // instore + both both address the POSCustomer record.
  return {
    Model: POSCustomer,
    ownerType: 'POSCustomer',
    ownerId: contact.ids.instore,
    filter: (tenantId) => ({ _id: contact.ids.instore, tenant: tenantId }),
  };
}

// Parse the wallet ledger listing query (type / date range / pagination), mirroring
// parseOrderListQuery but over WalletTransaction's `type` + `createdAt`.
function parseWalletListQuery(query = {}) {
  const match = {};

  const type = typeof query.type === 'string' ? query.type.trim() : '';
  if (type && WALLET_TX_TYPES.includes(type)) match.type = type;

  const createdAt = {};
  const from = query.from ? new Date(query.from) : null;
  if (from && !Number.isNaN(from.getTime())) createdAt.$gte = from;
  const to = query.to ? new Date(query.to) : null;
  if (to && !Number.isNaN(to.getTime())) {
    to.setHours(23, 59, 59, 999); // inclusive of the whole "to" day
    createdAt.$lte = to;
  }
  if (Object.keys(createdAt).length) match.createdAt = createdAt;

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  return { match, page, limit, skip: (page - 1) * limit };
}

/**
 * Atomically move a contact's wallet balance and append the matching ledger row.
 * The balance is changed with a guarded $inc — for a debit the filter also requires
 * `walletBalance >= amount`, so concurrent debits can never drive it negative. The
 * post-update balance is read straight from the DB into `balanceAfter`. If the
 * ledger insert fails after the balance moved, the balance is compensated back so
 * the two never drift (no multi-document transaction needed on standalone Mongo).
 */
async function mutateWallet({ owner, tenantId, value, reference, relatedOrder, createdBy }) {
  const { Model, ownerType, ownerId } = owner;
  const { type, amount, reason } = value;
  const inc = type === 'debit' ? -amount : amount;

  const filter = owner.filter(tenantId);
  if (type === 'debit') filter.walletBalance = { $gte: amount };

  const updated = await Model.findOneAndUpdate(
    filter,
    { $inc: { walletBalance: inc } },
    { new: true }
  ).select('walletBalance');

  if (!updated) {
    // Either the owner vanished, or (for a debit) the balance was insufficient.
    return { ok: false, status: type === 'debit' ? 400 : 404,
      message: type === 'debit' ? 'Insufficient wallet balance' : 'Contact not found' };
  }

  try {
    const tx = await WalletTransaction.create({
      tenant: tenantId,
      ownerType,
      ownerId,
      type,
      amount,
      balanceAfter: updated.walletBalance,
      reason,
      reference,
      relatedOrder,
      createdBy,
    });
    return { ok: true, balance: updated.walletBalance, tx };
  } catch (err) {
    // Ledger write failed — undo the balance move to keep the two consistent.
    await Model.updateOne({ _id: updated._id }, { $inc: { walletBalance: -inc } });
    throw err;
  }
}

// GET /api/contacts/:source/:id/wallet — balance + lifetime stats + a paginated,
// optionally filtered (type / date) ledger. Stats are lifetime (identity-only) so
// the cards stay stable while the table is filtered.
exports.getContactWallet = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const { source, id } = req.params;

  const contact = await loadContact(source, id, tenantId);
  if (!contact) {
    return res.status(404).json({ success: false, message: 'Contact not found' });
  }

  const owner = walletOwner(contact);
  const baseMatch = { tenant: tenantId, ownerType: owner.ownerType, ownerId: owner.ownerId };
  const { match, page, limit, skip } = parseWalletListQuery(req.query);
  const listMatch = { ...baseMatch, ...match };

  const [allTx, total, transactions] = await Promise.all([
    WalletTransaction.find(baseMatch).select('type amount createdAt').lean(),
    WalletTransaction.countDocuments(listMatch),
    WalletTransaction.find(listMatch)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('createdBy', 'firstName lastName')
      .populate('relatedOrder', 'orderNumber')
      .lean(),
  ]);

  const summary = summarizeWallet(allTx);
  const stats = {
    balance: contact.walletBalance, // authoritative, from the owner record
    credited: summary.credited,
    debited: summary.debited,
    net: summary.net,
    count: summary.count,
    lastActivityAt: summary.lastActivityAt,
  };

  res.json({
    success: true,
    data: {
      contact: present(contact),
      balance: contact.walletBalance,
      stats,
      transactions,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    },
  });
});

// Shared body for the two admin mutations. `forcedType` pins top-up to a credit;
// adjust passes null and accepts a credit OR debit from the body.
async function handleWalletMutation(req, res, forcedType) {
  const tenantId = req.tenant?._id;
  const { source, id } = req.params;

  const contact = await loadContact(source, id, tenantId);
  if (!contact) {
    return res.status(404).json({ success: false, message: 'Contact not found' });
  }

  const body = forcedType ? { ...req.body, type: forcedType } : req.body;
  const built = validateWalletTx(body);
  if (!built.ok) {
    return res.status(400).json({ success: false, message: built.message });
  }
  // An admin correction can only move money in or out — never a programmatic type.
  if (!forcedType && !['credit', 'debit'].includes(built.value.type)) {
    return res.status(400).json({ success: false, message: 'Adjustment must be a credit or debit' });
  }

  const result = await mutateWallet({
    owner: walletOwner(contact),
    tenantId,
    value: built.value,
    createdBy: req.user?._id,
  });
  if (!result.ok) {
    return res.status(result.status).json({ success: false, message: result.message });
  }

  res.status(201).json({
    success: true,
    data: { balance: result.balance, transaction: result.tx },
  });
}

// POST /api/contacts/:source/:id/wallet/topup — credit the wallet (admin top-up).
exports.topUpWallet = asyncHandler((req, res) => handleWalletMutation(req, res, 'credit'));

// POST /api/contacts/:source/:id/wallet/adjust — credit OR debit (admin correction).
// A debit that would overdraw is rejected.
exports.adjustWallet = asyncHandler((req, res) => handleWalletMutation(req, res, null));

// ─── Phase 2 (not yet wired): POS wallet tender ──────────────────────────────────
//
// Order.paymentMethod already allows 'wallet'. To pay with the wallet at POS, the
// sale path in pos.controller.js (the Order.create branch) would, for a named
// customer (paymentDetails.customer.customerId) paying by 'wallet', call
// mutateWallet({ owner, tenantId, value:{ type:'debit', amount: order.totalAmount },
// reference: receiptNumber, relatedOrder: order._id, createdBy }) — blocking the
// sale when the guarded $inc returns insufficient — and credit it back on refund.
