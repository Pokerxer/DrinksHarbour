'use strict';

const express = require('express');
const router  = express.Router();
const { getBannersByPlacement } = require('../controllers/banner.controller');

router.get('/placement/:placement', getBannersByPlacement);

module.exports = router;
