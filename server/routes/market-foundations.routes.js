'use strict';
const router = require('express').Router();
// Keep the production mount and HTTP test fixture on the same route bundle.
// Each management router supplies its own fresh authentication and scope checks.
router.use('/countries', require('./country.routes'));
router.use('/market-enrollments', require('./marketEnrollment.routes'));
router.use('/market-policies', require('./marketPolicy.routes'));
router.use('/sales-channels', require('./salesChannel.routes'));
module.exports = router;
