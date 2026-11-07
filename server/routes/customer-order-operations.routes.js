'use strict';
// Shared production/test mount; customer ownership stays inside the read router.
const router = require('express').Router();
router.use('/customer-shipments', require('./customerShipment.routes'));
module.exports = router;
