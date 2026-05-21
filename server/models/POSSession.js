const mongoose = require('mongoose');

// Per-payment-method balance snapshot (opening/closing)
const MethodBalanceSchema = new mongoose.Schema({
  method:      { type: String, enum: ['cash', 'card', 'bank_transfer', 'mobile_money', 'split'] },
  opening:     { type: Number, default: 0 },   // entered at session open
  theoretical: { type: Number, default: 0 },   // computed from orders
  counted:     { type: Number, default: null }, // entered at close
  difference:  { type: Number, default: null }, // counted - theoretical
}, { _id: false });

// Audit log entry: who was the active cashier and when
const CashierLogSchema = new mongoose.Schema({
  cashier:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  startedAt: { type: Date, default: Date.now },
  endedAt:   { type: Date, default: null },
}, { _id: false });

// Cash in / cash out movement within a session
const CashMovementSchema = new mongoose.Schema({
  type:        { type: String, enum: ['in', 'out'], required: true },
  amount:      { type: Number, required: true, min: 0.01 },
  reason:      { type: String, trim: true, default: '' },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  performedAt: { type: Date, default: Date.now },
}, { _id: true });

const POSSessionSchema = new mongoose.Schema(
  {
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },

    // Terminal type — retail or wholesale (one open session allowed per type per tenant)
    terminalType: {
      type: String,
      enum: ['retail', 'wholesale'],
      default: 'retail',
      index: true,
    },

    // Who opened / closed the session
    openedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    closedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    // Currently active cashier (changes on switch)
    activeCashier: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    // Audit trail of all cashiers who used this session
    cashierLog: { type: [CashierLogSchema], default: [] },

    status: {
      type: String,
      enum: ['open', 'closed'],
      default: 'open',
      index: true,
    },

    openedAt: { type: Date, default: Date.now },
    closedAt: { type: Date, default: null },

    // ── Opening Control ──────────────────────────────────────────────────────
    // Cash opening balance (what was physically in the drawer)
    openingCash: { type: Number, default: 0, min: 0 },

    // ── Closing Control ──────────────────────────────────────────────────────
    // Per-method: theoretical (from orders) + counted (entered by cashier) + difference
    methodBalances: { type: [MethodBalanceSchema], default: [] },

    // Overall cash difference flag
    hasDifference: { type: Boolean, default: false },

    // ── Session Totals (computed at close from orders) ───────────────────────
    totalSales:       { type: Number, default: 0 },
    orderCount:       { type: Number, default: 0 },
    cashSales:        { type: Number, default: 0 },
    cardSales:        { type: Number, default: 0 },
    transferSales:    { type: Number, default: 0 },
    mobileMoneySales: { type: Number, default: 0 },
    splitSales:       { type: Number, default: 0 },

    // ── Cash movements (mid-session in/out) ──────────────────────────────────
    cashMovements: { type: [CashMovementSchema], default: [] },

    // ── Notes ───────────────────────────────────────────────────────────────
    notes:        { type: String, default: '' },
    closingNotes: { type: String, default: '' },

    // Legacy (kept for backwards compat, prefer methodBalances)
    openingBalance: { type: Number, default: 0 },
    closingBalance: { type: Number, default: null },

    zReport: {
      generatedAt:   { type: Date, default: null },
      totalSales:    { type: Number, default: 0 },
      totalOrders:   { type: Number, default: 0 },
      totalRefunds:  { type: Number, default: 0 },
      totalVoids:    { type: Number, default: 0 },
      cashSales:     { type: Number, default: 0 },
      cardSales:     { type: Number, default: 0 },
      transferSales: { type: Number, default: 0 },
      mobileSales:   { type: Number, default: 0 },
      openingCash:   { type: Number, default: 0 },
      expectedCash:  { type: Number, default: 0 },
      countedCash:   { type: Number, default: null },
      cashDifference:{ type: Number, default: null },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual: cash theoretical = opening cash + cash sales + cash-ins - cash-outs
POSSessionSchema.virtual('cashTheoretical').get(function () {
  const cashMethod = this.methodBalances?.find(m => m.method === 'cash');
  if (cashMethod) return cashMethod.theoretical;
  const movements = this.cashMovements || [];
  const netMoves = movements.reduce((sum, m) => sum + (m.type === 'in' ? m.amount : -m.amount), 0);
  return this.openingCash + this.cashSales + netMoves;
});

// One open session per tenant+terminal at a time
POSSessionSchema.index({ tenant: 1, terminalType: 1, status: 1 });

module.exports = mongoose.model('POSSession', POSSessionSchema);
