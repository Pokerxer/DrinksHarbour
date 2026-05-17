// controllers/pos.controller.js

const POSSession = require('../models/POSSession');
const Order = require('../models/Order');
const asyncHandler = require('../utils/asyncHandler');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Tenant = require('../models/Tenant');
const Size = require('../models/Size');
const SubProduct = require('../models/SubProduct');
const { generateOrderNumber, generateReceiptNumber, generateReturnNumber } = require('../utils/orderUtils');
const { calcPlatformCostPrice, calcPlatformSellingPrice, DEFAULT_PLATFORM_MARKUP } = require('../utils/pricing');

// ─── helpers ────────────────────────────────────────────────────────────────

/**
 * Compute the full POS pricing details using the same pipeline as the website cart.
 * Returns both the selling price and the cost price needed for revenue tracking.
 *
 * @param {object} sp       - SubProduct document (lean, with product populated)
 * @param {object|null} sizeDoc - Size document (lean), or null for no-size products
 * @param {object} tenant   - Tenant document from req.tenant
 * @returns {{ sellingPrice, costPrice, revenueModel, markupPct, commissionPct }}
 */
function computePOSPricing(sp, sizeDoc, tenant) {
  const revenueModel      = tenant?.revenueModel        ?? 'markup';
  const markupPct         = tenant?.markupPercentage    ?? 25;
  const commissionPct     = tenant?.commissionPercentage ?? 12;
  const platformMarkupPct = sp.product?.platformMarkup  ?? DEFAULT_PLATFORM_MARKUP;

  const productDiscount = sp.product?.platformDiscount?.value > 0 && sp.product?.platformDiscount?.type
    ? { value: sp.product.platformDiscount.value, type: sp.product.platformDiscount.type,
        start: sp.product.platformDiscount.start,  end: sp.product.platformDiscount.end }
    : null;

  // Size values fall back to subproduct when 0 (0 means "not set")
  const rawCost    = (sizeDoc?.costPrice    > 0 ? sizeDoc.costPrice    : null) ?? sp.costPrice        ?? 0;
  const rawSelling = (sizeDoc?.sellingPrice > 0 ? sizeDoc.sellingPrice : null) ?? sp.baseSellingPrice ?? 0;

  if (rawCost <= 0 && rawSelling <= 0) {
    return { sellingPrice: 0, costPrice: 0, revenueModel, markupPct, commissionPct };
  }

  const platformCostPrice    = calcPlatformCostPrice(rawCost, rawSelling, revenueModel, markupPct, commissionPct);
  let   platformSellingPrice = calcPlatformSellingPrice(platformCostPrice, platformMarkupPct, productDiscount);

  // Apply SubProduct-level sale discount
  const now       = new Date();
  const saleStart = sp.saleStartDate ? new Date(sp.saleStartDate) : null;
  const saleEnd   = sp.saleEndDate   ? new Date(sp.saleEndDate)   : null;
  const saleActive = sp.isOnSale && (!saleStart || now >= saleStart) && (!saleEnd || now <= saleEnd);

  if (saleActive && sp.saleDiscountValue > 0) {
    const dtype = sp.saleType || 'percentage';
    if (dtype === 'percentage' || dtype === 'flash_sale') {
      platformSellingPrice = parseFloat((platformSellingPrice * (1 - sp.saleDiscountValue / 100)).toFixed(2));
    } else if (dtype === 'fixed') {
      platformSellingPrice = Math.max(0, parseFloat((platformSellingPrice - sp.saleDiscountValue).toFixed(2)));
    }
  }

  return { sellingPrice: platformSellingPrice, costPrice: platformCostPrice, revenueModel, markupPct, commissionPct };
}

/** Convenience wrapper — returns just the selling price (used by getPOSProducts). */
function computePOSPrice(sp, sizeDoc, tenant) {
  return computePOSPricing(sp, sizeDoc, tenant).sellingPrice;
}

function startOfDay(d = new Date()) {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  return s;
}
function endOfDay(d = new Date()) {
  const e = new Date(d);
  e.setHours(23, 59, 59, 999);
  return e;
}

const PAYMENT_METHODS = ['cash', 'card', 'bank_transfer', 'mobile_money', 'split'];

/** Aggregate POS orders by payment method for a time range */
async function getPOSOrderStats(tenantId, from, to) {
  const agg = await Order.aggregate([
    {
      $match: {
        'items.tenant': tenantId,   // Order has no top-level tenant; filter via items
        source: 'pos',
        paymentStatus: 'paid',
        createdAt: { $gte: from, $lte: to },
      },
    },
    {
      $group: {
        _id: '$paymentMethod',
        total: { $sum: '$totalAmount' },
        count: { $sum: 1 },
      },
    },
  ]);
  let totalSales = 0;
  let orderCount = 0;
  const breakdown = {};
  agg.forEach((g) => {
    totalSales += g.total;
    orderCount += g.count;
    breakdown[g._id] = { total: g.total, count: g.count };
  });
  return { totalSales, orderCount, breakdown };
}

/** Aggregate orders placed during an open session window */
async function getSessionOrderStats(tenantId, from, to) {
  return getPOSOrderStats(tenantId, from, to);
}

// ─── Open a session ──────────────────────────────────────────────────────────

/**
 * POST /api/pos/sessions/open
 * Body: { openingCash: number, notes: string }
 *
 * Odoo-style: captures opening cash balance, records the opening cashier,
 * initialises methodBalances with opening cash.
 */
exports.openSession = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant required' });

  const { openingCash = 0, notes = '', terminalType = 'retail' } = req.body;
  const validTerminals = ['retail', 'wholesale'];
  const terminal = validTerminals.includes(terminalType) ? terminalType : 'retail';

  const existing = await POSSession.findOne({ tenant: tenantId, status: 'open', terminalType: terminal });
  if (existing) {
    return res.status(409).json({
      success: false,
      message: `A ${terminal} session is already open`,
      data: { session: existing },
    });
  }
  const cashAmount = Math.max(0, Number(openingCash) || 0);

  const now = new Date();

  const session = await POSSession.create({
    tenant:     tenantId,
    openedBy:   req.user._id,
    activeCashier: req.user._id,
    terminalType: terminal,
    openingCash: cashAmount,
    openingBalance: cashAmount,   // legacy compat
    notes,
    status:    'open',
    openedAt:  now,
    // Seed methodBalances with opening cash
    methodBalances: [
      { method: 'cash',         opening: cashAmount, theoretical: cashAmount, counted: null, difference: null },
      { method: 'card',         opening: 0,          theoretical: 0,          counted: null, difference: null },
      { method: 'bank_transfer',opening: 0,          theoretical: 0,          counted: null, difference: null },
      { method: 'mobile_money', opening: 0,          theoretical: 0,          counted: null, difference: null },
    ],
    // Start cashier log
    cashierLog: [{ cashier: req.user._id, startedAt: now }],
  });

  await session.populate('openedBy activeCashier', 'firstName lastName email posName avatar');

  res.status(201).json({ success: true, data: { session } });
});

// ─── Closing Control — get theoretical values ────────────────────────────────

/**
 * GET /api/pos/sessions/:id/closing-control
 *
 * Odoo-style: returns current theoretical balances per payment method
 * before the cashier enters counted amounts. Call this to populate
 * the closing control screen.
 */
exports.getClosingControl = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const session  = await POSSession.findOne({ _id: req.params.id, tenant: tenantId });
  if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
  if (session.status === 'closed') {
    return res.status(400).json({ success: false, message: 'Session already closed' });
  }

  // Re-calculate theoretical values from all orders placed in this session window
  const stats = await getSessionOrderStats(tenantId, session.openedAt, new Date());

  const methods = PAYMENT_METHODS.filter(m => m !== 'split').map(method => {
    const orderTotal = stats.breakdown?.[method]?.total || 0;
    const orderCount = stats.breakdown?.[method]?.count || 0;
    // For cash: theoretical = opening + cash received
    const theoretical = method === 'cash'
      ? session.openingCash + orderTotal
      : orderTotal;

    return {
      method,
      opening:     method === 'cash' ? session.openingCash : 0,
      theoretical,
      orderTotal,
      orderCount,
    };
  });

  res.json({
    success: true,
    data: {
      sessionId:   session._id,
      openedAt:    session.openedAt,
      openingCash: session.openingCash,
      totalSales:  stats.totalSales,
      orderCount:  stats.orderCount,
      methods,
    },
  });
});

// ─── Close a session ─────────────────────────────────────────────────────────

/**
 * POST /api/pos/sessions/:id/close
 * Body: {
 *   countedBalances: [{ method, counted }],   // cashier-entered closing amounts
 *   closingNotes: string
 * }
 *
 * Odoo-style: computes difference per method, flags discrepancies.
 */
exports.closeSession = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const session  = await POSSession.findOne({ _id: req.params.id, tenant: tenantId });

  if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
  if (session.status === 'closed') {
    return res.status(400).json({ success: false, message: 'Session already closed' });
  }

  const { countedBalances = [], closingNotes = '' } = req.body;
  const closedAt = new Date();

  // Final order stats
  const stats = await getSessionOrderStats(tenantId, session.openedAt, closedAt);

  // Build methodBalances with theoretical + counted + difference
  const methodBalances = PAYMENT_METHODS.filter(m => m !== 'split').map(method => {
    const orderTotal = stats.breakdown?.[method]?.total || 0;
    const theoretical = method === 'cash'
      ? session.openingCash + orderTotal
      : orderTotal;

    const countedEntry = countedBalances.find(b => b.method === method);
    const counted = countedEntry != null && countedEntry.counted != null
      ? Number(countedEntry.counted)
      : null;

    const difference = counted != null ? counted - theoretical : null;

    return { method, opening: method === 'cash' ? session.openingCash : 0, theoretical, counted, difference };
  });

  const hasDifference = methodBalances.some(
    m => m.difference != null && Math.abs(m.difference) > 0.01
  );

  // End active cashier log entry
  const log = session.cashierLog || [];
  const lastEntry = log[log.length - 1];
  if (lastEntry && !lastEntry.endedAt) {
    lastEntry.endedAt = closedAt;
  }

  session.status          = 'closed';
  session.closedBy        = req.user._id;
  session.closedAt        = closedAt;
  session.closingNotes    = closingNotes;
  session.methodBalances  = methodBalances;
  session.hasDifference   = hasDifference;
  session.cashierLog      = log;

  // Legacy totals
  session.totalSales       = stats.totalSales;
  session.orderCount       = stats.orderCount;
  session.cashSales        = stats.breakdown?.cash?.total        || 0;
  session.cardSales        = stats.breakdown?.card?.total        || 0;
  session.transferSales    = stats.breakdown?.bank_transfer?.total || 0;
  session.mobileMoneySales = stats.breakdown?.mobile_money?.total || 0;
  session.splitSales       = stats.breakdown?.split?.total       || 0;

  // Legacy closing balance = cash counted (or theoretical if not counted)
  const cashMethod = methodBalances.find(m => m.method === 'cash');
  session.closingBalance = cashMethod?.counted ?? cashMethod?.theoretical ?? 0;

  await session.save();
  await session.populate('openedBy closedBy activeCashier', 'firstName lastName email posName');

  res.json({ success: true, data: { session, hasDifference } });
});

// ─── Switch Cashier (mid-session) ────────────────────────────────────────────

/**
 * POST /api/pos/sessions/:id/switch-cashier
 * Body: { pin: string }
 *
 * Odoo-style: mid-session employee switching without closing the session.
 * Verifies PIN against all posAccess users for this tenant.
 * Updates session.activeCashier and appends to cashierLog.
 */
exports.switchCashier = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const { pin }  = req.body;

  if (!pin) return res.status(400).json({ success: false, message: 'PIN required' });

  const session = await POSSession.findOne({ _id: req.params.id, tenant: tenantId, status: 'open' });
  if (!session) return res.status(404).json({ success: false, message: 'Session not found or not open' });

  // Find matching PIN among tenant's POS users
  const users = await User.find({
    tenant:     tenantId,
    posAccess:  true,
    posPinHash: { $exists: true, $ne: null },
    status:     'active',
  }).select('+posPinHash');

  let matchedUser = null;
  for (const u of users) {
    if (await bcrypt.compare(String(pin), u.posPinHash)) {
      matchedUser = u;
      break;
    }
  }

  if (!matchedUser) {
    return res.status(401).json({ success: false, message: 'Invalid PIN' });
  }

  const now = new Date();

  // End the current cashier's log entry
  const log = session.cashierLog || [];
  const lastEntry = log[log.length - 1];
  if (lastEntry && !lastEntry.endedAt) {
    lastEntry.endedAt = now;
  }

  // Start new entry only if switching to a different cashier
  if (session.activeCashier?.toString() !== matchedUser._id.toString()) {
    log.push({ cashier: matchedUser._id, startedAt: now });
  } else {
    // Re-activating same cashier — just reopen the log entry
    log.push({ cashier: matchedUser._id, startedAt: now });
  }

  session.activeCashier = matchedUser._id;
  session.cashierLog    = log;
  await session.save();

  res.json({
    success: true,
    data: {
      cashier: {
        _id:      matchedUser._id,
        firstName: matchedUser.firstName,
        lastName:  matchedUser.lastName,
        posName:   matchedUser.posName,
        email:     matchedUser.email,
      },
    },
  });
});

// ─── Get current open session ────────────────────────────────────────────────

/**
 * GET /api/pos/sessions/current
 */
exports.getCurrentSession = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const session  = await POSSession.findOne({ tenant: tenantId, status: 'open' })
    .populate('openedBy activeCashier', 'firstName lastName email posName avatar')
    .sort({ openedAt: -1 });

  res.json({ success: true, data: { session: session || null } });
});

// ─── Session history ─────────────────────────────────────────────────────────

/**
 * GET /api/pos/sessions
 */
exports.getSessionList = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const page  = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, parseInt(req.query.limit) || 20);
  const skip  = (page - 1) * limit;

  const [sessions, total] = await Promise.all([
    POSSession.find({ tenant: tenantId })
      .populate('openedBy closedBy activeCashier', 'firstName lastName posName')
      .sort({ openedAt: -1 })
      .skip(skip)
      .limit(limit),
    POSSession.countDocuments({ tenant: tenantId }),
  ]);

  res.json({ success: true, data: { sessions, total, page, limit } });
});

// ─── POS Dashboard ───────────────────────────────────────────────────────────

/**
 * GET /api/pos/dashboard
 */
exports.getPOSDashboard = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const now = new Date();
  const todayStart     = startOfDay(now);
  const todayEnd       = endOfDay(now);
  const yesterdayStart = startOfDay(new Date(now - 86400000));
  const yesterdayEnd   = endOfDay(new Date(now - 86400000));
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [todayStats, yesterdayStats, monthStats, currentSession, recentOrders] = await Promise.all([
    getPOSOrderStats(tenantId, todayStart, todayEnd),
    getPOSOrderStats(tenantId, yesterdayStart, yesterdayEnd),
    getPOSOrderStats(tenantId, thisMonthStart, todayEnd),
    POSSession.findOne({ tenant: tenantId, status: 'open' })
      .populate('openedBy activeCashier', 'firstName lastName posName')
      .sort({ openedAt: -1 }),
    Order.find({ 'items.tenant': tenantId, source: 'pos', paymentStatus: 'paid' })
      .select('orderNumber totalAmount paymentMethod placedAt createdAt')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),
  ]);

  // 7-day chart
  const chartData = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const stats = await getPOSOrderStats(tenantId, startOfDay(d), endOfDay(d));
    chartData.push({
      date:   startOfDay(d).toISOString().split('T')[0],
      sales:  stats.totalSales,
      orders: stats.orderCount,
    });
  }

  res.json({
    success: true,
    data: {
      currentSession,
      today:     todayStats,
      yesterday: yesterdayStats,
      thisMonth: monthStats,
      chartData,
      recentOrders: recentOrders.map((o) => ({ ...o, total: o.totalAmount })),
    },
  });
});

// ─── PIN Login ───────────────────────────────────────────────────────────────

/**
 * POST /api/pos/auth/pin-login
 * Body: { tenantSlug, pin }
 */
exports.pinLogin = asyncHandler(async (req, res) => {
  const { tenantSlug, pin } = req.body;
  if (!tenantSlug || !pin) {
    return res.status(400).json({ success: false, message: 'tenantSlug and pin are required' });
  }

  const tenant = await Tenant.findOne({ slug: tenantSlug, isActive: true });
  if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found' });

  const users = await User.find({
    tenant:     tenant._id,
    posAccess:  true,
    posPinHash: { $exists: true, $ne: null },
    status:     'active',
  }).select('+posPinHash');

  if (!users.length) {
    return res.status(401).json({ success: false, message: 'Invalid PIN' });
  }

  let matchedUser = null;
  for (const u of users) {
    if (await bcrypt.compare(String(pin), u.posPinHash)) {
      matchedUser = u;
      break;
    }
  }

  if (!matchedUser) {
    return res.status(401).json({ success: false, message: 'Invalid PIN' });
  }

  const token = jwt.sign(
    { userId: matchedUser._id, email: matchedUser.email, role: matchedUser.role, tenant: matchedUser.tenant },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  const refreshToken = jwt.sign(
    { userId: matchedUser._id, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );

  res.json({
    success: true,
    data: {
      user: {
        _id:       matchedUser._id,
        email:     matchedUser.email,
        firstName: matchedUser.firstName,
        lastName:  matchedUser.lastName,
        posName:   matchedUser.posName,
        role:      matchedUser.role,
        tenant: { _id: tenant._id, slug: tenant.slug },
      },
      token,
      refreshToken,
    },
  });
});

// ─── List Cashiers ───────────────────────────────────────────────────────────

exports.listCashiers = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const cashiers = await User.find({
    tenant: tenantId,
    role:   { $in: ['tenant_staff', 'tenant_admin', 'tenant_owner'] },
    status: { $ne: 'deleted' },
  }).select('firstName lastName email phone posAccess posName role status createdAt avatar');

  res.json({ success: true, data: { cashiers } });
});

// ─── Create Cashier ──────────────────────────────────────────────────────────

exports.createCashier = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const { firstName, lastName, email, phone, pin, posName, posPermissions } = req.body;

  if (!firstName || !email) {
    return res.status(400).json({ success: false, message: 'firstName and email are required' });
  }

  const existing = await User.findOne({ email: email.toLowerCase().trim() });
  if (existing) return res.status(409).json({ success: false, message: 'Email already in use' });

  const userData = {
    firstName,
    lastName:        lastName || '',
    email:           email.toLowerCase().trim(),
    phone,
    role:            'tenant_staff',
    tenant:          tenantId,
    posAccess:       true,
    posName:         posName || firstName,
    posPermissions:  posPermissions || ['pos:sell', 'pos:terminal:retail', 'pos:terminal:wholesale'],
    status:          'active',
    isEmailVerified: true,
    passwordHash:    await bcrypt.hash(Math.random().toString(36) + Date.now(), 10),
  };

  if (pin) {
    if (!/^\d{4,6}$/.test(String(pin))) {
      return res.status(400).json({ success: false, message: 'PIN must be 4–6 digits' });
    }
    userData.posPinHash = await bcrypt.hash(String(pin), 10);
  }

  const user = await User.create(userData);

  res.status(201).json({
    success: true,
    data: {
      cashier: {
        _id: user._id, firstName: user.firstName, lastName: user.lastName,
        email: user.email, phone: user.phone, posAccess: user.posAccess,
        posName: user.posName, role: user.role, status: user.status,
      },
    },
  });
});

// ─── Update Cashier ──────────────────────────────────────────────────────────

exports.updateCashier = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const user = await User.findOne({ _id: req.params.id, tenant: tenantId });
  if (!user) return res.status(404).json({ success: false, message: 'Cashier not found' });

  const { pin, posAccess, posName, firstName, lastName, phone, posPermissions } = req.body;

  if (pin !== undefined) {
    if (!/^\d{4,6}$/.test(String(pin))) {
      return res.status(400).json({ success: false, message: 'PIN must be 4–6 digits' });
    }
    user.posPinHash = await bcrypt.hash(String(pin), 10);
  }
  if (posAccess  !== undefined) user.posAccess  = Boolean(posAccess);
  if (posName    !== undefined) user.posName    = posName;
  if (firstName  !== undefined) user.firstName  = firstName;
  if (lastName   !== undefined) user.lastName   = lastName;
  if (phone      !== undefined) user.phone      = phone;

  await user.save();

  res.json({
    success: true,
    data: {
      cashier: {
        _id: user._id, firstName: user.firstName, lastName: user.lastName,
        email: user.email, phone: user.phone, posAccess: user.posAccess,
        posName: user.posName, role: user.role, status: user.status,
      },
    },
  });
});

// ─── Delete Cashier ──────────────────────────────────────────────────────────

exports.deleteCashier = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const user = await User.findOne({ _id: req.params.id, tenant: tenantId });
  if (!user) return res.status(404).json({ success: false, message: 'Cashier not found' });
  if (user.role === 'tenant_owner') {
    return res.status(403).json({ success: false, message: 'Cannot delete tenant owner' });
  }
  user.status = 'deleted';
  await user.save();
  res.json({ success: true, message: 'Cashier removed' });
});

// ─── POS Staff Login ─────────────────────────────────────────────────────────
/**
 * POST /api/pos/auth/staff-login
 * Body: { tenantSlug, staffId, pin?, password? }
 * Returns POS-specific JWT (12h) with type:'pos'
 */
exports.staffLogin = asyncHandler(async (req, res) => {
  const { tenantSlug, staffId, pin, password } = req.body;
  if (!tenantSlug || !staffId) {
    return res.status(400).json({ success: false, message: 'tenantSlug and staffId required' });
  }

  const tenant = await Tenant.findOne({ slug: tenantSlug, isActive: true });
  if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found' });

  const user = await User.findOne({
    _id: staffId,
    tenant: tenant._id,
    posAccess: true,
    status: 'active',
  }).select('+posPinHash +passwordHash');

  if (!user) return res.status(401).json({ success: false, message: 'Staff not found or no POS access' });

  // Verify PIN or password
  let authenticated = false;
  if (pin && user.posPinHash) {
    authenticated = await bcrypt.compare(String(pin), user.posPinHash);
  } else if (password && user.passwordHash) {
    authenticated = await bcrypt.compare(password, user.passwordHash);
  }

  if (!authenticated) {
    return res.status(401).json({ success: false, message: 'Invalid PIN or password' });
  }

  const posToken = jwt.sign(
    {
      type:           'pos',
      userId:         user._id,
      tenantId:       tenant._id,
      tenantSlug:     tenant.slug,
      role:           user.role,
      posPermissions: user.posPermissions || ['pos:sell'],
    },
    process.env.JWT_SECRET,
    { expiresIn: '12h' }
  );

  res.json({
    success: true,
    data: {
      token: posToken,
      staff: {
        _id:            user._id,
        firstName:      user.firstName,
        lastName:       user.lastName,
        posName:        user.posName,
        role:           user.role,
        posPermissions: user.posPermissions,
        avatar:         user.avatar,
      },
      tenant: {
        _id:          tenant._id,
        slug:         tenant.slug,
        name:         tenant.name,
        primaryColor: tenant.primaryColor,
        logo:         tenant.logo,
      },
    },
  });
});

// ─── List POS Staff (for login grid) ─────────────────────────────────────────
/**
 * GET /api/pos/staff?tenantSlug=xxx
 * Public — returns staff list for the login grid (no sensitive data)
 */
exports.listPOSStaff = asyncHandler(async (req, res) => {
  const { tenantSlug } = req.query;
  if (!tenantSlug) return res.status(400).json({ success: false, message: 'tenantSlug required' });

  const tenant = await Tenant.findOne({ slug: tenantSlug, isActive: true });
  if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found' });

  const staff = await User.find({
    tenant:    tenant._id,
    posAccess: true,
    status:    'active',
  }).select('firstName lastName posName role avatar posPinHash posPermissions').lean();

  // Only return whether they have a PIN set, not the hash
  const safeStaff = staff.map(s => {
    const perms = s.posPermissions || [];
    const canRetail    = perms.includes('pos:terminal:retail');
    const canWholesale = perms.includes('pos:terminal:wholesale');
    // Backwards compat: if no terminal permissions explicitly set, allow all
    const hasTerminalPerms = perms.some(p => p.startsWith('pos:terminal:'));
    return {
      _id:       s._id,
      firstName: s.firstName,
      lastName:  s.lastName,
      posName:   s.posName,
      role:      s.role,
      avatar:    s.avatar,
      hasPin:    !!s.posPinHash,
      terminalPermissions: hasTerminalPerms
        ? { retail: canRetail, wholesale: canWholesale }
        : { retail: true, wholesale: true },
    };
  });

  res.json({
    success: true,
    data: {
      staff: safeStaff,
      tenant: {
        _id:          tenant._id,
        slug:         tenant.slug,
        name:         tenant.name,
        primaryColor: tenant.primaryColor,
        logo:         tenant.logo,
      },
    },
  });
});

// ─── Get POS Products (with cache headers) ───────────────────────────────────
/**
 * GET /api/pos/products
 * Returns products optimised for POS display with ETag caching
 */
exports.getPOSProducts = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const tenant   = req.tenant;
  const { search, category, limit = 200 } = req.query;

  // 'low_stock' and 'out_of_stock' still show (greyed out) so cashiers know
  // what exists; 'discontinued', 'hidden', 'archived', 'draft', 'pending' are excluded.
  const POS_STATUSES = ['active', 'low_stock', 'out_of_stock'];

  const query = {
    tenant:       tenantId,
    visibleInPOS: true,
    status:       { $in: POS_STATUSES },
  };

  // NOTE: product.type is on the populated Product ref, not on SubProduct itself.
  // Category and search filters are applied post-populate in JS below.

  const subProducts = await SubProduct.find(query)
    .select([
      'sku', 'product', 'tenant', 'vendor',
      'baseSellingPrice', 'costPrice',
      'isOnSale', 'saleType', 'saleStartDate', 'saleEndDate', 'saleDiscountValue',
      'availableStock', 'totalStock', 'stockStatus', 'status',
      'sellWithoutSizeVariants', 'defaultSize', 'sizes',
      'visibleInPOS', 'isFeaturedByTenant',
    ].join(' '))
    .populate({
      path:     'product',
      // platformMarkup and platformDiscount are needed for the pricing pipeline
      select:   'name images type brand platformMarkup platformDiscount',
      populate: { path: 'brand', select: 'name' },
    })
    .populate('sizes', 'displayName sellingPrice costPrice availableStock stock _id sku')
    .populate({ path: 'vendor', select: 'firstName lastName email posName', strictPopulate: false })
    .sort({ isFeaturedByTenant: -1, totalSold: -1, availableStock: -1 })
    .limit(Number(limit))
    .lean();

  // Inject computed platform selling prices so the client never sees raw 0-values
  const enriched = subProducts.map((sp) => {
    // No-size price (used when sellWithoutSizeVariants or as a fallback)
    const basePrice = computePOSPrice(sp, null, tenant);

    const enrichedSizes = (sp.sizes || []).filter(Boolean).map((size) => ({
      ...size,
      // Compute per-size price; if size has no own costPrice/sellingPrice it falls back to sp values
      sellingPrice: computePOSPrice(sp, size, tenant),
    }));

    return {
      ...sp,
      baseSellingPrice: basePrice,
      // Expose whether the product is on sale (discount was already baked into price above)
      isOnSale: !!(sp.isOnSale && sp.saleDiscountValue > 0),
      sizes: enrichedSizes,
    };
  });

  // Post-populate filtering (product.type and search cannot be done in the Mongoose query)
  const filtered = enriched.filter((sp) => {
    if (category && sp.product?.type !== category) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        sp.product?.name?.toLowerCase().includes(q) ||
        sp.sku?.toLowerCase().includes(q) ||
        sp.product?.brand?.name?.toLowerCase().includes(q) ||
        sp.sizes?.some((s) => s.displayName?.toLowerCase().includes(q))
      );
    }
    return true;
  });

  res.set('Cache-Control', 'private, max-age=60');
  res.json({ success: true, data: { products: filtered, total: filtered.length } });
});

// ─── Create POS Order (with atomic stock deduction) ──────────────────────────
/**
 * POST /api/pos/orders
 * Body: { items, customer, paymentMethod, amountTendered, splitPayments, discount, note, sessionId }
 * Atomic stock deduction with $gte guard to prevent overselling.
 */
exports.createPOSOrder = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const staffId  = req.posUser._id;

  const {
    items,            // [{ subProductId, sizeId?, quantity, price, discount? }]
    customer = {},
    paymentMethod,    // 'cash' | 'card' | 'bank_transfer' | 'mobile_money' | 'split'
    amountTendered = 0,
    splitPayments = [],
    discountType,     // 'percent' | 'fixed'
    discountValue = 0,
    note = '',
    sessionId,
    priceOverrides = {}, // { subProductId+sizeId key: newPrice } — requires pos:price_override
  } = req.body;

  if (!items?.length) return res.status(400).json({ success: false, message: 'No items in order' });
  if (!paymentMethod)  return res.status(400).json({ success: false, message: 'Payment method required' });

  // Check price override permission
  const hasOverrides = Object.keys(priceOverrides).length > 0;
  if (hasOverrides && !req.posPermissions.includes('pos:price_override')) {
    return res.status(403).json({ success: false, message: 'Price override permission required' });
  }

  // Atomic stock deduction — one item at a time
  const deductedItems = [];
  const orderItems = [];

  try {
    for (const item of items) {
      const { subProductId, sizeId, quantity } = item;
      if (!quantity || quantity < 1) continue;

      let deductedSize = null;

      if (sizeId) {
        // Size-specific stock deduction
        deductedSize = await Size.findOneAndUpdate(
          { _id: sizeId, availableStock: { $gte: quantity } },
          { $inc: { availableStock: -quantity, stock: -quantity } },
          { new: true }
        );
        if (!deductedSize) {
          throw new Error(`Insufficient stock for item (size not available)`);
        }
        deductedItems.push({ type: 'size', id: sizeId, quantity });
      } else {
        // Top-level subproduct stock
        const spStock = await SubProduct.findOneAndUpdate(
          { _id: subProductId, availableStock: { $gte: quantity } },
          { $inc: { availableStock: -quantity, totalStock: -quantity } },
          { new: true }
        );
        if (!spStock) {
          throw new Error(`Insufficient stock for item`);
        }
        deductedItems.push({ type: 'subproduct', id: subProductId, quantity });
      }

      // Fetch subproduct for price resolution and order line data
      const sp = await SubProduct.findById(subProductId)
        .select('product sku baseSellingPrice costPrice isOnSale saleType saleStartDate saleEndDate saleDiscountValue')
        .populate('product', 'name images platformMarkup platformDiscount')
        .lean();

      // Server-side price: run through same pipeline as the website / cart
      const pricing     = computePOSPricing(sp, deductedSize, req.tenant);
      const overrideKey = sizeId ? `${subProductId}_${sizeId}` : subProductId;
      const finalPrice  = hasOverrides && priceOverrides[overrideKey] != null
        ? Number(priceOverrides[overrideKey])
        : pricing.sellingPrice;

      // Compute per-line revenue fields required by Order schema
      const itemDiscountPct    = Math.max(0, Math.min(100, item.discount || 0));
      const lineGross          = finalPrice * quantity;
      const itemDiscountAmount = parseFloat((lineGross * itemDiscountPct / 100).toFixed(2));
      const lineSubtotal       = parseFloat((lineGross - itemDiscountAmount).toFixed(2));

      const tenantRevShare = pricing.revenueModel === 'commission'
        ? parseFloat((lineSubtotal * (1 - pricing.commissionPct / 100)).toFixed(2))
        : parseFloat((pricing.costPrice * quantity).toFixed(2));

      orderItems.push({
        product:               sp?.product?._id || subProductId,
        subproduct:            subProductId,
        size:                  sizeId || undefined,
        quantity,
        priceAtPurchase:       finalPrice,
        itemSubtotal:          lineSubtotal,
        discountAmount:        itemDiscountAmount,
        vendorPriceAtPurchase: pricing.costPrice,
        tenantRevenueShare:    tenantRevShare,
        platformCommission:    parseFloat((lineSubtotal - tenantRevShare).toFixed(2)),
        tenantRevenueModel:    pricing.revenueModel,
        revenueRateAtPurchase: pricing.revenueModel === 'commission' ? pricing.commissionPct : pricing.markupPct,
        tenant:                tenantId,
        // Display fields for receipt (not persisted — schema strips unknown fields)
        _name:    sp?.product?.name || 'Product',
        _variant: item.variant || '',
        _sku:     item.sku || sp?.sku || '',
      });
    }
  } catch (stockErr) {
    // Rollback already-deducted stock
    for (const d of deductedItems) {
      if (d.type === 'size') {
        await Size.findByIdAndUpdate(d.id, { $inc: { availableStock: d.quantity, stock: d.quantity } });
      } else {
        await SubProduct.findByIdAndUpdate(d.id, { $inc: { availableStock: d.quantity, totalStock: d.quantity } });
      }
    }
    return res.status(409).json({ success: false, message: stockErr.message });
  }

  // Compute totals — itemSubtotal already has item-level discount applied
  const subtotal = orderItems.reduce((s, it) => s + it.itemSubtotal, 0);

  let orderDiscountAmount = 0;
  if (discountValue > 0) {
    orderDiscountAmount = discountType === 'fixed'
      ? Math.min(discountValue, subtotal)
      : subtotal * discountValue / 100;
  }
  const total = Math.max(0, subtotal - orderDiscountAmount);

  // Generate order + receipt numbers
  const orderNumber   = await generateOrderNumber();
  const receiptNumber = await generateReceiptNumber();

  // Determine active session — prefer the caller's terminal type
  const orderTerminal = ['retail', 'wholesale'].includes(req.body.terminalType)
    ? req.body.terminalType
    : 'retail';

  let session = null;
  if (sessionId) {
    session = await POSSession.findOne({ _id: sessionId, tenant: tenantId, status: 'open' });
  }
  if (!session) {
    session = await POSSession.findOne({ tenant: tenantId, status: 'open', terminalType: orderTerminal })
      .sort({ openedAt: -1 });
  }

  const order = await Order.create({
    orderNumber,                          // required unique string
    tenant:        tenantId,
    source:        'pos',
    receiptNumber,
    posSessionId:  session?._id || null,
    posStaff:      staffId,
    items:         orderItems,
    subtotal,
    shippingFee:   0,
    totalAmount:   total,                 // schema field is totalAmount
    discountTotal: orderDiscountAmount || 0,
    paymentMethod,
    paymentStatus: 'paid',
    paymentDetails: {
      reference: receiptNumber,
      paidAt:    new Date().toISOString(),
      channel:   'pos',
      // Snapshot customer info for receipt/history display
      customer: {
        firstName: customer.firstName || 'Walk-in',
        lastName:  customer.lastName  || 'Customer',
        phone:     customer.phone     || '',
      },
      ...(paymentMethod === 'cash'  && { amount: amountTendered, change: Math.max(0, amountTendered - total) }),
      ...(paymentMethod === 'split' && { splitPayments }),
    },
    status:                  'confirmed',
    ageVerifiedAtOrderTime:  true,
    placedAt:                new Date(),
  });

  // Update session stats atomically
  if (session) {
    const sessionInc = {
      orderCount: 1,
      totalSales: total,
      ...(paymentMethod === 'cash'          && { cashSales:        total }),
      ...(paymentMethod === 'card'          && { cardSales:        total }),
      ...(paymentMethod === 'bank_transfer' && { transferSales:    total }),
      ...(paymentMethod === 'mobile_money'  && { mobileMoneySales: total }),
    };
    // For split payments, distribute sales across methods
    if (paymentMethod === 'split' && splitPayments?.length) {
      for (const sp of splitPayments) {
        if (sp.method === 'cash')          sessionInc.cashSales        = (sessionInc.cashSales        || 0) + sp.amount;
        if (sp.method === 'card')          sessionInc.cardSales        = (sessionInc.cardSales        || 0) + sp.amount;
        if (sp.method === 'bank_transfer') sessionInc.transferSales    = (sessionInc.transferSales    || 0) + sp.amount;
        if (sp.method === 'mobile_money')  sessionInc.mobileMoneySales = (sessionInc.mobileMoneySales || 0) + sp.amount;
      }
      delete sessionInc.cashSales; // prevent double-count on non-split path
      // Recalculate from split totals only
      const splitTotals = {};
      for (const sp of splitPayments) {
        if (sp.method === 'cash')          splitTotals.cashSales        = (splitTotals.cashSales        || 0) + sp.amount;
        if (sp.method === 'card')          splitTotals.cardSales        = (splitTotals.cardSales        || 0) + sp.amount;
        if (sp.method === 'bank_transfer') splitTotals.transferSales    = (splitTotals.transferSales    || 0) + sp.amount;
        if (sp.method === 'mobile_money')  splitTotals.mobileMoneySales = (splitTotals.mobileMoneySales || 0) + sp.amount;
      }
      Object.assign(sessionInc, splitTotals);
    }
    // Update theoretical balances for each payment method
    const methodUpdates = {};
    const effectivePayments = paymentMethod === 'split'
      ? splitPayments
      : [{ method: paymentMethod, amount: total }];
    for (const ep of effectivePayments) {
      methodUpdates[`methodBalances.$[el_${ep.method}].theoretical`] = ep.amount;
    }
    await POSSession.findByIdAndUpdate(
      session._id,
      { $inc: sessionInc }
    );
    // Update theoretical per-method balance individually
    for (const ep of effectivePayments) {
      await POSSession.findOneAndUpdate(
        { _id: session._id, 'methodBalances.method': ep.method },
        { $inc: { 'methodBalances.$.theoretical': ep.amount } }
      );
    }
  }

  // Build receipt-friendly items (merge schema fields with display-only fields)
  const receiptItems = orderItems.map((it) => ({
    name:            it._name,
    variant:         it._variant,
    sku:             it._sku,
    quantity:        it.quantity,
    priceAtPurchase: it.priceAtPurchase,
    itemSubtotal:    it.itemSubtotal,
    discountAmount:  it.discountAmount,
  }));

  res.status(201).json({
    success: true,
    data: {
      order: {
        _id:           order._id,
        orderNumber:   order.orderNumber,
        receiptNumber: order.receiptNumber,
        total:         order.totalAmount,
        subtotal:      subtotal,
        discountTotal: orderDiscountAmount || 0,
        paymentMethod: order.paymentMethod,
        splitPayments: paymentMethod === 'split' ? splitPayments : undefined,
        amountTendered: paymentMethod === 'cash' ? amountTendered : undefined,
        change:        paymentMethod === 'cash' ? Math.max(0, amountTendered - total) : 0,
        items:         receiptItems,
        note:          note || '',
        placedAt:      order.placedAt,
        posStaff:      staffId,
      },
    },
  });
});

// ─── Refund (item-level) ──────────────────────────────────────────────────────
/**
 * POST /api/pos/orders/:id/refund
 * Body: { items: [{ orderItemIndex, quantity, discPct, unitPrice, restock, reason }], reason, refundPaymentMethod }
 * Requires: pos:refund permission
 * Optionally restores stock, creates RTN-YYYYMMDD-XXXX record
 */
exports.refundPOSOrder = asyncHandler(async (req, res) => {
  const { items: refundItems = [], reason = '', refundPaymentMethod } = req.body;
  if (!refundItems.length) return res.status(400).json({ success: false, message: 'No items to refund' });

  const order = await Order.findOne({ _id: req.params.id, 'items.tenant': req.tenant?._id });
  if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
  if (order.isVoided) return res.status(400).json({ success: false, message: 'Cannot refund a voided order' });

  // Build a map of already-refunded qty per item index to prevent double-refund
  const alreadyRefunded = {};
  for (const refund of order.refunds) {
    for (const line of refund.items) {
      const idx = line.orderItemIndex;
      if (idx != null) alreadyRefunded[idx] = (alreadyRefunded[idx] || 0) + (line.quantity || 0);
    }
  }

  const returnNumber = await generateReturnNumber();
  let   totalRefunded = 0;
  const refundLines   = [];
  const errors        = [];

  for (const ri of refundItems) {
    const { orderItemIndex, quantity, discPct = 0, unitPrice: overridePrice, restock = true, reason: lineReason } = ri;
    const orderItem = order.items[orderItemIndex];
    if (!orderItem) { errors.push(`Item at index ${orderItemIndex} not found`); continue; }

    // Check quantity is valid
    const alreadyQty  = alreadyRefunded[orderItemIndex] || 0;
    const maxRefundQty = orderItem.quantity - alreadyQty;
    if (quantity < 1) { errors.push(`Quantity must be at least 1`); continue; }
    if (quantity > maxRefundQty) {
      errors.push(
        `Cannot refund ${quantity} of "${orderItem.product?.name || 'item'}" — only ${maxRefundQty} unit(s) remain refundable`
      );
      continue;
    }

    // Validate discount %
    const safeDiscPct = Math.min(Math.max(0, Number(discPct) || 0), 100);

    // Resolve per-unit refund price:
    //   1. Use override if cashier has pos:price_override permission
    //   2. Otherwise use the original purchase price
    const hasPriceOverride = req.posPermissions?.includes('pos:price_override');
    const baseUnitPrice    = orderItem.priceAtPurchase ?? 0;
    const refundUnitPrice  = (hasPriceOverride && overridePrice > 0)
      ? Number(overridePrice)
      : baseUnitPrice;

    // Refund amount = unit price × qty × (1 − disc%)
    const lineAmount = parseFloat((refundUnitPrice * quantity * (1 - safeDiscPct / 100)).toFixed(2));
    totalRefunded   += lineAmount;

    // Restore stock only if restock flag is true (Odoo-style: cashier controls this)
    if (restock !== false) {
      if (orderItem.size) {
        await Size.findByIdAndUpdate(orderItem.size, { $inc: { availableStock: quantity, stock: quantity } });
      } else if (orderItem.subproduct) {
        await SubProduct.findByIdAndUpdate(orderItem.subproduct, { $inc: { availableStock: quantity, totalStock: quantity } });
      }
    }

    refundLines.push({
      orderItemIndex,
      quantity,
      unitPrice: refundUnitPrice,
      discPct:   safeDiscPct,
      amount:    lineAmount,
      restock:   restock !== false,
      reason:    lineReason || undefined,
    });
  }

  if (errors.length && refundLines.length === 0) {
    return res.status(400).json({ success: false, message: errors.join('; ') });
  }

  // Record the refund
  order.refunds.push({
    receiptNumber: returnNumber,
    items:         refundLines,
    totalRefunded: parseFloat(totalRefunded.toFixed(2)),
    reason,
    refundedBy:    req.posUser._id,
    refundedAt:    new Date(),
    paymentMethod: refundPaymentMethod || undefined,
  });

  // Update payment status based on cumulative refund vs original total
  const cumulativeRefunded = order.refunds.reduce((s, r) => s + (r.totalRefunded || 0), 0);
  if (cumulativeRefunded >= order.totalAmount) {
    order.paymentStatus = 'refunded';
    order.status        = 'refunded';
  } else if (cumulativeRefunded > 0) {
    order.paymentStatus = 'partially_refunded';
  }

  await order.save();

  const refundRecord = order.refunds[order.refunds.length - 1];

  res.json({
    success: true,
    data: {
      returnNumber,
      totalRefunded:     parseFloat(totalRefunded.toFixed(2)),
      cumulativeRefunded: parseFloat(cumulativeRefunded.toFixed(2)),
      paymentStatus:     order.paymentStatus,
      refundLines,
      refundRecord: {
        receiptNumber: refundRecord.receiptNumber,
        items:         refundRecord.items,
        totalRefunded: refundRecord.totalRefunded,
        reason:        refundRecord.reason,
        refundedAt:    refundRecord.refundedAt,
        paymentMethod: refundRecord.paymentMethod,
      },
      warnings:          errors.length ? errors : undefined,
      order: { _id: order._id, receiptNumber: order.receiptNumber },
    },
  });
});

// ─── Void entire sale ─────────────────────────────────────────────────────────
/**
 * POST /api/pos/orders/:id/void
 * Body: { reason }
 * Requires: pos:void permission
 * Restores all stock, marks order as voided
 */
exports.voidPOSOrder = asyncHandler(async (req, res) => {
  const { reason = '' } = req.body;
  const order = await Order.findOne({ _id: req.params.id, 'items.tenant': req.tenant?._id });
  if (!order)          return res.status(404).json({ success: false, message: 'Order not found' });
  if (order.isVoided)  return res.status(400).json({ success: false, message: 'Already voided' });

  // Restore all stock (schema fields: size / subproduct — lowercase)
  for (const item of order.items) {
    if (item.size) {
      await Size.findByIdAndUpdate(item.size, {
        $inc: { availableStock: item.quantity, stock: item.quantity },
      });
    } else if (item.subproduct) {
      await SubProduct.findByIdAndUpdate(item.subproduct, {
        $inc: { availableStock: item.quantity, totalStock: item.quantity },
      });
    }
  }

  order.isVoided  = true;
  order.voidedAt  = new Date();
  order.voidedBy  = req.posUser._id;
  order.voidReason = reason;
  order.paymentStatus = 'refunded';
  order.status    = 'cancelled';
  await order.save();

  res.json({ success: true, data: { order: { _id: order._id, receiptNumber: order.receiptNumber, isVoided: true } } });
});

// ─── Get POS Session Orders ───────────────────────────────────────────────────
/**
 * GET /api/pos/sessions/:id/orders
 */
/**
 * GET /api/pos/session-info
 * POS-token protected — returns current session info for the cashier's tenant.
 * Also returns the last closed session for balance display.
 */
exports.getPOSSessionInfo = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;

  const terminalType = ['retail', 'wholesale'].includes(req.query.terminalType)
    ? req.query.terminalType
    : 'retail';

  const [openSession, lastClosed] = await Promise.all([
    POSSession.findOne({ tenant: tenantId, status: 'open', terminalType })
      .populate('openedBy activeCashier', 'firstName lastName posName avatar')
      .lean(),
    POSSession.findOne({ tenant: tenantId, status: 'closed', terminalType })
      .sort({ closedAt: -1 })
      .select('closedAt totalSales orderCount closedBy')
      .populate('closedBy', 'firstName lastName posName')
      .lean(),
  ]);

  res.json({
    success: true,
    data: {
      currentSession: openSession || null,
      lastSession:    lastClosed  || null,
    },
  });
});

exports.getPOSSessionOrders = asyncHandler(async (req, res) => {
  // Verify the session belongs to this tenant before returning its orders
  const session = await POSSession.findOne({ _id: req.params.id, tenant: req.tenant?._id });
  if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

  const orders = await Order.find({ posSessionId: req.params.id })
    .select('orderNumber receiptNumber totalAmount paymentMethod paymentStatus status placedAt createdAt posStaff isVoided refunds items paymentDetails')
    .populate('posStaff', 'firstName lastName posName')
    .populate('items.product', 'name')
    .populate('items.size',    'displayName')
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();

  // Normalise for client: totalAmount → total, build display items from populated refs
  const mapped = orders.map((o) => ({
    ...o,
    total:    o.totalAmount,
    customer: o.paymentDetails?.customer || null,
    items: (o.items || []).map((it) => ({
      name:            it.product?.name || 'Product',
      variant:         it.size?.displayName || '',
      quantity:        it.quantity,
      priceAtPurchase: it.priceAtPurchase,
      itemSubtotal:    it.itemSubtotal,
      discountAmount:  it.discountAmount || 0,
    })),
  }));

  res.json({ success: true, data: mapped });
});
