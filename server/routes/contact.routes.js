// routes/contact.routes.js
const express = require('express');
const router = express.Router();
const c = require('../controllers/contact.controller');
const { protect, attachTenant, tenantAdminOrSuperAdmin } = require('../middleware/auth.middleware');

router.use(protect);
router.use(attachTenant);

router.route('/')
  .get(tenantAdminOrSuperAdmin, c.listContacts)
  .post(tenantAdminOrSuperAdmin, c.createContact);

// :source picks the model ('instore' = POSCustomer, 'ecommerce' = User customer).
router.route('/:source/:id')
  .get(tenantAdminOrSuperAdmin, c.getContact)
  .patch(tenantAdminOrSuperAdmin, c.updateContact)
  .delete(tenantAdminOrSuperAdmin, c.deleteContact);

router.get('/:source/:id/orders', tenantAdminOrSuperAdmin, c.listContactOrders);
router.get('/:source/:id/spending', tenantAdminOrSuperAdmin, c.getContactSpending);

// Wallet (stored value / store credit): read the ledger + balance, then admin
// top-up / adjust. Mutations are atomic and never overdraw — see the controller.
router.get('/:source/:id/wallet', tenantAdminOrSuperAdmin, c.getContactWallet);
router.post('/:source/:id/wallet/topup', tenantAdminOrSuperAdmin, c.topUpWallet);
router.post('/:source/:id/wallet/adjust', tenantAdminOrSuperAdmin, c.adjustWallet);

// Loyalty points (in-store only): read the ledger + balance, then admin award /
// adjust. Mutations are atomic and never overdraw — see the controller.
router.get('/:source/:id/loyalty', tenantAdminOrSuperAdmin, c.getContactLoyalty);
router.post('/:source/:id/loyalty/award', tenantAdminOrSuperAdmin, c.awardLoyalty);
router.post('/:source/:id/loyalty/adjust', tenantAdminOrSuperAdmin, c.adjustLoyalty);

module.exports = router;
