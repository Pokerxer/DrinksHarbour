// routes/salesOrder.routes.js
const express = require('express');
const router = express.Router();
const {
  createSalesOrder, getSalesOrders, getSalesOrder, updateSalesOrder, deleteSalesOrder,
} = require('../controllers/salesOrder.controller');
const { protect, attachTenant } = require('../middleware/auth.middleware');

router.use(protect, attachTenant);

router.route('/').get(getSalesOrders).post(createSalesOrder);
router.route('/:id').get(getSalesOrder).put(updateSalesOrder).delete(deleteSalesOrder);

module.exports = router;
