// models/UOMConversion.js
const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ObjectId } = Schema;

const uomConversionSchema = new Schema(
  {
    tenant: {
      type: ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    fromUOM: {
      type: String,
      required: true,
      enum: ['Units', 'Cases', 'Packs', 'Bottles', 'Cartons', 'Boxes', 'Cases', 'Pallets', 'Liters', 'Milliliters', 'Gallons'],
    },
    toUOM: {
      type: String,
      required: true,
      enum: ['Units', 'Cases', 'Packs', 'Bottles', 'Cartons', 'Boxes', 'Cases', 'Pallets', 'Liters', 'Milliliters', 'Gallons'],
    },
    conversionFactor: {
      type: Number,
      required: true,
      min: 0.0001,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    notes: {
      type: String,
      maxlength: 500,
    },
    createdBy: {
      type: ObjectId,
      ref: 'User',
      required: true,
    },
    updatedBy: {
      type: ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

uomConversionSchema.index({ tenant: 1, fromUOM: 1, toUOM: 1 }, { unique: true });
uomConversionSchema.index({ tenant: 1, isActive: 1 });

uomConversionSchema.methods.convert = function(value) {
  return value * this.conversionFactor;
};

uomConversionSchema.statics.convertUnits = async function(tenantId, value, fromUOM, toUOM) {
  if (fromUOM === toUOM) return value;
  
  const conversion = await this.findOne({
    tenant: tenantId,
    fromUOM,
    toUOM,
    isActive: true,
  });
  
  if (conversion) {
    return conversion.convert(value);
  }
  
  const reverseConversion = await this.findOne({
    tenant: tenantId,
    fromUOM: toUOM,
    toUOM: fromUOM,
    isActive: true,
  });
  
  if (reverseConversion) {
    return value / reverseConversion.conversionFactor;
  }
  
  return null;
};

const UOMConversion = mongoose.models.UOMConversion || mongoose.model('UOMConversion', uomConversionSchema);

module.exports = UOMConversion;
