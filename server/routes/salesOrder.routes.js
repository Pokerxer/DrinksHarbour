// routes/salesOrder.routes.js
const express = require('express');
const router = express.Router();
const {
  createSalesOrder, getSalesOrders, getSalesOrder, updateSalesOrder, deleteSalesOrder,
  sendQuotation, acceptQuotation, rejectQuotation, convertQuotation, confirmSalesOrder,
  fulfillSalesOrder,
} = require('../controllers/salesOrder.controller');
const { protect, attachTenant } = require('../middleware/auth.middleware');

router.use(protect, attachTenant);

router.route('/').get(getSalesOrders).post(createSalesOrder);
router.route('/:id').get(getSalesOrder).put(updateSalesOrder).delete(deleteSalesOrder);

router.post('/:id/send', sendQuotation);
router.post('/:id/accept', acceptQuotation);
router.post('/:id/reject', rejectQuotation);
router.post('/:id/convert', convertQuotation);
router.post('/:id/confirm', confirmSalesOrder);
router.post('/:id/fulfill', fulfillSalesOrder);

module.exports = router;
