const mongoose = require('mongoose');

const customFieldSchema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  model: { type: String, required: true, enum: ['SalesOrder'] },
  fieldName: { type: String, required: true, trim: true },
  fieldType: { type: String, enum: ['text', 'number', 'date', 'select', 'boolean'], required: true },
  options: [{ type: String }],
  isRequired: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

customFieldSchema.index({ tenant: 1, model: 1 });

module.exports = mongoose.models.CustomField || mongoose.model('CustomField', customFieldSchema);
