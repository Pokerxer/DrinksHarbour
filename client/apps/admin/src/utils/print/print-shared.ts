// Shared data helpers for the printed purchase documents. Layout lives in
// pdf-render.ts; each *-print builder turns a server record into a
// DocumentModel using the helpers below.

export const COMPANY = {
  name: 'DrinksHarbour',
  address: '39 Gana St, Maitama',
  city: 'Abuja, Nigeria',
  email: 'accounts@drinksharbour.com',
};

export function fmtDate(d?: string | Date | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function fmtAmt(n: number | undefined | null, currency: string): string {
  const safe = typeof n === 'number' && !Number.isNaN(n) ? n : 0;
  return `${currency} ${safe.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── Amount in words ─────────────────────────────────────────────────────────

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
];
const TEENS = [
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = [
  '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty',
  'Ninety',
];
const SCALES = ['', 'Thousand', 'Million', 'Billion', 'Trillion'];

function threeDigits(n: number): string {
  const parts: string[] = [];
  const h = Math.floor(n / 100);
  const r = n % 100;
  if (h) parts.push(`${ONES[h]} Hundred`);
  if (r < 10 && r > 0) parts.push(ONES[r]);
  else if (r >= 10 && r < 20) parts.push(TEENS[r - 10]);
  else if (r >= 20)
    parts.push(`${TENS[Math.floor(r / 10)]}${r % 10 ? `-${ONES[r % 10]}` : ''}`);
  return parts.join(' ');
}

export function numToWords(n: number): string {
  if (n === 0) return 'Zero';
  const groups: number[] = [];
  let rest = n;
  while (rest > 0) {
    groups.push(rest % 1000);
    rest = Math.floor(rest / 1000);
  }
  const words: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    if (!groups[i]) continue;
    const w = threeDigits(groups[i]);
    words.push(SCALES[i] ? `${w} ${SCALES[i]}` : w);
  }
  return words.join(', ');
}

const CURRENCY_WORDS: Record<string, { major: string; minor: string }> = {
  NGN: { major: 'Naira', minor: 'Kobo' },
  USD: { major: 'Dollars', minor: 'Cents' },
  EUR: { major: 'Euros', minor: 'Cents' },
  GBP: { major: 'Pounds', minor: 'Pence' },
};

/** "4800000" → "Four Million, Eight Hundred Thousand Naira Only" */
export function moneyWords(amount: number, currency = 'NGN'): string {
  const { major, minor } = CURRENCY_WORDS[currency] ?? {
    major: currency,
    minor: '',
  };
  const safe = typeof amount === 'number' && !Number.isNaN(amount) ? amount : 0;
  const abs = Math.round(Math.abs(safe) * 100) / 100;
  const whole = Math.floor(abs);
  const frac = Math.round((abs - whole) * 100);
  const chunks: string[] = [];
  if (whole > 0 || frac === 0) chunks.push(`${numToWords(whole)} ${major}`);
  if (frac > 0) chunks.push(`${numToWords(frac)}${minor ? ` ${minor}` : ''}`);
  return `${chunks.join(', ')} Only`;
}
