const { parseShoppingLocation } = require('../utils/shoppingLocation');
module.exports = function shoppingLocation(req, res, next) {
  try {
    res.vary('x-shopping-location');
    req.shoppingLocation = parseShoppingLocation(req.get('x-shopping-location'));
    if (req.shoppingLocation) {
      res.set('Cache-Control', 'private, no-store');
    }
    next();
  } catch (error) { next(error); }
};
