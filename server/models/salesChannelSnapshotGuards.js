'use strict';
const { ConflictError } = require('../utils/errors');
const touches = key => key === 'channelSnapshot' || key.startsWith('channelSnapshot.');
module.exports = function protectSnapshot(schema) {
  for (const operation of ['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'findOneAndReplace']) {
    schema.pre(operation, function () {
      const update = this.getUpdate();
      // Replacement/pipeline updates cannot prove preservation of accepted terms.
      if (['replaceOne', 'findOneAndReplace'].includes(operation) || Array.isArray(update)) throw new ConflictError('Order replacement requires preservation of immutable channel history');
      for (const [operator, values] of Object.entries(update || {})) {
        if (touches(operator) || (values && typeof values === 'object' && Object.entries(values).some(([key, value]) => touches(key) || (operator === '$rename' && typeof value === 'string' && touches(value))))) throw new ConflictError('Accepted order channel snapshot is immutable');
      }
    });
  }
  schema.pre('save', function () {
    if (!this.isNew && this.isModified('channelSnapshot')) throw new ConflictError('Accepted order channel snapshot is immutable');
  });
};
