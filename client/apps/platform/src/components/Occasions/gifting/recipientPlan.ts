// Deterministic totals for the multi-recipient gift organizer. Budget inputs
// are the customer's plan in naira; nothing here quotes bottle prices.
import { findGiftMatch, suggestsAlcohol, type BudgetTier, type RecipientType } from './giftFinderTable';

export type RecipientEntry = {
  id: string;
  /** Optional short label; empty counts as unnamed and needs the list later. */
  name: string;
  recipient: RecipientType;
  budgetTier: BudgetTier;
  /** Planned spend for this recipient in naira (0 = still deciding). */
  budget: number;
};

export type RecipientTotals = {
  recipients: number;
  unnamed: number;
  plannedNaira: number;
  alcoholFreeCount: number;
};

export function recipientTotals(entries: RecipientEntry[]): RecipientTotals {
  const safe = entries.filter(entry => entry && typeof entry.id === 'string');
  const plannedNaira = safe.reduce((sum, entry) => sum + (Number.isFinite(entry.budget) && entry.budget > 0 ? entry.budget : 0), 0);
  const alcoholFreeCount = safe.filter(entry => {
    const match = findGiftMatch(entry.recipient, entry.budgetTier);
    return match.suggestions.every(suggestion => !suggestsAlcohol(suggestion.category));
  }).length;
  return {
    recipients: safe.length,
    unnamed: safe.filter(entry => !entry.name.trim()).length,
    plannedNaira,
    alcoholFreeCount,
  };
}

/** Suggested bottle-category lines per recipient, composed from the gift finder table. */
export function recipientLines(entry: RecipientEntry): string[] {
  return findGiftMatch(entry.recipient, entry.budgetTier).suggestions.map(suggestion => suggestion.category);
}
