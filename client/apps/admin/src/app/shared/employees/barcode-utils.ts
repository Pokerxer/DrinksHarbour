// CODE_128, encoded by hand.
//
// WHY NOT A LIBRARY
// -----------------
// `jsbarcode` and friends render into a DOM canvas. Vitest here runs
// `environment: 'node'` with no jsdom, so a rendering dependency could not be
// tested at all — and the admin build has already OOM'd once on dependency
// weight. The algorithm is small and completely specified, so it lives here as
// a pure function: ONE encoder feeds the on-screen card, the PDF and the tests,
// which is the only way those three cannot drift apart.
//
// WHY IT MATTERS THAT THE PAYLOAD IS SHORT
// ----------------------------------------
// A CR80 card is 53.98mm wide with 5mm margins — about 44mm of printable width,
// and every module of the symbol has to fit inside it. Code Set C packs a PAIR
// of digits into one symbol; Code Set B manages one character. So:
//
//   8-digit badge number →  79 modules → ~0.55mm bars → reads on anything
//   24-char ObjectId     → 299 modules → ~0.15mm bars → reads on nothing
//
// That is why employees are issued a short numeric badge number, and why
// `isScannableAtWidth` exists: printing a barcode too fine to resolve is worse
// than printing none, because it looks like it works.

/**
 * Element widths for symbol values 0–106, as bar/space/bar/space/bar/space.
 *
 * Three documented properties of Code 128 hold for every row, and the tests
 * check all three, because a single mistyped digit here would print a barcode
 * that looks perfectly convincing and scans as something else:
 *   • six elements, totalling 11 modules;
 *   • the three bars total an EVEN number of modules (Code 128's parity rule);
 *   • no two values share a pattern.
 */
export const CODE128_PATTERNS: readonly string[] = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', // 0–7
  '132212', '221213', '221312', '231212', '112232', '122132', '122231', '113222', // 8–15
  '123122', '123221', '223211', '221132', '221231', '213212', '223112', '312131', // 16–23
  '311222', '321122', '321221', '312212', '322112', '322211', '212123', '212321', // 24–31
  '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313', // 32–39
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', // 40–47
  '313121', '211331', '231131', '213113', '213311', '213131', '311123', '311321', // 48–55
  '331121', '312113', '312311', '332111', '314111', '221411', '431111', '111224', // 56–63
  '111422', '121124', '121421', '141122', '141221', '112214', '112412', '122114', // 64–71
  '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111', // 72–79
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', // 80–87
  '421211', '212141', '214121', '412121', '111143', '111341', '131141', '114113', // 88–95
  '114311', '411113', '411311', '113141', '114131', '311141', '411131',           // 96–102
  '211412', // 103 START A
  '211214', // 104 START B
  '211232', // 105 START C
];

/** 106. Seven elements, 13 modules — the trailing bar is what ends the symbol. */
export const CODE128_STOP = '2331112';

/**
 * The blank margin a scanner needs on each side of the symbol, in modules.
 * Without it the card's edge reads as a bar and the symbol will not decode, so
 * this is width the layout has to find, not padding it may drop.
 */
export const CODE128_QUIET_ZONE = 10;

/**
 * The narrowest bar an entry-level laser scanner resolves, in millimetres —
 * roughly 7.5 mil. Cheap scanners are usually SPECIFIED at 0.25mm, so this is
 * already the optimistic end. Raising it would stop the badge printing barcodes
 * that do in fact work; lowering it prints ones that do not.
 */
export const MIN_READABLE_BAR_MM = 0.19;

const START_B = 104;
const START_C = 105;
const STOP_VALUE = 106;

export interface Code128Encoding {
  /** The symbol values written, start and check and stop included. */
  symbols: number[];
  /** Alternating run lengths in modules, starting AND ending with a bar. */
  runs: number[];
  /** Total width, in modules, excluding quiet zones. */
  modules: number;
  /** Bars only, positioned left to right in module units — ready to draw. */
  bars: Array<{ x: number; width: number }>;
}

/** Code Set B covers printable ASCII, and nothing else. */
function isEncodable(value: string): boolean {
  return /^[\x20-\x7e]+$/.test(value);
}

/**
 * Encode a payload, or null if Code 128 cannot carry it.
 *
 * Null rather than a throw or a best effort: a barcode that has quietly dropped
 * a character scans as somebody else, so the caller's job is to print nothing.
 */
export function encodeCode128(value: string): Code128Encoding | null {
  if (!value || !isEncodable(value)) return null;

  // Code Set C for an even-length run of digits, which halves the width; Code
  // Set B for everything else. Deliberately all-or-nothing: mid-symbol code-set
  // switches would save a little width on a mixed payload and cost a great deal
  // of subtlety, and the payload this actually prints is either our own 8-digit
  // number or somebody's short hand-entered one.
  const useC = /^[0-9]+$/.test(value) && value.length % 2 === 0;
  const symbols: number[] = [useC ? START_C : START_B];

  if (useC) {
    for (let i = 0; i < value.length; i += 2) {
      symbols.push(Number(value.slice(i, i + 2)));
    }
  } else {
    for (const ch of value) {
      symbols.push(ch.charCodeAt(0) - 32);
    }
  }

  // Checksum: the start value plus each data symbol weighted by its position
  // (1-based), modulo 103.
  let sum = symbols[0];
  for (let i = 1; i < symbols.length; i += 1) sum += symbols[i] * i;
  symbols.push(sum % 103);
  symbols.push(STOP_VALUE);

  const runs: number[] = [];
  for (const symbol of symbols) {
    const pattern = symbol === STOP_VALUE ? CODE128_STOP : CODE128_PATTERNS[symbol];
    for (const width of pattern) runs.push(Number(width));
  }

  // Runs alternate bar, space, bar, … so the even indices are the bars.
  const bars: Array<{ x: number; width: number }> = [];
  let x = 0;
  for (let i = 0; i < runs.length; i += 1) {
    if (i % 2 === 0) bars.push({ x, width: runs[i] });
    x += runs[i];
  }

  return { symbols, runs, modules: x, bars };
}

/** How wide one module prints when `modules` of them share `availableMm`. */
export function barWidthMm(modules: number, availableMm: number): number {
  return modules > 0 ? availableMm / modules : 0;
}

/**
 * Will this symbol, quiet zones included, still be readable across
 * `availableMm` of card?
 *
 * The badge asks this before drawing. A "no" means print the number as text and
 * leave the bars off, rather than printing a barcode that fails silently at the
 * one moment somebody needs it — standing at the kiosk at the start of a shift.
 */
export function isScannableAtWidth(
  encoding: Code128Encoding,
  availableMm: number
): boolean {
  const total = encoding.modules + CODE128_QUIET_ZONE * 2;
  return barWidthMm(total, availableMm) >= MIN_READABLE_BAR_MM;
}
