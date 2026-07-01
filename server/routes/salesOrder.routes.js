// routes/salesOrder.routes.js
const express = require('express');
const router = express.Router();
const {
  createSalesOrder, getSalesOrders, getSalesOrder, updateSalesOrder, deleteSalesOrder,
  updatePrices,
  applyCoupon,
  sendQuotation, acceptQuotation, rejectQuotation, convertQuotation, confirmSalesOrder,
  fulfillSalesOrder, returnSalesOrder,
  duplicateSalesOrder, importSalesOrders,
  generatePaymentLink, accruedRevenueEntry, createProjectFromOrder,
  getActivities, createActivity, getCustomFields, createCustomField,
  sendOrderEmail, requestSignature,
  bulkMarkSent, bulkDuplicate, bulkDelete, bulkCancel,
  bulkCreateInvoice, bulkAccruedRevenue, bulkFollowers, bulkSendEmail,
} = require('../controllers/salesOrder.controller');
const { protect, attachTenant, tenantUserOnly } = require('../middleware/auth.middleware');

// Sales is a tenant back-office surface: authenticate, resolve tenant from the
// JWT authority, then require an owner/admin/staff role (super_admin/admin
// bypass for cross-tenant ops). Without tenantUserOnly, any authenticated user
// carrying a tenant claim — including end-user roles (member/customer) — could
// read, create, confirm, or fulfill this tenant's sales orders.
router.use(protect, attachTenant, tenantUserOnly);

router.route('/').get(getSalesOrders).post(createSalesOrder);
router.route('/:id').get(getSalesOrder).put(updateSalesOrder).delete(deleteSalesOrder);

router.post('/:id/send', sendQuotation);
router.post('/:id/accept', acceptQuotation);
router.post('/:id/reject', rejectQuotation);
router.post('/:id/convert', convertQuotation);
router.post('/:id/confirm', confirmSalesOrder);
router.post('/:id/update-prices', updatePrices);
router.post('/:id/coupon', applyCoupon);
router.post('/:id/fulfill', fulfillSalesOrder);
router.post('/:id/return', returnSalesOrder);

// Task 2: Duplicate
router.post('/:id/duplicate', duplicateSalesOrder);

// Task 3: Import CSV
router.post('/import', importSalesOrders);

// Task 4: Payment Link, Accrued Revenue, Create Project
router.post('/:id/payment-link', generatePaymentLink);
router.post('/:id/accrued-revenue', accruedRevenueEntry);
router.post('/:id/create-project', createProjectFromOrder);

// Task 5: Activities + Custom Fields
router.get('/:id/activities', getActivities);
router.post('/:id/activities', createActivity);
router.get('/custom-fields', getCustomFields);
router.post('/custom-fields', createCustomField);

// Task 6: Send Email + Request Signature
router.post('/:id/send-email', sendOrderEmail);
router.post('/:id/request-signature', requestSignature);

// Bulk actions
router.post('/bulk/mark-sent', bulkMarkSent);
router.post('/bulk/duplicate', bulkDuplicate);
router.post('/bulk/delete', bulkDelete);
router.post('/bulk/cancel', bulkCancel);
router.post('/bulk/create-invoice', bulkCreateInvoice);
router.post('/bulk/accrued-revenue', bulkAccruedRevenue);
router.post('/bulk/followers', bulkFollowers);
router.post('/bulk/send-email', bulkSendEmail);

module.exports = router;
