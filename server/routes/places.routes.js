'use strict';

const express = require('express');
const router  = express.Router();
const { mapsScript, autocomplete, details, reverse } = require('../controllers/places.controller');

router.get('/maps-script', mapsScript);
router.get('/autocomplete', autocomplete);
router.get('/details', details);
router.get('/reverse', reverse);

module.exports = router;
