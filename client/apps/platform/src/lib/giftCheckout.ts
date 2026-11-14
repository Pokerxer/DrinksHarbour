/**
 * Gift checkout — order-level gift helpers.
 *
 * Shared contract: docs/superpowers/specs/2026-10-27-gift-checkout-design.md
 * The client implements the order body's `gift` object exactly as specified:
 *
 *   order.gift = { isGift: true, from, to, message, requestedDeliveryDate, packagingRequested }
 *
 * All date bounds are computed against "today" in Africa/Lagos (UTC+1, no DST).
 * The server independently revalidates the same rules; this module exists so the
 * checkout can show inline errors before a submit ever reaches the server.
 *
 * Requested-delivery-date semantics everywhere: it is a plan the team confirms —
 * never a guaranteed date.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/** What the checkout form collects. */
export interface GiftDetails {
  from: string;
  to: string;
  recipientPhone?: string;
  message: string;
  /** 'YYYY-MM-DD'. At least tomorrow, at most +180 days, Africa/Lagos. */
  requestedDeliveryDate: string;
  packagingRequested: boolean;
}

/** The exact order-body shape. Only ever sent with `isGift: true`. */
export interface GiftPayload extends GiftDetails {
  isGift: true;
}

export type GiftFieldErrors = Partial<Record<keyof GiftDetails, string>>;

export interface GiftValidationResult {
  ok: boolean;
  errors: GiftFieldErrors;
  /** Trimmed, normalized details — null unless `ok`. */
  value: GiftDetails | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Query used against the public product search to find the packaging SKU. */
export const GIFT_PACKAGING_SEARCH_QUERY = 'gift packaging';

export const GIFT_FROM_MAX = 80;
export const GIFT_TO_MAX = 80;
export const GIFT_MESSAGE_MAX = 500;
/** Inclusive upper bound on the requested delivery date, in days from today. */
export const GIFT_DATE_MAX_DAYS = 180;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ─── Date helpers (Africa/Lagos) ─────────────────────────────────────────────

function addDaysISO(todayISO: string, days: number): string {
  if (!ISO_DATE_RE.test(todayISO)) return '';
  const [y, m, d] = todayISO.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/** Tomorrow (Lagos) — the earliest allowable requested date. */
export const tomorrowISO = (todayISO: string): string => addDaysISO(todayISO, 1);

/** Today + 180 days (Lagos) — the latest allowable requested date. */
export const maxISO = (todayISO: string): string =>
  addDaysISO(todayISO, GIFT_DATE_MAX_DAYS);

/** min/max for a `<input type="date">`, derived from the given Lagos today. */
export const giftDateBounds = (todayISO: string): { min: string; max: string } => ({
  min: tomorrowISO(todayISO),
  max: maxISO(todayISO),
});

/**
 * Today's calendar date in Africa/Lagos. Lagos is UTC+1 year-round with no DST,
 * so shifting the instant one hour forward and reading the UTC ISO date is exact.
 */
export function lagosTodayISO(now: Date = new Date()): string {
  return new Date(now.getTime() + 60 * 60 * 1000).toISOString().slice(0, 10);
}

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Validates gift details against the shared contract:
 * from/to trimmed 1..80; message 0..500; requestedDeliveryDate a real
 * 'YYYY-MM-DD' between tomorrow and +180 days relative to `todayISO`.
 */
export function validateGiftDetails(
  input: Partial<GiftDetails> | null | undefined,
  todayISO: string,
): GiftValidationResult {
  const errors: GiftFieldErrors = {};

  const from = (input?.from ?? '').trim();
  const to = (input?.to ?? '').trim();
  const recipientPhone = input?.recipientPhone?.trim().replace(/[\s().-]/g, '') ?? '';
  const message = input?.message ?? '';
  const date = (input?.requestedDeliveryDate ?? '').trim();

  if (!from) errors.from = 'Required';
  else if (from.length > GIFT_FROM_MAX) errors.from = `Max ${GIFT_FROM_MAX} characters`;

  if (!to) errors.to = 'Required';
  else if (to.length > GIFT_TO_MAX) errors.to = `Max ${GIFT_TO_MAX} characters`;

  if (input?.recipientPhone !== undefined && !/^\+?[0-9]{10,15}$/.test(recipientPhone)) {
    errors.recipientPhone = 'Enter a valid phone number for the recipient';
  }

  if (message.length > GIFT_MESSAGE_MAX) {
    errors.message = `Max ${GIFT_MESSAGE_MAX} characters — trim the note a little`;
  }

  if (!date) {
    errors.requestedDeliveryDate = 'Choose a date';
  } else if (!ISO_DATE_RE.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    errors.requestedDeliveryDate = 'Invalid date';
  } else if (date < tomorrowISO(todayISO)) {
    errors.requestedDeliveryDate = 'Must be tomorrow or later';
  } else if (date > maxISO(todayISO)) {
    errors.requestedDeliveryDate = `Must be within ${GIFT_DATE_MAX_DAYS} days (by ${maxISO(todayISO)})`;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors, value: null };

  return {
    ok: true,
    errors: {},
    value: {
      from,
      to,
      ...(recipientPhone ? { recipientPhone } : {}),
      message,
      requestedDeliveryDate: date,
      packagingRequested: input?.packagingRequested === true,
    },
  };
}

/** Builds the order-body `gift` object from validated details. */
export function buildGiftPayload(value: GiftDetails): GiftPayload {
  return {
    isGift: true,
    from: value.from,
    to: value.to,
    ...(value.recipientPhone ? { recipientPhone: value.recipientPhone } : {}),
    message: value.message,
    requestedDeliveryDate: value.requestedDeliveryDate,
    packagingRequested: value.packagingRequested === true,
  };
}
