'use strict';
module.exports = function requestLogger(req, res, next) {
  if (process.env.NODE_ENV === 'development') {
    console.log(`\n🔵 ${req.method} ${req.originalUrl}`);
    console.log(`   Origin: ${req.headers.origin || 'No origin'}`);
  }
  next();
};
