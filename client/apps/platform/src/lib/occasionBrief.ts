export const OCCASION_LABELS = {
  weddings: 'Weddings', corporate: 'Corporate events',
  'house-parties': 'House parties', gifting: 'Gifting', bulk: 'Bulk & case buying',
} as const;

export type OccasionId = keyof typeof OCCASION_LABELS;
export type OccasionBriefInput = { occasion: string; city: string; date: string; guests: string; budget: string; notes: string };
export type BriefErrors = Partial<Record<keyof OccasionBriefInput, string>>;
export type PreparedBrief = { ok: true; occasion: OccasionId; message: string } | { ok: false; errors: BriefErrors };

export function nigeriaDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = (type: string) => parts.find(part => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Prepare text only. No storage, tracking, network request or reservation. */
export function prepareOccasionBrief(input: OccasionBriefInput, today: string): PreparedBrief {
  const errors: BriefErrors = {};
  const city = input.city.trim().replace(/\s+/g, ' ');
  const guests = input.guests.trim();
  const budget = input.budget.trim();
  const notes = input.notes.trim();
  if (!Object.hasOwn(OCCASION_LABELS, input.occasion)) errors.occasion = 'Choose an occasion.';
  if (city.length < 2 || city.length > 80) errors.city = 'Enter a delivery city between 2 and 80 characters.';
  if (input.date) {
    const parsed = new Date(`${input.date}T12:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== input.date) errors.date = 'Enter a valid date.';
    else if (input.date < today) errors.date = 'Choose today or a future date.';
  }
  if (guests && (!/^\d+$/.test(guests) || !Number.isSafeInteger(Number(guests)) || Number(guests) < 1)) errors.guests = 'Enter a whole number of guests, at least 1.';
  if (budget && (!/^\d+(?:\.\d{1,2})?$/.test(budget) || !Number.isFinite(Number(budget)) || Number(budget) <= 0 || !Number.isSafeInteger(Math.round(Number(budget) * 100)))) errors.budget = 'Enter a positive budget in naira, with up to two decimal places.';
  if (notes.length > 500) errors.notes = 'Keep your note to 500 characters or fewer.';
  if (Object.keys(errors).length) return { ok: false, errors };

  const occasion = input.occasion as OccasionId;
  const message = [
    'Hi DrinksHarbour, I would like help planning a drinks order.',
    `Occasion: ${OCCASION_LABELS[occasion]}`,
    `Delivery city: ${city}`,
    input.date ? `Preferred date: ${input.date}` : '',
    guests ? `Guests: ${Number(guests).toLocaleString('en-NG')}` : '',
    budget ? `Budget: NGN ${Number(budget).toLocaleString('en-NG', { maximumFractionDigits: 2 })}` : '',
    notes ? `Notes: ${notes}` : '',
    'Please help me check suitable bottles, quantities, current prices, stock and delivery options.',
  ].filter(Boolean).join('\n');
  return { ok: true, occasion, message };
}
