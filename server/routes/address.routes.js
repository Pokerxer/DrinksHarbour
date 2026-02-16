// routes/address.routes.js
const express = require('express');
const router = express.Router();
const addressController = require('../controllers/address.controller');
const { protect } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validation.middleware');
const { body, param } = require('express-validator');

// All routes require authentication
router.use(protect);

// Get all addresses for current user
router.get('/', addressController.getMyAddresses);

// Create new address
router.post('/', 
  [
    body('label').optional().trim().isLength({ max: 50 }),
    body('fullName').trim().isLength({ max: 100 }),
    body('phone').notEmpty().trim(),
    body('addressLine1').notEmpty().trim().isLength({ max: 200 }),
    body('addressLine2').optional().trim().isLength({ max: 200 }),
    body('city').notEmpty().trim().isLength({ max: 100 }),
    body('state').notEmpty().trim().isLength({ max: 100 }),
    body('country').optional().trim(),
    body('postalCode').optional().trim().isLength({ max: 20 }),
    body('landmark').optional().trim().isLength({ max: 150 }),
    body('additionalInstructions').optional().trim().isLength({ max: 300 }),
    body('isDefaultShipping').optional().isBoolean(),
    body('isDefaultBilling').optional().isBoolean(),
  ],
  validate,
  addressController.createAddress
);

// Update address
router.put('/:id',
  [
    param('id').isMongoId(),
    body('label').optional().trim().isLength({ max: 50 }),
    body('fullName').optional().trim().isLength({ max: 100 }),
    body('phone').optional().notEmpty().trim(),
    body('addressLine1').optional().notEmpty().trim().isLength({ max: 200 }),
    body('city').optional().notEmpty().trim().isLength({ max: 100 }),
    body('state').optional().notEmpty().trim().isLength({ max: 100 }),
  ],
  validate,
  addressController.updateAddress
);

// Delete address
router.delete('/:id',
  [param('id').isMongoId()],
  validate,
  addressController.deleteAddress
);

// Set default address
router.patch('/:id/default',
  [
    param('id').isMongoId(),
    body('type').isIn(['shipping', 'billing']),
  ],
  validate,
  addressController.setDefaultAddress
);

module.exports = router;
