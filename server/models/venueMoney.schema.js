'use strict';
const mongoose = require('mongoose'); const { Schema } = mongoose;
const requiredId = { type: Schema.Types.ObjectId, required: true };
function moneyModel(name, extra, indexes) {
  const schema = new Schema({ tenant: requiredId, location: requiredId, session: requiredId, billOrder: requiredId, ...extra }, { timestamps: true, autoIndex: false });
  for (const [keys, options] of indexes) schema.index(keys, options);
  return mongoose.models[name] || mongoose.model(name, schema);
}
module.exports = { moneyModel, requiredId };
