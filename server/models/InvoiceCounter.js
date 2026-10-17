const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, required: true },
  year: { type: Number, required: true }, seq: { type: Number, default: 0 },
});
schema.index({ tenant: 1, year: 1 }, { unique: true });
module.exports = mongoose.models.InvoiceCounter || mongoose.model('InvoiceCounter', schema);
