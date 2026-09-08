const { Schema } = require('mongoose');
const { TEMPLATE_IDS, FAMILIES } = require('../config/document-templates');
const familySchema = new Schema(Object.fromEntries(FAMILIES.map(key => [key, { type: String, enum: TEMPLATE_IDS }])), { _id: false });
module.exports = new Schema({
  version: { type: Number, enum: [1], default: 1 },
  defaultTemplate: { type: String, enum: TEMPLATE_IDS, default: 'classic' },
  families: { type: familySchema, default: () => ({}) },
}, { _id: false });
