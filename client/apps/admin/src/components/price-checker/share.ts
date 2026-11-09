import type { CompareSummary } from './session-summary';
import { formatMoney } from './money';
import { t, type Language } from './copy';

export interface ShareLinks {
  whatsapp?: string;
  sms?: string;
}

/** The recap text the customer can send to themselves — prices are public
 *  catalog data; nothing personal leaves the phone. */
export function shareMessage(
  summary: CompareSummary,
  storeName: string | null,
  lang: Language = 'en'
): string {
  const band =
    summary.saved > 0
      ? ` ${t(lang, 'recapBand', {
          from: formatMoney(summary.from, 'NGN'),
          to: formatMoney(summary.to, 'NGN'),
        })}`
      : '';
  const bestPart = t(lang, 'recapBest', { name: summary.bestName });
  return [
    'DrinksHarbour',
    `${t(lang, 'recapIntro', { n: summary.count })} · ${bestPart}${band}`,
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
