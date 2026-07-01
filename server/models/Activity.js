const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  salesOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'SalesOrder', required: true },
  type: { type: String, enum: ['note', 'call', 'email', 'meeting', 'task', 'log', 'message'], default: 'note' },
  subject: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  system: { type: Boolean, default: false },
  meta: { type: mongoose.Schema.Types.Mixed },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

activitySchema.index({ tenant: 1, salesOrder: 1 });

module.exports = mongoose.models.Activity || mongoose.model('Activity', activitySchema);
