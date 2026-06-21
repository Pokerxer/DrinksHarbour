// routes/salesOrder.routes.js
const express = require('express');
const router = express.Router();
const {
  createSalesOrder, getSalesOrders, getSalesOrder, updateSalesOrder, deleteSalesOrder,
  sendQuotation, acceptQuotation, rejectQuotation, convertQuotation,
} = require('../controllers/salesOrder.controller');
const { protect, attachTenant } = require('../middleware/auth.middleware');

router.use(protect, attachTenant);

router.route('/').get(getSalesOrders).post(createSalesOrder);
router.route('/:id').get(getSalesOrder).put(updateSalesOrder).delete(deleteSalesOrder);

router.post('/:id/send', sendQuotation);
router.post('/:id/accept', acceptQuotation);
router.post('/:id/reject', rejectQuotation);
router.post('/:id/convert', convertQuotation);

module.exports = router;
