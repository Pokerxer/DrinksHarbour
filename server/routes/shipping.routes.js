// routes/shipping.routes.js
const express = require('express');
const router = express.Router();
const { getShippingRate, getLGAs, getStates, getZones } = require('../controllers/shipping.controller');

router.get('/calculate', getShippingRate);
router.get('/lgas',      getLGAs);
router.get('/states',    getStates);
router.get('/zones',     getZones);

module.exports = router;
