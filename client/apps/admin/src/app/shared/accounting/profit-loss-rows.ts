import type { ProfitLoss } from '@/services/accounting.service';

// Shared by the screen, print and CSV so exported figures cannot omit reversals.
export function profitLossRows(data: ProfitLoss) {
  const sales = data.sales ?? {
    gross: data.revenueTotal,
    reversals: 0,
    net: data.revenueTotal,
  };
  return [
    { label: 'Sales before reversals (excl. VAT)', amount: sales.gross },
    { label: 'Refunds & sales reversals', amount: -sales.reversals },
    { label: 'Net sales (excl. VAT)', amount: sales.net, bold: true },
    { label: 'Cost of goods sold', amount: -data.cogs.total },
    { label: 'Gross profit', amount: data.grossProfit, bold: true },
    { label: 'Other income / rounding', amount: data.otherIncome ?? 0 },
    { label: 'Operating expenses', amount: -data.expenseTotal },
    { label: 'Net profit', amount: data.netProfit, bold: true },
  ];
}
