const mongoose = require('mongoose');

const POSCustomerSchema = new mongoose.Schema(
  {
    tenant:        { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    firstName:     { type: String, required: true, trim: true },
    lastName:      { type: String, default: '', trim: true },
    email:         { type: String, default: '', trim: true, lowercase: true },
    phone:         { type: String, default: '', trim: true },
    avatar:        { url: String, publicId: String },
    loyaltyPoints: { type: Number, default: 0, min: 0 },
    // Authoritative stored-value wallet balance (NGN). Mutated only alongside an
    // appended WalletTransaction; guarded so it never goes negative.
    walletBalance: { type: Number, default: 0, min: 0 },
    totalSpent:    { type: Number, default: 0 },
    totalOrders:   { type: Number, default: 0 },
    notes:         { type: String, default: '' },
  },
  { timestamps: true }
);

POSCustomerSchema.index({ tenant: 1, phone: 1 });
POSCustomerSchema.index({ tenant: 1, createdAt: -1 });
POSCustomerSchema.index(
  { tenant: 1, firstName: 'text', lastName: 'text', phone: 'text', email: 'text' },
  { name: 'customer_search' }
);

module.exports = mongoose.model('POSCustomer', POSCustomerSchema);
