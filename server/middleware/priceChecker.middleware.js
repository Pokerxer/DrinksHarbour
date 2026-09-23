const Kiosk = require('../models/PriceCheckerKiosk');
const { verifySession } = require('../services/priceChecker/session');
const { loadContext } = require('../services/priceChecker/context');
const { UnauthorizedError } = require('../utils/errors');
async function authenticatePriceChecker(req, res, next) {
  try {
    const claims = verifySession(req.get('X-Price-Checker-Session'));
    const kiosk = await Kiosk.findOne({
      _id: claims.kiosk,
      version: claims.version,
      enabled: true,
    }).lean();
    if (!kiosk) throw new UnauthorizedError('Kiosk session expired.');
    req.priceChecker = await loadContext(kiosk);
    next();
  } catch (error) {
    next(error);
  }
}
module.exports = { authenticatePriceChecker };
