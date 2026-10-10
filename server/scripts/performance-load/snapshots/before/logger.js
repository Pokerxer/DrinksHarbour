'use strict';
module.exports = function requestLogger(req, res, next) {
  console.log(`\n🔵 ${req.method} ${req.originalUrl}`);
  console.log(`   Origin: ${req.headers.origin || 'No origin'}`);
  next();
};
