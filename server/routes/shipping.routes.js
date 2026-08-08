// routes/shipping.routes.js
const express = require('express');
const router = express.Router();
const { getShippingRate, getLGAs, getStates, getZones, getFirstOrderPerk } = require('../controllers/shipping.controller');
const { optionalProtect } = require('../middleware/auth.middleware');

// Quoting stays open to guests — optionalProtect only attaches req.user when a
// valid session cookie is present, which is what the first-purchase delivery
// waiver needs in order to know who is asking.
router.get('/calculate',        optionalProtect, getShippingRate);
router.get('/first-order-perk', optionalProtect, getFirstOrderPerk);
router.get('/lgas',      getLGAs);
router.get('/states',    getStates);
router.get('/zones',     getZones);

module.exports = router;
