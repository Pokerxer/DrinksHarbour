const POSSession = require('../../models/POSSession');
const User = require('../../models/User');
const asyncHandler = require('../../utils/asyncHandler');
const { emitToTerminal } = require('../../services/pos.realtime');
const { shopFilter } = require('../../services/posShopScope.service');
const { getSessionOrderStats } = require('../../services/posSessionTotals.service');

exports.recordCashMove = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const session  = await POSSession.findOne({ _id: req.params.id, ...shopFilter(req), tenant: tenantId, status: 'open' });
  if (!session) return res.status(404).json({ success: false, message: 'Session not found or not open' });

  const { type, amount, reason = '' } = req.body;

  if (!['in', 'out'].includes(type)) {
    return res.status(400).json({ success: false, message: "type must be 'in' or 'out'" });
  }
  const num = Number(amount);
  if (!num || num <= 0) {
    return res.status(400).json({ success: false, message: 'amount must be a positive number' });
  }

  // Prevent cash-out exceeding current theoretical cash balance
  if (type === 'out') {
    const movements   = session.cashMovements || [];
    const totalCashIn  = movements.filter(m => m.type === 'in').reduce((s, m) => s + m.amount, 0);
    const totalCashOut = movements.filter(m => m.type === 'out').reduce((s, m) => s + m.amount, 0);
    const netMoves     = totalCashIn - totalCashOut;
    // Get cash sales from orders in this session
    const stats = await getSessionOrderStats(tenantId, session._id);
    const cashAvailable = session.openingCash + (stats.breakdown?.cash?.total || 0) + netMoves;
    if (num > cashAvailable) {
      return res.status(400).json({
        success: false,
        message: `Insufficient cash. Available: ${cashAvailable.toFixed(2)}`,
      });
    }
  }

  const movement = {
    type,
    amount: parseFloat(num.toFixed(2)),
    reason: reason.trim(),
    performedBy: req.posUser._id,
    performedAt: new Date(),
  };

  session.cashMovements.push(movement);

  // Also update methodBalances theoretical for cash if session already has methodBalances
  if (session.methodBalances?.length) {
    const cashBalance = session.methodBalances.find(m => m.method === 'cash');
    if (cashBalance) {
      cashBalance.theoretical += type === 'in' ? num : -num;
    }
  }

  await session.save();
  await session.populate('cashMovements.performedBy', 'firstName lastName posName');

  const added = session.cashMovements[session.cashMovements.length - 1];

  res.status(201).json({
    success: true,
    data: {
      movement: added,
      cashMovements: session.cashMovements,
    },
  });
});

exports.getCashMoves = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const session  = await POSSession.findOne({ _id: req.params.id, ...shopFilter(req), tenant: tenantId })
    .populate('cashMovements.performedBy', 'firstName lastName posName')
    .select('cashMovements status');
  if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

  res.json({ success: true, data: { cashMovements: session.cashMovements || [] } });
});
