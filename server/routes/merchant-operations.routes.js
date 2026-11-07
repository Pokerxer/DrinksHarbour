'use strict';
const router = require('express').Router();
// Production and disposable HTTP fixtures share these authenticated mounts.
router.use('/merchant-orders', require('./merchantOrder.routes'));
router.use('/merchant-delivery', require('./merchantDelivery.routes'));
router.use('/merchant-local-dispatch',require('./merchantLocalDispatch.routes'));
router.use('/merchant-carrier', require('./merchantCarrier.routes'));
router.use('/platform-ops', require('./platformOps.routes'));
module.exports = router;
