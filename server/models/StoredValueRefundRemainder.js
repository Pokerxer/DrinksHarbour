'use strict';
const mongoose = require('mongoose');

// Per-debit REMAINDER GUARD for original-source stored-value refund credits
// (workstream W). NOT a balance ledger — the append-only ledgers remain
// PlatformWalletTransaction / GiftCardTransaction. One document per original
// checkout debit; `creditedMinor` is advanced atomically by a conditional
// findOneAndUpdate so concurrent credit commands with DIFFERENT idempotency
// keys can never over-credit the original debit
// (creditedMinor + amount ≤ originalMinor is evaluated server-side).
const schema = new mongoose.Schema(
  {
    _id: { type: mongoose.Schema.Types.ObjectId, required: true }, // the original debit tx id
    originalMinor: { type: Number, required: true, min: 1 },
    creditedMinor: { type: Number, required: true, min: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false }, strict: 'throw', autoIndex: false },
);

module.exports = mongoose.models.StoredValueRefundRemainder
  || mongoose.model('StoredValueRefundRemainder', schema);
