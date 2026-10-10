// models/Counter.js
//
// Monotonic per-scope sequence, used for tenant document numbering
// (credit notes: CN-2026-000001).
//
// A counter is a cache of a number, not a source of truth — but it is the only
// thing that can hand two concurrent writers the same number safely. Reads and
// increments therefore happen in one atomic `findOneAndUpdate`; a
// find-then-increment would race, and the loser would produce a duplicate.
const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ObjectId } = Schema;

const CounterSchema = new Schema({
  tenant: { type: ObjectId, ref: 'Tenant', required: true },
  year: { type: Number, required: true },
  seq: { type: Number, default: 0, min: 0 },
});

// One sequence per tenant per year.
CounterSchema.index({ tenant: 1, year: 1 }, { unique: true });

module.exports =
  mongoose.models.Counter || mongoose.model('Counter', CounterSchema);
