// routes/accounting.routes.js
//
// /api/accounting — tenant-scoped double-entry accounting (ERM feature).
// Chain: protect → attachTenant → requireOwnTenant → tenantAdminOrSuperAdmin
// → requirePlan('pro')  [Accounting is gated to Pro and above].

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/accounting.controller');
const arAp = require('../controllers/arAp.controller');
const {
  protect,
  attachTenant,
  tenantAdminOrSuperAdmin,
  requireOwnTenant,
} = require('../middleware/auth.middleware');
const { requirePlan } = require('../middleware/plan.middleware');

router.use(protect);
router.use(attachTenant);
// Tenant-owned financial data: JWT tenant only, no admin pivot.
router.use(requireOwnTenant);
router.use(tenantAdminOrSuperAdmin);
router.use(requirePlan('pro'));

// Static segments before :id
router.get('/journal-entries', ctrl.getJournalEntries);
router.post('/journal-entries', ctrl.createJournalEntry);
router.get('/journal-entries/:id', ctrl.getJournalEntry);
router.post('/journal-entries/:id/reverse', ctrl.reverseJournalEntry);
router.delete('/journal-entries/:id', ctrl.deleteJournalEntry);

router.get('/accounts', ctrl.getAccounts);
router.post('/accounts', ctrl.createAccount);
router.put('/accounts/:id', ctrl.updateAccount);
router.delete('/accounts/:id', ctrl.deleteAccount);

router.get('/reports/trial-balance', ctrl.getTrialBalance);
router.get('/reports/profit-loss', ctrl.getProfitLoss);
router.get('/reports/balance-sheet', ctrl.getBalanceSheet);
router.get('/reports/general-ledger', ctrl.getGeneralLedger);

router.get('/dashboard', ctrl.getDashboard);

// ── Customers / Vendors (AR/AP layer) ────────────────────────────────────────
// Static segments before any :id routes.
router.get('/receivables/summary', arAp.receivablesSummary);
router.get('/payables/summary', arAp.payablesSummary);
router.get('/receivables/invoices', arAp.listInvoices);
router.get('/payables/bills', arAp.listBills);

router.get('/credit-notes', arAp.listCreditNotes);
router.post('/credit-notes', arAp.createCreditNote);
router.post('/credit-notes/:id/cancel', arAp.cancelCreditNote);

router.get('/payments', arAp.listPayments); // ?side=customer|vendor
router.post('/payments', arAp.createPayment);
router.post('/payments/:id/cancel', arAp.cancelPayment);

router.get('/batch-payments', arAp.listBatches);
router.get('/batch-payments/unbatched', arAp.listUnbatched); // ?side=
router.post('/batch-payments', arAp.createBatch);
router.post('/batch-payments/:id/deposit', arAp.depositBatch);
router.post('/batch-payments/:id/cancel', arAp.cancelBatch);

router.get('/customers', arAp.listCustomers);
router.get('/vendors', arAp.listVendors);
router.get('/products', arAp.listProducts);

module.exports = router;
