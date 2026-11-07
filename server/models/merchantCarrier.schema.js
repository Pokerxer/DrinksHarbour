'use strict';
const { Schema } = require('mongoose');
const sealed = (type, extra = {}) => ({ type, required: true, immutable: true, ...extra });
const money = { type: Number, required: true, min: 0, validate: Number.isSafeInteger };
const text = { type: String, required: true, maxlength: 512 };
const rate = new Schema(
  {
    courierId: text,
    serviceCode: text,
    name: { type: String, maxlength: 120 },
    amountMinor: money,
    displayMinor: money,
  },
  { _id: false },
);
const common = {
  merchantOrder: sealed(String),
  order: sealed(Schema.Types.ObjectId),
  tenant: sealed(Schema.Types.ObjectId),
  location: sealed(Schema.Types.ObjectId),
  allocationId: sealed(String),
};
const options = { timestamps: true, autoIndex: false };
module.exports = { sealed, money, text, rate, common, options };
