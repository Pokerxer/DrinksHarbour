// models/Account.js
//
// Tenant-scoped Chart of Accounts. `code` is the stable handle journal lines
// reference (`lines.account` stays the free-string code for backwards compat;
// `lines.accountId` links to this document). System accounts seed every tenant
// and cannot be deleted, only deactivated.
const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ObjectId } = Schema;

const AccountSchema = new Schema(
  {
    tenant: { type: ObjectId, ref: 'Tenant', required: true, index: true },
    code: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      required: true,
      enum: ['asset', 'liability', 'equity', 'income', 'expense'],
    },
    isSystem: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    description: { type: String, trim: true },
    createdBy: { type: ObjectId, ref: 'User' },
    updatedBy: { type: ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

AccountSchema.index({ tenant: 1, code: 1 }, { unique: true });

module.exports =
  mongoose.models.Account || mongoose.model('Account', AccountSchema);
