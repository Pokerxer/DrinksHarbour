// services/creditNote.numbering.js
//
// Sequential credit note numbers: CN-2026-000001, per tenant, per year.
//
// Two decisions worth stating, because both are easy to undo by accident:
//
//   1. Numbers are allocated at POST time, not at draft time. Drafts are
//      provisional — a draft can be edited, deleted or never posted — so
//      numbering on creation would leave permanent holes in the sequence, and a
//      gap in an audit trail invites the question "what was note 000117?".
//
//   2. The increment is one atomic findOneAndUpdate. Two posts in the same
//      millisecond must not receive the same number, and a read-then-write would
//      let them. Concurrent upserts can still collide on the unique index when
//      both transactions fail to find the row, so a duplicate-key is retried
//      once: that is expected contention, not a user-facing error.
const Counter = require('../models/Counter');

const DUPLICATE_KEY = 11000;

/** Zero-padded display form of a sequence. */
function formatNumber({ year, seq }) {
  return `CN-${year}-${String(seq).padStart(6, '0')}`;
}

/** Counter scope — exposed separately so the tenant/year split is testable. */
function formatKey({ tenant, year }) {
  return `${tenant}:${year}`;
}

/** Allocate the next number for a tenant's year. */
async function nextNumber({ tenant, year, session }) {
  const options = { upsert: true, new: true, setDefaultsOnInsert: true };
  if (session) options.session = session;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const counter = await Counter.findOneAndUpdate(
        { tenant, year },
        { $inc: { seq: 1 } },
        options
      );
      return formatNumber({ year, seq: counter.seq });
    } catch (err) {
      const raced = err && err.code === DUPLICATE_KEY;
      if (!raced || attempt === 1) throw err;
    }
  }
}

module.exports = { formatNumber, formatKey, nextNumber };
