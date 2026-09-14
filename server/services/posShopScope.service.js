const POSSession = require('../models/POSSession');
const { resolveShopWarehouse } = require('./posLocation.service');
const { ValidationError, ConflictError, ForbiddenError } = require('../utils/errors');

function selectedShop(req) {
  const body = req.body?.shopId;
  const query = req.query?.shopId;
  if (body && query && body !== query) throw new ValidationError('Conflicting POS shops.');
  const key = body ?? query ?? 'retail';
  if (typeof key !== 'string' || !key) throw new ValidationError('Select a POS shop.');
  return key;
}
function canReviewAll(req) {
  return ['tenant_owner', 'tenant_admin', 'admin', 'super_admin'].includes(req.user?.role) || !req.posUser;
}
function shopFilter(req) {
  const shopId = selectedShop(req);
  if (shopId === 'all' || shopId === 'legacy') {
    const legacyClose = shopId === 'legacy' && /\/sessions\/[^/]+\/(close|close-legacy|closing-control)$/.test(req.originalUrl?.split('?')[0] || '');
    if (shopId === 'all' && !canReviewAll(req)) throw new ForbiddenError('Back-office access required.');
    if (req.method && req.method !== 'GET' && !legacyClose) throw new ForbiddenError('Select an individual shop for this action.');
    return shopId === 'legacy' ? { shopId: null } : {};
  }
  // Historical shops remain readable even after their configuration is removed.
  if (shopId !== 'retail' && !/^[a-f\d]{24}$/i.test(shopId)) throw new ValidationError('Invalid POS shop.');
  return { shopId };
}
async function resolveOpeningShop(req) {
  const shopId = selectedShop(req);
  if (shopId === 'all' || shopId === 'legacy') throw new ValidationError('Select an active POS shop.');
  const warehouse = await resolveShopWarehouse(req.tenant, req.tenant._id, shopId);
  const shop = req.tenant.posSettings?.shops?.find(s => String(s._id) === shopId);
  return { shopId, shopName: shop?.name || 'Retail', warehouse, terminalType: shop?.mode === 'wholesale' ? 'wholesale' : 'retail' };
}
async function resolveSaleSession(req) {
  const scope = shopFilter(req);
  const session = await POSSession.findOne({ tenant: req.tenant._id, ...scope, status: 'open',
    ...(req.body?.sessionId ? { _id: req.body.sessionId } : {}) });
  if (!session) throw new ConflictError('An open session for this shop is required. Refresh the shop and open its session.');
  const shop = await resolveOpeningShop(req);
  if (session.warehouse && String(session.warehouse) !== String(shop.warehouse)) throw new ConflictError('The shop location changed. Close its existing session before selling.');
  return session;
}
async function assertNoLegacyDrawer(tenant) {
  if (await POSSession.findOne({ tenant, shopId: null, status: 'open' })) {
    throw new ConflictError('Close the unassigned legacy session in Sessions > Legacy before opening a shop drawer.');
  }
}
module.exports = { selectedShop, shopFilter, resolveOpeningShop, resolveSaleSession, assertNoLegacyDrawer };
