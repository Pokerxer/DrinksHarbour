const express    = require('express');
const router     = express.Router();
const { autocomplete, details, reverse, mapsScript } = require('../controllers/places.controller');

router.get('/autocomplete', autocomplete);
router.get('/details',      details);
router.get('/reverse',      reverse);
router.get('/maps-script',  mapsScript);

module.exports = router;
