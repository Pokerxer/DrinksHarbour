const POSSession = require('../../models/POSSession');
const User = require('../../models/User');
const bcrypt = require('bcryptjs');
const asyncHandler = require('../../utils/asyncHandler');
const { emitToTerminal } = require('../../services/pos.realtime');
const { shopFilter } = require('../../services/posShopScope.service');

exports.switchCashier = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const { pin }  = req.body;

  if (!pin) return res.status(400).json({ success: false, message: 'PIN required' });

  const session = await POSSession.findOne({ _id: req.params.id, ...shopFilter(req), tenant: tenantId, status: 'open' });
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

  emitToTerminal(req, tenantId, session.shopId || 'legacy', 'session:cashier_switched', {
    sessionId:   session._id,
    terminal:    session.terminalType,
    cashierId:   matchedUser._id,
    cashierName: matchedUser.posName || `${matchedUser.firstName} ${matchedUser.lastName}`.trim(),
    switchedAt:  now.toISOString(),
  });

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
