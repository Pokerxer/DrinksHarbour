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
const asyncHandler = require('../utils/asyncHandler');
const {
  buildContactFilter,
  buildContactOrderMatch,
  parseOrderListQuery,
  buildOrderIndex,
  contactOrderTotals,
  normalizePosCustomer,
  normalizeEcommerceUser,
  mergeContacts,
  contactKey,
  validateContactCreate,
  validateContactUpdate,
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
          .select('firstName lastName email phone avatar status createdAt')
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
    }).select('firstName lastName email phone avatar status createdAt');
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
