// What the employee badge card DECIDES, separated from how it draws.
//
// Vitest here runs `environment: 'node'` with no jsdom, so the card component
// cannot be rendered under test. Everything with a rule in it therefore lives
// out here — and, usefully, the on-screen card and the jsPDF output then share
// one set of answers instead of each working them out again slightly
// differently.

import type { Employee } from '@/services/employee.service';
import {
  encodeCode128,
  isScannableAtWidth,
  CODE128_QUIET_ZONE,
  type Code128Encoding,
} from './barcode-utils';

/** CR80, portrait — the card the PDF is cut to and the screen preview imitates. */
export const CARD_W_MM = 53.98;
export const CARD_H_MM = 85.6;
/** The brand band across the bottom. Nothing else may be printed inside it. */
export const CARD_FOOTER_MM = 6;

// Mirrors BADGE_NUMBER_RE in server/services/badgeNumber.helpers.js, which is
// where the rule actually lives: eight digits, never a leading zero (a zero does
// not survive a round trip through a spreadsheet). The client cannot import
// from the server, so the two are kept in step by testing the same cases.
const BADGE_NUMBER_RE = /^[1-9][0-9]{7}$/;

/** Did the server issue this number, as opposed to a business's own scheme? */
export function isBadgeNumber(value: string): boolean {
  return BADGE_NUMBER_RE.test(value);
}

/**
 * Grouped for a human to read off the card or say down a phone.
 *
 * Only ever applied to a number we issued: `rfidBadge` is free text, so a
 * business with pre-printed cards has its own numbering in there, and
 * regrouping it would print something matching neither their records nor the
 * card already in their drawer.
 */
export function formatBadgeNumber(value: string): string {
  if (!isBadgeNumber(value)) return value;
  return `${value.slice(0, 4)} ${value.slice(4)}`;
}

/**
 * What both codes on the card encode: the badge number when there is one,
 * otherwise the employee id.
 *
 * The kiosk matches `rfidBadge` exactly BEFORE falling back to `_id`, so either
 * payload lands on a lookup that already exists. The difference is width — see
 * `badgeBarcodeLayout`.
 */
export function badgePayload(e: Employee): string {
  return e.employeeProfile?.attendance?.rfidBadge?.trim() || e._id;
}

export interface BadgeBarcodeLayout {
  encoding: Code128Encoding;
  /** One module, in the caller's units (mm for the PDF, anything for screen). */
  moduleMm: number;
  /** Left edge of the first bar — the quiet zone starts at 0. */
  x: number;
  /** First bar to last bar. */
  widthMm: number;
}

/**
 * Place a CODE_128 symbol across a card `cardWidth` wide, or return null if it
 * would not be readable there.
 *
 * The symbol is laid out against the FULL card width rather than the 5mm print
 * margin, because the quiet zone is measured in MODULES, not millimetres: ten
 * modules at ~0.55mm is 5.5mm, wider than the margin. Centring the symbol
 * inside the whole width puts the required white space either side by
 * construction.
 *
 * Null is the important case. An employee with no badge number yet falls back
 * to a 24-character ObjectId, which on this card is a 0.15mm bar — narrower
 * than any entry-level scanner resolves. Printing it would look exactly like a
 * working barcode and fail at the kiosk at the start of somebody's shift, so
 * the card prints no bars at all instead.
 */
export function badgeBarcodeLayout(
  payload: string,
  cardWidth: number
): BadgeBarcodeLayout | null {
  const encoding = encodeCode128(payload);
  if (!encoding) return null;
  if (!isScannableAtWidth(encoding, cardWidth)) return null;

  const moduleMm = cardWidth / (encoding.modules + CODE128_QUIET_ZONE * 2);
  return {
    encoding,
    moduleMm,
    x: CODE128_QUIET_ZONE * moduleMm,
    widthMm: encoding.modules * moduleMm,
  };
}

/**
 * Why this card cannot be printed with a working barcode, if it cannot.
 *
 *   'ready'       — the payload prints as bars a shop scanner will read.
 *   'missing'     — no badge number at all, so the payload is the employee id.
 *                   This is the one the "Issue badge number" button fixes.
 *   'unscannable' — a badge number exists, but it does not fit the card as
 *                   bars: letters cost a whole CODE_128 symbol each where a
 *                   PAIR of digits costs one, so `STAFF-0042` is far wider than
 *                   an 8-digit code.
 *
 * The last two are what makes this a rule rather than an `if`. Both show no
 * barcode, so `badgeBarcodeLayout(...) === null` cannot tell them apart — and
 * reading that as "has no badge number" would put an Issue button in front of a
 * business's own numbering. Pressing it does nothing: the server will not
 * re-issue over an existing value, because that value is printed on a card in
 * somebody's drawer.
 */
export function badgeIssueState(
  e: Employee,
  cardWidth: number
): 'ready' | 'missing' | 'unscannable' {
  const payload = badgePayload(e);
  if (badgeBarcodeLayout(payload, cardWidth)) return 'ready';
  // badgePayload falls back to the id, so this IS "no number issued".
  return payload === e._id ? 'missing' : 'unscannable';
}

// ── Whose card this is ───────────────────────────────────────────────────────
//
// The card is printed BY a tenant, FOR that tenant's staff, and handed to
// somebody who works in that shop. It used to say DRINKSHARBOUR, which is the
// platform the shop rents — not the employer whose door the card opens.
//
// The name comes from `useTenant()`, which the root layout populates from the
// tenant subdomain when the URL names one and otherwise from the signed-in
// user's own tenant — see `resolveTenantSlug` in src/context/tenant-slug.ts.
// That second half is what makes the shop's name reach a card printed at
// admin.drinksharbour.com, where there is no subdomain to read it from.
//
// The fallback below is still not decoration. A platform admin owns no tenant,
// so nothing resolves for them at all, and without it that header band prints
// empty.

/** What a card says when nothing better is known. */
export const BADGE_BRAND_FALLBACK = 'DrinksHarbour';

/**
 * How much name the header band will take.
 *
 * The band is a fixed 16mm and the avatar disc is drawn AFTER the text, so
 * anything that spills paints under a photo. jsPDF's centred `text` does not
 * wrap unless given a maxWidth — it simply runs off both edges of the card —
 * and a maxWidth would wrap it down into the title instead. So the name is cut
 * HERE, where it can be tested, rather than at the pen. 28 characters at 6pt
 * with the band's letter-spacing is comfortably inside 54mm.
 */
export const BADGE_BRAND_MAX_CHARS = 28;

/** The red the card was always printed in, and what a bad colour falls back to. */
export const BADGE_BRAND_COLOR_FALLBACK = '#b20202';

const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export interface BadgeBrand {
  /** The shop's name, trimmed and cut to fit. */
  name: string;
  /** The PDF header band. */
  headerLine: string;
  /** The footer band, on both surfaces. */
  footerLine: string;
}

/** Cut to fit, keeping the front — the part that identifies the shop. */
function fitBrandName(name: string): string {
  if (name.length <= BADGE_BRAND_MAX_CHARS) return name;
  return `${name.slice(0, BADGE_BRAND_MAX_CHARS - 1).trimEnd()}…`;
}

/**
 * What the card says about who issued it.
 *
 * @param tenantName `useTenant().tenant?.name` — absent on the platform domain.
 */
export function badgeBrand(tenantName?: string | null): BadgeBrand {
  const trimmed = typeof tenantName === 'string' ? tenantName.trim() : '';
  const name = fitBrandName(trimmed || BADGE_BRAND_FALLBACK);
  return {
    name,
    headerLine: name.toUpperCase(),
    // The wording is the reason the band is there: it is what a finder reads.
    footerLine: `${name} · Property of the company`,
  };
}

export interface BadgeBrandColor {
  hex: string;
  /** jsPDF's setFillColor/setTextColor take three numbers, not a hex string. */
  rgb: [number, number, number];
}

/**
 * The colour the card is printed in.
 *
 * Validated rather than trusted, because the failure is silent: `setFillColor`
 * takes three NUMBERS, and feeding it NaN paints nothing at all — the header
 * band simply disappears and the white title is printed on white card.
 */
export function badgeBrandColor(primaryColor?: string | null): BadgeBrandColor {
  const raw = typeof primaryColor === 'string' ? primaryColor.trim() : '';
  const hex = HEX_COLOR_RE.test(raw) ? raw : BADGE_BRAND_COLOR_FALLBACK;

  // #abc is shorthand for #aabbcc — expanded before parsing, so a three-digit
  // brand colour is the colour the tenant picked rather than a fallback.
  const body = hex.slice(1);
  const full =
    body.length === 3
      ? body
          .split('')
          .map((ch) => ch + ch)
          .join('')
      : body;

  return {
    hex,
    rgb: [
      parseInt(full.slice(0, 2), 16),
      parseInt(full.slice(2, 4), 16),
      parseInt(full.slice(4, 6), 16),
    ],
  };
}

// ── The vertical budget ──────────────────────────────────────────────────────
//
// 85.6mm has to hold a header band, a photo, a name, a role, the info rows, the
// QR, the barcode and a footer band. Before the barcode there was slack; there
// is none now, and the barcode's height is the one measurement that cannot be
// shaved — a hand-held laser needs a bar tall enough to sweep across at an
// angle. So the block from the QR down is anchored to the FOOTER and worked out
// upwards, and the info rows take whatever is left in between.
//
// It lives out here, and not inline in the drawing code, for the same reason
// everything else does: the component cannot be rendered under test, and the
// failure mode of getting this wrong is ink printed underneath the footer band,
// where it is invisible on screen and simply missing on the card.

const HEADER_H = 16;
const BRAND_Y = 6.5; // text baselines throughout, not box tops
const TITLE_Y = 12.3;
// The photo is a disc punched into the header band and drawn AFTER the title,
// so its top edge must clear TITLE_Y or it paints over the words.
const PHOTO_SIZE = 17;
const PHOTO_Y = 13.5;
const NAME_Y = 35;
const ROLE_Y = 39;
const ROWS_Y = 43;
const ROW_STEP_MAX = 4.2;

const QR_SIZE = 12;
const QR_TO_BARS = 1.2;
const BARS_H = 6.4;
const BARS_TO_CAPTION = 3.6; // bar foot to the caption's baseline
const CAPTION_TO_FOOTER = 1.2;

export interface BadgePdfLayout {
  headerH: number;
  brandY: number;
  titleY: number;
  photo: { x: number; y: number; size: number };
  nameY: number;
  roleY: number;
  rowsY: number;
  rowStep: number;
  qr: { size: number; y: number };
  bars: { y: number; height: number };
  captionY: number;
  /** The lowest ink on the card. Must stay above the footer band. */
  bottom: number;
}

/** Where everything sits on the printed card, given how many info rows there are. */
export function badgePdfLayout(rowCount: number): BadgePdfLayout {
  const footerTop = CARD_H_MM - CARD_FOOTER_MM;
  const captionY = footerTop - CAPTION_TO_FOOTER;
  const barsY = captionY - BARS_TO_CAPTION - BARS_H;
  const qrY = barsY - QR_TO_BARS - QR_SIZE;

  // The rows absorb the slack: they compress rather than pushing the barcode
  // into the footer, so adding a row back costs legibility, never the scan.
  const rowSpace = qrY - ROWS_Y;
  const rowStep = Math.min(
    ROW_STEP_MAX,
    rowCount > 0 ? rowSpace / rowCount : ROW_STEP_MAX
  );

  return {
    headerH: HEADER_H,
    brandY: BRAND_Y,
    titleY: TITLE_Y,
    photo: { x: (CARD_W_MM - PHOTO_SIZE) / 2, y: PHOTO_Y, size: PHOTO_SIZE },
    nameY: NAME_Y,
    roleY: ROLE_Y,
    rowsY: ROWS_Y,
    rowStep,
    qr: { size: QR_SIZE, y: qrY },
    bars: { y: barsY, height: BARS_H },
    captionY,
    bottom: captionY,
  };
}
