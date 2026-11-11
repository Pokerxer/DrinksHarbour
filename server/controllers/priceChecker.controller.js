const Kiosk = require('../models/PriceCheckerKiosk');
const { getTenantId } = require('../utils/tenantContext');
const { ValidationError, NotFoundError, ForbiddenError } = require('../utils/errors');
const { normalizeBarcode, id, scanOrigin, pairingSession } = require('../services/priceChecker/validation');
const { getKiosk, saveKiosk, options } = require('../services/priceChecker/configuration');
const { loadContext } = require('../services/priceChecker/context');
const { issueSession } = require('../services/priceChecker/session');
const { lookup } = require('../services/priceChecker/lookup');
const { publicConfig } = require('../services/priceChecker/serialization');
const { buildBook, buildSync } = require('../services/priceChecker/book');
const { logScan, scanRequestId } = require('../services/priceChecker/scans');
const { getAnalytics } = require('../services/priceChecker/analytics');
exports.session = async (req, res) => {
  const slug = req.body?.slug;
  if (typeof slug !== 'string' || slug.length > 120 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
    throw new ValidationError('Invalid kiosk.');
  const kiosk = await Kiosk.findOne({ slug, enabled: true }).lean();
  const context = await loadContext(kiosk);
  res.json({ success: true, token: issueSession(kiosk), data: publicConfig(context) });
};
exports.config = async (req, res) =>
  res.json({ success: true, data: publicConfig(req.priceChecker) });
exports.book = async (req, res) =>
  res.json({ success: true, data: await buildBook(req.priceChecker) });
exports.sync = async (req, res) => {
  if (
    !req.body ||
    Object.keys(req.body).some((key) => key !== 'scans')
  )
    throw new ValidationError('Invalid sync request.');
  res.json({ success: true, data: await buildSync(req.priceChecker, req.body) });
};
exports.scan = async (req, res) => {
  if (
    !req.body ||
    Object.keys(req.body).some((key) => !['barcode', 'requestId', 'origin', 'pairSession'].includes(key))
  )
    throw new ValidationError('Invalid scan.');
  const barcode = normalizeBarcode(req.body.barcode);
  const requestId = scanRequestId(req.body.requestId);
  const origin = scanOrigin(req.body.origin);
  const pairSession = pairingSession(req.body.pairSession);
  const context = req.priceChecker;
  if (origin === 'phone' && context.kiosk.settings?.enablePhoneScan === false) {
    throw new ForbiddenError('Phone scanning is disabled for this kiosk.');
  }
  const result = await lookup(context, barcode);
  const status = {
    UNKNOWN: 'NOT_FOUND',
    FOUND: 'FOUND',
    PRICE_UNAVAILABLE: 'PRICE_UNAVAILABLE',
  }[result.outcome] || 'UNAVAILABLE';
  const data = {
    found: result.outcome === 'FOUND',
    status,
    ...(result.product ? { product: result.product } : {}),
  };
  await logScan(context, barcode, requestId, result, origin);
  const io = req.app.get('io');
  if (origin === 'phone' && pairSession && io) {
    // Only the public scan fields are shared with the paired screen.
    io.to(`pkiosk:${pairSession}`).emit('kiosk:scan', data);
  }
  res.json({ success: true, data: { ...data, config: publicConfig(context) } });
};
exports.list = async (req, res) => {
  const rows = await Kiosk.find({ tenant: getTenantId(req) })
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();
  res.json({ success: true, data: rows });
};
exports.get = async (req, res) =>
  res.json({ success: true, data: await getKiosk(getTenantId(req), req.params.id) });
exports.create = async (req, res) =>
  res.status(201).json({ success: true, data: await saveKiosk(getTenantId(req), req.body) });
exports.update = async (req, res) =>
  res.json({ success: true, data: await saveKiosk(getTenantId(req), req.body, req.params.id) });
exports.remove = async (req, res) => {
  const result = await Kiosk.deleteOne({ _id: id(req.params.id), tenant: getTenantId(req) });
  if (!result.deletedCount) throw new NotFoundError('Kiosk not found.');
  res.json({ success: true });
};
exports.options = async (req, res) =>
  res.json({ success: true, data: await options(getTenantId(req)) });
exports.analytics = async (req, res) =>
  res.json({ success: true, data: await getAnalytics(getTenantId(req), req.query) });
