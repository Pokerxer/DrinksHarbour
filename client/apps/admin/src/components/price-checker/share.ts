import type { CompareSummary } from './session-summary';
import { formatMoney } from './money';

export interface ShareLinks {
  whatsapp?: string;
  sms?: string;
}

/** The recap text the customer can send to themselves — prices are public
 *  catalog data; nothing personal leaves the phone. */
export function shareMessage(
  summary: CompareSummary,
  storeName: string | null,
  currency = 'NGN'
): string {
  const band =
    summary.saved > 0
      ? ` from ${formatMoney(summary.from, currency)} to ${formatMoney(summary.to, currency)}`
      : '';
  return [
    'DrinksHarbour',
    `Compared ${summary.count} bottles · lowest price ${summary.bestName}${band}`,
    storeName ? `@ ${storeName}` : '',
  ]
    .filter(Boolean)
    .join(' — ');
}

/** Transports that work on any phone (no Web Share API required). */
export function buildShareLinks(text: string): ShareLinks {
  return {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(text)}`,
    sms: `sms:?&body=${encodeURIComponent(text)}`,
  };
}
