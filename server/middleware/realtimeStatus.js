'use strict';

module.exports = function realtimeStatus(req, res) {
  res.set('Cache-Control', 'no-store');
  res.json({ available: Boolean(req.app.get('io')) });
};
