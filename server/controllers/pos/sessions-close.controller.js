const POSSession = require('../../models/POSSession');
const asyncHandler = require('../../utils/asyncHandler');
const { emitToTerminal } = require('../../services/pos.realtime');
const { shopFilter } = require('../../services/posShopScope.service');
const { getSessionOrderStats } = require('../../services/posSessionTotals.service');
const PAYMENT_METHODS = ['cash', 'card', 'bank_transfer', 'mobile_money', 'split'];

exports.getClosingControl = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const session  = await POSSession.findOne({ _id: req.params.id, ...shopFilter(req), tenant: tenantId });
  if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
  if (session.status === 'closed') {
    return res.status(400).json({ success: false, message: 'Session already closed' });
  }

  // Re-calculate theoretical values from orders linked to this session
  const stats = await getSessionOrderStats(tenantId, session._id);

  // Net cash movements (in - out)
  const movements   = session.cashMovements || [];
  const totalCashIn  = movements.filter(m => m.type === 'in').reduce((s, m) => s + m.amount, 0);
  const totalCashOut = movements.filter(m => m.type === 'out').reduce((s, m) => s + m.amount, 0);
  const netCashMove  = totalCashIn - totalCashOut;

  const methods = PAYMENT_METHODS.filter(m => m !== 'split').map(method => {
    const orderTotal = stats.breakdown?.[method]?.total || 0;
    const orderCount = stats.breakdown?.[method]?.count || 0;
    // For cash: theoretical = opening + cash sales + net cash movements
    const theoretical = method === 'cash'
      ? session.openingCash + orderTotal + netCashMove
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
      sessionId:    session._id,
      openedAt:     session.openedAt,
      openingCash:  session.openingCash,
      totalSales:   stats.totalSales,
      orderCount:   stats.orderCount,
      totalTips:     stats.totalTips || 0,
      totalRounding: stats.totalRounding || 0,
      totalCashIn,
      totalCashOut,
      netCashMove,
      cashMovements: movements,
      methods,
    },
  });
});

exports.closeSession = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;

  // Atomically claim the session — only one close request wins.
  const session = await POSSession.findOneAndUpdate(
    { _id: req.params.id, ...shopFilter(req), tenant: tenantId, status: 'open' },
    { $set: { status: 'closed', closedBy: req.user._id, closedAt: new Date() } },
    { new: false }
  );

  if (!session) {
    // Either doesn't exist or already closed
    const exists = await POSSession.findOne({ _id: req.params.id, ...shopFilter(req), tenant: tenantId }).lean();
    if (!exists) return res.status(404).json({ success: false, message: 'Session not found' });
    return res.status(409).json({ success: false, message: 'Session already closed' });
  }

  const closedAt = new Date();

  // Final order stats
  const stats = await getSessionOrderStats(tenantId, session._id);

  // Net cash movements
  const movements    = session.cashMovements || [];
  const totalCashIn  = movements.filter(m => m.type === 'in').reduce((s, m) => s + m.amount, 0);
  const totalCashOut = movements.filter(m => m.type === 'out').reduce((s, m) => s + m.amount, 0);
  const netCashMove  = totalCashIn - totalCashOut;

  // Build methodBalances with theoretical + counted + difference
  const { countedBalances = [], closingNotes = '' } = req.body;
  const methodBalances = PAYMENT_METHODS.filter(m => m !== 'split').map(method => {
    const orderTotal = stats.breakdown?.[method]?.total || 0;
    const theoretical = method === 'cash'
      ? session.openingCash + orderTotal + netCashMove
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

  // Update with computed values (session is already closed, just enriching)
  await POSSession.findOneAndUpdate({ _id: session._id, tenant: tenantId }, {
    $set: {
      closingNotes,
      methodBalances,
      hasDifference,
      cashierLog: log,
      totalSales:       stats.totalSales,
      orderCount:       stats.orderCount,
      totalTips:        stats.totalTips     || 0,
      totalRounding:    stats.totalRounding || 0,
      cashSales:        stats.breakdown?.cash?.total        || 0,
      cardSales:        stats.breakdown?.card?.total        || 0,
      transferSales:    stats.breakdown?.bank_transfer?.total || 0,
      mobileMoneySales: stats.breakdown?.mobile_money?.total || 0,
      splitSales:       stats.breakdown?.split?.total       || 0,
      closingBalance:   (methodBalances.find(m => m.method === 'cash'))?.counted
        ?? (methodBalances.find(m => m.method === 'cash'))?.theoretical
        ?? 0,
    },
  });

  const updatedSession = await POSSession.findOne({ _id: session._id, tenant: tenantId })
    .populate('openedBy closedBy activeCashier', 'firstName lastName email posName');

  emitToTerminal(req, tenantId, session.shopId || 'legacy', 'session:closed', {
    sessionId: session._id,
    terminal:  session.terminalType,
    closedBy:  req.user._id,
    closedAt:  closedAt.toISOString(),
  });

  res.json({ success: true, data: { session: updatedSession, hasDifference } });
});
