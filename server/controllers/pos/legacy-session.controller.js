// Authentication runs first; this guard only permits reconciliation of unassigned drawers.
exports.authorizeLegacyClose = (req, res, next) => {
  const allowed = req.posUser
    ? req.posPermissions?.includes('pos:sell')
    : ['tenant_owner', 'tenant_admin', 'admin', 'super_admin'].includes(req.user?.role);
  if (!allowed || !req.tenant?._id) {
    return res.status(403).json({ success: false, message: 'Drawer reconciliation access required.' });
  }
  const body = req.body || {};
  const balances = body.countedBalances;
  const validCount = Array.isArray(balances) && balances.length === 1 &&
    balances[0]?.method === 'cash' && typeof balances[0].counted === 'number' &&
    Number.isFinite(balances[0].counted) && balances[0].counted >= 0;
  if (body.shopId !== 'legacy' || (req.query?.shopId !== undefined && req.query.shopId !== 'legacy') || !validCount) {
    return res.status(400).json({ success: false, message: 'Select Legacy and enter the actual counted cash.' });
  }
  next();
};
