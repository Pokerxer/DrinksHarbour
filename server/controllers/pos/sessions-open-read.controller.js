const POSSession = require('../../models/POSSession');
const asyncHandler = require('../../utils/asyncHandler');
const { emitToTerminal } = require('../../services/pos.realtime');
const { shopFilter, resolveOpeningShop, assertNoLegacyDrawer } = require('../../services/posShopScope.service');

exports.openSession = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant required' });

  const { openingCash = 0, notes = '' } = req.body;
  const shop = await resolveOpeningShop(req);
  const terminal = shop.terminalType;
  await assertNoLegacyDrawer(tenantId);

  const existing = await POSSession.findOne({ tenant: tenantId, status: 'open', shopId: shop.shopId });
  if (existing) {
    return res.status(409).json({
      success: false,
      message: `A ${terminal} session is already open`,
      data: { session: existing },
    });
  }
  const cashAmount = Math.max(0, Number(openingCash) || 0);

  const now = new Date();

  let session;
  try { session = await POSSession.create({
    ...shop,
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

  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ success: false, message: 'A session is already open for this shop.' });
    throw err;
  }
  await session.populate('openedBy activeCashier', 'firstName lastName email posName avatar');

  emitToTerminal(req, tenantId, shop.shopId, 'session:opened', {
    sessionId:  session._id,
    terminal,
    openedBy:   req.user._id,
    openedAt:   now.toISOString(),
  });

  res.status(201).json({ success: true, data: { session } });
});

exports.getCurrentSession = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const session  = await POSSession.findOne({ tenant: tenantId, ...shopFilter(req), status: 'open' })
    .populate('openedBy activeCashier', 'firstName lastName email posName avatar')
    .sort({ openedAt: -1 });

  res.json({ success: true, data: { session: session || null } });
});

exports.getSessionList = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const page     = Math.max(1, parseInt(req.query.page) || 1);
  const limit    = Math.min(50, parseInt(req.query.limit) || 20);
  const skip     = (page - 1) * limit;
  const status   = req.query.status;
  const dateFrom = req.query.dateFrom;
  const dateTo   = req.query.dateTo;

  const filter = { tenant: tenantId, ...shopFilter(req) };
  if (status === 'open' || status === 'closed') filter.status = status;
  if (dateFrom || dateTo) {
    filter.openedAt = {};
    if (dateFrom) filter.openedAt.$gte = new Date(dateFrom);
    if (dateTo)   filter.openedAt.$lte = new Date(new Date(dateTo).setHours(23, 59, 59, 999));
  }

  const [sessions, total] = await Promise.all([
    POSSession.find(filter)
      .populate('openedBy closedBy activeCashier', 'firstName lastName posName avatar')
      .populate({ path: 'cashierLog.cashier', select: 'firstName lastName posName', strictPopulate: false })
      .populate({ path: 'cashMovements.performedBy', select: 'firstName lastName posName', strictPopulate: false })
      .sort({ openedAt: -1 })
      .skip(skip)
      .limit(limit),
    POSSession.countDocuments(filter),
  ]);

  res.json({ success: true, data: { sessions, total, page, limit } });
});

exports.getPOSSessionInfo = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;

  const terminalType = ['retail', 'wholesale'].includes(req.query.terminalType)
    ? req.query.terminalType
    : 'retail';

  const [openSession, lastClosed] = await Promise.all([
    POSSession.findOne({ tenant: tenantId, ...shopFilter(req), status: 'open' })
      .populate('openedBy activeCashier', 'firstName lastName posName avatar')
      .lean(),
    POSSession.findOne({ tenant: tenantId, ...shopFilter(req), status: 'closed' })
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
