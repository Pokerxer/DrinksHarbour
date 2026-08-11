import { describe, it, expect } from 'vitest';
import {
  CODE128_PATTERNS,
  CODE128_STOP,
  CODE128_QUIET_ZONE,
  MIN_READABLE_BAR_MM,
  encodeCode128,
  barWidthMm,
  isScannableAtWidth,
} from './barcode-utils';

// The encoder is hand-rolled rather than pulled from `jsbarcode`: vitest here
// runs `environment: 'node'` so a rendering dependency could not be tested at
// all, and the admin build has already OOM'd once on dependency weight. The
// price of hand-rolling is that the SYMBOL TABLE has to be trusted, so it is
// checked below against the structural properties Code 128 guarantees.

describe('the symbol table', () => {
  // A mis-typed width in a 107-row table prints a barcode that looks perfectly
  // convincing and scans as the wrong thing — or not at all. These four
  // properties are documented invariants of Code 128, and between them they
  // catch essentially any single-digit slip.

  it('has one pattern per value, 0 to 106', () => {
    expect(CODE128_PATTERNS).toHaveLength(103 + 3); // 0–102, plus START A/B/C
    expect(CODE128_STOP).toBeTruthy();
  });

  it('gives every symbol six elements totalling eleven modules', () => {
    CODE128_PATTERNS.forEach((pattern, value) => {
      expect(pattern, `value ${value}`).toHaveLength(6);
      const total = pattern.split('').reduce((sum, d) => sum + Number(d), 0);
      expect(total, `value ${value} (${pattern})`).toBe(11);
    });
  });

  it('gives every symbol an even number of bar modules', () => {
    // Code 128's parity rule: bars always sum to an even width. A swapped or
    // mistyped digit almost always breaks it.
    CODE128_PATTERNS.forEach((pattern, value) => {
      const bars = Number(pattern[0]) + Number(pattern[2]) + Number(pattern[4]);
      expect(bars % 2, `value ${value} (${pattern})`).toBe(0);
    });
  });

  it('never repeats a pattern', () => {
    // Two values sharing a pattern is a decoder ambiguity — and, in practice,
    // a copy-paste error in the table.
    expect(new Set(CODE128_PATTERNS).size).toBe(CODE128_PATTERNS.length);
  });

  it('ends with the stop pattern: seven elements, thirteen modules', () => {
    expect(CODE128_STOP).toHaveLength(7);
    expect(CODE128_STOP.split('').reduce((s, d) => s + Number(d), 0)).toBe(13);
  });
});

describe('encoding a badge number', () => {
  it('packs digits two to a symbol', () => {
    // THE reason badge numbers are digits. Code Set C encodes a PAIR of digits
    // per symbol; Code Set B manages one character. Eight digits is four
    // symbols, not eight.
    const encoded = encodeCode128('12345678')!;
    expect(encoded.symbols).toEqual([
      105,
      12,
      34,
      56,
      78,
      expect.any(Number),
      106,
    ]);
  });

  it('prints an 8-digit badge in 79 modules', () => {
    // The number the whole design rests on: start(11) + 4 data symbols(44) +
    // check(11) + stop(13). Over ~44mm of printable card that is a ~0.55mm
    // bar — comfortable for the cheapest laser scanner in the shop.
    expect(encodeCode128('12345678')!.modules).toBe(79);
  });

  it('needs 299 modules for a 24-character ObjectId', () => {
    // The payload the badge used to fall back to, and the reason badge numbers
    // exist at all: 11 + 24×11 + 11 + 13. Over the same 44mm that is a 0.15mm
    // bar, which no entry-level scanner can resolve.
    expect(encodeCode128('507f1f77bcf86cd799439011')!.modules).toBe(299);
  });

  it('computes the mod-103 check symbol', () => {
    // Worked by hand from the spec so this pins a number rather than agreeing
    // with itself: START C (105) + 12×1 + 34×2 + 56×3 + 78×4
    //   = 105 + 12 + 68 + 168 + 312 = 665;  665 mod 103 = 665 − 618 = 47.
    const encoded = encodeCode128('12345678')!;
    expect(encoded.symbols[5]).toBe(47);
  });

  it('computes the check symbol over Code Set B too', () => {
    // START B (104) + 'A'(33)×1 + 'B'(34)×2 + 'C'(35)×3
    //   = 104 + 33 + 68 + 105 = 310;  310 mod 103 = 310 − 309 = 1.
    const encoded = encodeCode128('ABC')!;
    expect(encoded.symbols).toEqual([104, 33, 34, 35, 1, 106]);
  });
});

describe('choosing a code set', () => {
  it('uses Code Set C only when the whole payload is an even run of digits', () => {
    expect(encodeCode128('12345678')!.symbols[0]).toBe(105);
    expect(encodeCode128('1234567')!.symbols[0]).toBe(104); // odd length
    expect(encodeCode128('STAFF-42')!.symbols[0]).toBe(104); // not digits
  });

  it('still encodes a hand-entered badge, just wider', () => {
    // `rfidBadge` is free text — a business with pre-printed cards puts its own
    // numbering in it, and that card must still print. One symbol per
    // character: 11 + 8×11 + 11 + 13.
    expect(encodeCode128('STAFF-42')!.modules).toBe(123);
  });

  it('refuses what Code 128 cannot carry rather than printing nonsense', () => {
    // A barcode that silently drops a character scans as somebody else. The
    // caller gets null and shows no barcode, which is honest.
    expect(encodeCode128('')).toBeNull();
    expect(encodeCode128('Adé')).toBeNull(); // outside printable ASCII
    expect(encodeCode128('badge\u00a0number')).toBeNull(); // a non-breaking space
    expect(encodeCode128('badge number')).not.toBeNull(); // an ordinary one is fine
  });
});

describe('the bars themselves', () => {
  it('alternates bar and space, starting and ending on a bar', () => {
    // The stop pattern's trailing bar is what tells a scanner the symbol ended.
    const { runs } = encodeCode128('12345678')!;
    expect(runs.length % 2).toBe(1);
  });

  it('lays the bars out left to right with no gaps unaccounted for', () => {
    const { bars, runs, modules } = encodeCode128('12345678')!;
    expect(bars).toHaveLength(Math.ceil(runs.length / 2));
    expect(bars[0].x).toBe(0);
    const last = bars[bars.length - 1];
    expect(last.x + last.width).toBe(modules);
    for (const bar of bars) expect(bar.width).toBeGreaterThan(0);
  });

  it('keeps the bar run-lengths in step with the symbol widths', () => {
    const { runs, modules } = encodeCode128('12345678')!;
    expect(runs.reduce((a, b) => a + b, 0)).toBe(modules);
  });
});

describe('deciding whether it is worth printing', () => {
  // The check the badge card actually needs. A barcode narrower than a scanner
  // can resolve is worse than no barcode: it looks like it works.

  it('measures a module against the printable width', () => {
    // 79 modules across 44mm.
    expect(barWidthMm(79, 44)).toBeCloseTo(0.557, 3);
    expect(barWidthMm(299, 44)).toBeCloseTo(0.147, 3);
  });

  it('needs quiet zones on both sides of the symbol', () => {
    // 10 modules each side, per the spec. Left out, the scanner reads the card
    // edge as a bar. They are part of the width the layout has to find.
    expect(CODE128_QUIET_ZONE).toBe(10);
    expect(barWidthMm(79 + CODE128_QUIET_ZONE * 2, 44)).toBeLessThan(
      barWidthMm(79, 44)
    );
  });

  it('passes a badge number on a CR80 card and fails an ObjectId', () => {
    const printable = 44;
    expect(isScannableAtWidth(encodeCode128('12345678')!, printable)).toBe(
      true
    );
    expect(
      isScannableAtWidth(encodeCode128('507f1f77bcf86cd799439011')!, printable)
    ).toBe(false);
  });

  it('holds the threshold at the entry-level scanner, not the good one', () => {
    // 0.19mm ≈ 7.5 mil, about the narrowest an inexpensive laser resolves.
    // Raising this stops printing barcodes that do in fact work.
    expect(MIN_READABLE_BAR_MM).toBe(0.19);
  });
});
