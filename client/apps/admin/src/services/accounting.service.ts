// services/accounting.service.ts
//
// Typed client for /api/accounting (Pro+ ERM feature). Same envelope/error
// style as tax.service.ts. All amounts are NGN.

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export type AccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense';

export type JournalEntryType =
  | 'accrued_revenue'
  | 'sales_revenue'
  | 'refund'
  | 'manual'
  | 'expense_accrual'
  | 'cogs'
  | 'tax_collected'
  | 'tax_paid'
  | 'inventory_adjust'
  | 'reversal';

export interface Account {
  _id: string;
  code: string;
  name: string;
  type: AccountType;
  isSystem: boolean;
  isActive: boolean;
  description?: string;
}

export interface JournalLine {
  account: string;
  accountId?: string;
  debit: number;
  credit: number;
  memo?: string;
}

export interface JournalEntry {
  _id: string;
  refDoc: string;
  refDocType: string;
  entryType: JournalEntryType;
  date: string;
  period: string;
  source: string;
  lines: JournalLine[];
  memo?: string;
  status: 'draft' | 'posted';
  postedBy?: { _id: string; name?: string } | null;
}

export interface TrialBalance {
  rows: Array<{
    code: string;
    name: string;
    type: AccountType;
    debits: number;
    credits: number;
    closing: number;
  }>;
  totalDebits: number;
  totalCredits: number;
  balanced: boolean;
}

export interface ProfitLoss {
  revenueTotal: number;
  cogs: { total: number; source: 'journal' | 'derived' };
  expenseTotal: number;
  grossProfit: number;
  netProfit: number;
  tax: { collected: number; paid: number };
}

export interface ReportSection {
  rows: Array<{ code: string; amount: number }>;
  total: number;
}

export interface BalanceSheet {
  assets: ReportSection;
  liabilities: ReportSection;
  equity: ReportSection;
  balanced: boolean;
}

export interface GeneralLedger {
  lines: Array<{
    date: string;
    entryId: string;
    refDocType: string;
    memo?: string;
    debit: number;
    credit: number;
    balance: number;
  }>;
  totals: { debits: number; credits: number; closing: number };
}

export interface MonthlyPoint {
  period: string;
  label: string;
  revenue: number;
  expenses: number;
}

export interface AccountingDashboard {
  kpis: {
    revenueMtd: number;
    expensesMtd: number;
    grossProfitMtd?: number;
    netProfitMtd: number;
    taxCollectedMtd: number;
    taxPaidMtd: number;
    unpostedDraftCount?: number;
  };
  profitLoss: ProfitLoss;
  monthly?: MonthlyPoint[];
  recentEntries: JournalEntry[];
  unpostedDraftCount: number;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

interface Envelope<T> {
  success: boolean;
  data: T;
  message?: string;
  pagination?: Pagination;
}

type QueryParams = Record<string, string | number | undefined>;

function toQuery(params?: QueryParams): string {
  const q = new URLSearchParams();
  Object.entries(params ?? {}).forEach(([k, v]) => {
    if (v !== undefined && v !== '') q.set(k, String(v));
  });
  const s = q.toString();
  return s ? `?${s}` : '';
}

class AccountingService {
  private getHeaders(token: string) {
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  }

  private async unwrap<T>(response: Response, fallbackMessage: string): Promise<Envelope<T>> {
    let body: Envelope<T>;
    try {
      body = (await response.json()) as Envelope<T>;
    } catch {
      throw new Error(response.ok ? fallbackMessage : `${fallbackMessage} (HTTP ${response.status})`);
    }
    if (!response.ok && response.status !== 207) {
      throw new Error(body.message || fallbackMessage);
    }
    if (body.success === false) throw new Error(body.message || fallbackMessage);
    return body;
  }

  // ── Journal entries ────────────────────────────────────────────────────────

  async journalEntries(
    token: string,
    params?: QueryParams & { page?: number; limit?: number }
  ): Promise<Envelope<JournalEntry[]>> {
    const res = await fetch(`${API_URL}/api/accounting/journal-entries${toQuery(params)}`, {
      headers: this.getHeaders(token),
    });
    return this.unwrap<JournalEntry[]>(res, 'Failed to load journal entries');
  }

  async journalEntry(token: string, id: string): Promise<Envelope<JournalEntry>> {
    const res = await fetch(`${API_URL}/api/accounting/journal-entries/${id}`, {
      headers: this.getHeaders(token),
    });
    return this.unwrap<JournalEntry>(res, 'Failed to load journal entry');
  }

  async createJournalEntry(
    token: string,
    body: { date: string; lines: JournalLine[]; memo?: string }
  ): Promise<Envelope<JournalEntry>> {
    const res = await fetch(`${API_URL}/api/accounting/journal-entries`, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify(body),
    });
    return this.unwrap<JournalEntry>(res, 'Failed to post journal entry');
  }

  async reverseJournalEntry(token: string, id: string): Promise<Envelope<JournalEntry>> {
    const res = await fetch(`${API_URL}/api/accounting/journal-entries/${id}/reverse`, {
      method: 'POST',
      headers: this.getHeaders(token),
    });
    return this.unwrap<JournalEntry>(res, 'Failed to reverse journal entry');
  }

  async deleteJournalEntry(token: string, id: string): Promise<{ success: boolean; message?: string }> {
    const res = await fetch(`${API_URL}/api/accounting/journal-entries/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(token),
    });
    return this.unwrap<null>(res, 'Failed to delete draft entry');
  }

  // ── Chart of accounts ──────────────────────────────────────────────────────

  async accounts(token: string, params?: QueryParams): Promise<Envelope<Account[]>> {
    const res = await fetch(`${API_URL}/api/accounting/accounts${toQuery(params)}`, {
      headers: this.getHeaders(token),
    });
    return this.unwrap<Account[]>(res, 'Failed to load chart of accounts');
  }

  async createAccount(token: string, body: Partial<Account>): Promise<Envelope<Account>> {
    const res = await fetch(`${API_URL}/api/accounting/accounts`, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify(body),
    });
    return this.unwrap<Account>(res, 'Failed to create account');
  }

  async updateAccount(token: string, id: string, body: Partial<Account>): Promise<Envelope<Account>> {
    const res = await fetch(`${API_URL}/api/accounting/accounts/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(token),
      body: JSON.stringify(body),
    });
    return this.unwrap<Account>(res, 'Failed to update account');
  }

  async removeAccount(token: string, id: string): Promise<{ success: boolean; message?: string }> {
    const res = await fetch(`${API_URL}/api/accounting/accounts/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(token),
    });
    return this.unwrap<null>(res, 'Failed to delete account');
  }

  // ── Reports + dashboard ────────────────────────────────────────────────────

  private async report<T>(token: string, path: string, params?: QueryParams, fallback = 'Failed to load report'): Promise<Envelope<T>> {
    const res = await fetch(`${API_URL}/api/accounting/${path}${toQuery(params)}`, {
      headers: this.getHeaders(token),
    });
    return this.unwrap<T>(res, fallback);
  }

  trialBalance(token: string, params?: { period?: string }) {
    return this.report<TrialBalance>(token, 'reports/trial-balance', params, 'Failed to load trial balance');
  }

  profitLoss(token: string, params?: { from?: string; to?: string }) {
    return this.report<ProfitLoss>(token, 'reports/profit-loss', params, 'Failed to load P&L');
  }

  balanceSheet(token: string, params?: { asOf?: string }) {
    return this.report<BalanceSheet>(token, 'reports/balance-sheet', params, 'Failed to load balance sheet');
  }

  generalLedger(token: string, params?: { account?: string; from?: string; to?: string }) {
    return this.report<GeneralLedger>(token, 'reports/general-ledger', params, 'Failed to load general ledger');
  }

  dashboard(token: string, params?: { from?: string; to?: string }) {
    return this.report<AccountingDashboard>(token, 'dashboard', params, 'Failed to load accounting dashboard');
  }
}

export const accountingService = new AccountingService();
