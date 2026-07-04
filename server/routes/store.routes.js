// routes/store.routes.js
//
// Public storefront directory used by the platform "vendors" pages.

const express = require('express');
const router = express.Router();
const storeController = require('../controllers/store.controller');

router.get('/', storeController.getStores);
router.get('/:slug', storeController.getStoreBySlug);

module.exports = router;
