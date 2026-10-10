const {
  accountTypeResolver,
  salesCodesFor,
  CANONICAL_SALES,
  CANONICAL_TAX_COLLECTED,
  CANONICAL_TAX_PAID,
} = require('./accounting.helpers');

const round2 = n => Math.round((Number(n) || 0) * 100) / 100;

// Classification is driven by the Account document's `type`; the code prefix is
// only consulted for a code with no Account at all (a legacy entry, or an
// account deleted since the line was written). Both are needed: the prefix keeps
// the reports working before a chart is loaded, the metadata keeps them correct
// for tenants who chose their own account numbering.
const isRevenue = (type, code) =>
  type ? type === 'income' : /^4/.test(code);
const isExpense = (type, code) => (type ? type === 'expense' : /^[6789]/.test(code));
// COGS stays a prefix split *within* confirmed expenses: an expense account is
// never something other than a cost, but 5xxx is how this chart spells COGS.
const isCogs = (type, code) =>
  type ? type === 'expense' && /^5/.test(code) : /^5/.test(code);

// Sales/returns are movements on sales revenue, not cash received. VAT and tips
// are balance-sheet liabilities; other income is shown after gross profit.
function profitLossTotals(entries = [], taxSummary = {}, movementTotals = null, accounts = []) {
  const typeOf = accountTypeResolver(accounts);
  // With no chart loaded the seeded codes are all we have to go on, so fall
  // back to the canonical sales account rather than reporting no sales.
  const salesCodes = salesCodesFor(typeOf);
  const isSales = (code) =>
    salesCodes.size ? salesCodes.has(code) : code === CANONICAL_SALES[0];

  let revenueTotal = 0, salesGross = 0, salesReversals = 0;
  let expenseTotal = 0, cogsTotal = 0, collected = 0, paid = 0;
  let hasJournalCosts = false;
  const documents = new Set();
  for (const entry of entries) {
    const entryType = entry.entryType;
    if (entryType === 'sales_revenue' && entry.refDoc) documents.add(String(entry.refDoc));
    for (const line of entry.lines || []) {
      const code = String(line.account);
      const type = typeOf(code);
      const debit = round2(line.debit), credit = round2(line.credit);
      const net = round2(debit - credit);
      if (isRevenue(type, code)) revenueTotal = round2(revenueTotal - net);
      if (isCogs(type, code)) {
        cogsTotal = round2(cogsTotal + net);
        hasJournalCosts = true;
      } else if (isExpense(type, code)) {
        expenseTotal = round2(expenseTotal + net);
      }
      if (isSales(code)) {
        if (['refund', 'reversal'].includes(entryType)) {
          salesReversals = round2(salesReversals + net);
        } else {
          salesGross = round2(salesGross + credit);
          salesReversals = round2(salesReversals + debit);
        }
      }
      if (code === CANONICAL_TAX_COLLECTED) collected = round2(collected - net);
      if (code === CANONICAL_TAX_PAID) paid = round2(paid + net);
    }
  }
  const salesNet = round2(salesGross - salesReversals);
  const otherIncome = round2(revenueTotal - salesNet);
  const cogs = {
    total: hasJournalCosts ? cogsTotal : round2(movementTotals?.cogs),
    source: hasJournalCosts || !movementTotals ? 'journal' : 'derived',
  };
  const ledgerCollected = round2(taxSummary.collected), ledgerPaid = round2(taxSummary.paid);
  // No posted journal history: retain the legacy tax-ledger-only view. Once
  // journals exist, show their actual VAT position and disclose any mismatch.
  const journalTax = entries.length > 0;
  return {
    revenueTotal,
    sales: { gross: salesGross, reversals: salesReversals, net: salesNet, documentCount: documents.size },
    otherIncome, cogs, expenseTotal,
    grossProfit: round2(salesNet - cogs.total),
    netProfit: round2(revenueTotal - cogs.total - expenseTotal),
    tax: {
      collected: journalTax ? collected : ledgerCollected,
      paid: journalTax ? paid : ledgerPaid,
      ledgerCollected, ledgerPaid,
      source: journalTax ? 'journal' : 'tax_records',
      reconciled: !journalTax || (Math.abs(collected - ledgerCollected) < 0.01 && Math.abs(paid - ledgerPaid) < 0.01),
    },
  };
}
module.exports = { profitLossTotals };
