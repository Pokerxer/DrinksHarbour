import { describe, it, expect } from 'vitest';
import { CODE128_QUIET_ZONE } from './barcode-utils';
import {
  CARD_W_MM,
  CARD_H_MM,
  CARD_FOOTER_MM,
  badgePdfLayout,
  isBadgeNumber,
  formatBadgeNumber,
  badgePayload,
  badgeBarcodeLayout,
} from './badge-utils';
import type { Employee } from '@/services/employee.service';

// Components cannot be rendered here (vitest runs `environment: 'node'`, no
// jsdom), so everything the badge DECIDES lives in this module and the card is
// left with nothing but drawing.

const employee = (rfidBadge?: string): Employee =>
  ({
    _id: '507f1f77bcf86cd799439011',
    employeeProfile: rfidBadge === undefined ? {} : { attendance: { rfidBadge } },
  }) as unknown as Employee;

describe('what the codes encode', () => {
  it('prefers the badge number over the employee id', () => {
    // One scan has to work at the kiosk, and the kiosk matches rfidBadge
    // BEFORE falling back to _id — so whichever the card prints, it lands.
    expect(badgePayload(employee('12345678'))).toBe('12345678');
  });

  it('falls back to the employee id when no badge has been issued', () => {
    expect(badgePayload(employee())).toBe('507f1f77bcf86cd799439011');
    expect(badgePayload(employee('  '))).toBe('507f1f77bcf86cd799439011');
  });

  it('carries a hand-entered badge through untouched', () => {
    expect(badgePayload(employee('STAFF-0042'))).toBe('STAFF-0042');
  });
});

describe('the human-readable number', () => {
  // Mirrors server/services/badgeNumber.helpers.js, which is the rule's home —
  // the client cannot import from the server, so the two are kept in step by
  // holding to the same cases.

  it('groups our own number so it can be read off the card or said aloud', () => {
    expect(formatBadgeNumber('12345678')).toBe('1234 5678');
  });

  it('leaves somebody else numbering scheme exactly as it is', () => {
    // Regrouping `STAFF-0042` would print something that matches neither their
    // records nor the card in their drawer.
    expect(formatBadgeNumber('STAFF-0042')).toBe('STAFF-0042');
    expect(formatBadgeNumber('')).toBe('');
  });

  it('recognises only an 8-digit number with no leading zero as ours', () => {
    expect(isBadgeNumber('12345678')).toBe(true);
    expect(isBadgeNumber('01234567')).toBe(false);
    expect(isBadgeNumber('1234567')).toBe(false);
    expect(isBadgeNumber('STAFF-0042')).toBe(false);
  });
});

describe('fitting the barcode on the card', () => {
  it('spends the whole card width on the symbol plus its quiet zones', () => {
    // The 5mm print margin is not enough on its own: at ~0.55mm a module, ten
    // modules of quiet zone is 5.5mm. So the barcode is laid out against the
    // FULL card width and centres itself, which puts the required white space
    // either side by construction.
    const layout = badgeBarcodeLayout('12345678', CARD_W_MM)!;
    expect(layout.moduleMm * (layout.encoding.modules + CODE128_QUIET_ZONE * 2)).toBeCloseTo(
      CARD_W_MM,
      6
    );
    expect(layout.x).toBeCloseTo(CODE128_QUIET_ZONE * layout.moduleMm, 6);
    expect(layout.x + layout.widthMm).toBeCloseTo(CARD_W_MM - layout.x, 6);
  });

  it('gives an 8-digit badge a bar wide enough for a cheap laser', () => {
    const layout = badgeBarcodeLayout('12345678', CARD_W_MM)!;
    expect(layout.moduleMm).toBeGreaterThan(0.5);
  });

  it('refuses to draw an ObjectId rather than printing bars nobody can read', () => {
    // The failure this whole piece of work exists to prevent. A 24-character
    // payload is ~0.15mm a bar on this card: it looks like a barcode, and no
    // entry-level scanner will ever decode it.
    expect(badgeBarcodeLayout('507f1f77bcf86cd799439011', CARD_W_MM)).toBeNull();
  });

  it('draws a short hand-entered badge, since it still fits', () => {
    expect(badgeBarcodeLayout('STAFF-42', CARD_W_MM)).not.toBeNull();
  });

  it('has nothing to draw for an empty payload', () => {
    expect(badgeBarcodeLayout('', CARD_W_MM)).toBeNull();
  });

  it('scales to whatever width it is given, so screen and PDF agree', () => {
    // The on-screen card and the PDF are the same layout at two sizes. Sharing
    // the function is what stops them drifting.
    const pdf = badgeBarcodeLayout('12345678', CARD_W_MM)!;
    const screen = badgeBarcodeLayout('12345678', CARD_W_MM * 2)!;
    expect(screen.moduleMm).toBeCloseTo(pdf.moduleMm * 2, 6);
    expect(screen.encoding.bars).toEqual(pdf.encoding.bars);
  });
});

describe('the vertical budget of the printed card', () => {
  // 85.6mm has to hold a header band, a photo, a name, three info rows, a QR,
  // a barcode and a footer band — and the barcode's height is the one thing
  // that cannot be shaved, because a laser needs a bar tall enough to sweep
  // across. The arithmetic lives here rather than inline in the component
  // because the component cannot be rendered under test, and getting it wrong
  // means ink printed underneath the footer band where nobody ever sees it.

  const layout = badgePdfLayout(3);

  it('keeps every element clear of the footer band', () => {
    expect(layout.bottom).toBeLessThanOrEqual(CARD_H_MM - CARD_FOOTER_MM);
  });

  it('keeps the header text clear of the photo that straddles the band', () => {
    // The photo is a disc punched into the header band, drawn AFTER the text —
    // so a photo set even slightly too high silently paints over "STAFF ID
    // CARD" and the card comes off the printer with its title half missing.
    expect(layout.titleY).toBeLessThan(layout.photo.y);
    expect(layout.brandY).toBeLessThan(layout.titleY);
  });

  it('stacks the card top to bottom with nothing overlapping', () => {
    expect(layout.photo.y).toBeLessThan(layout.headerH); // straddles the band
    expect(layout.photo.y + layout.photo.size).toBeLessThan(layout.nameY);
    expect(layout.nameY).toBeLessThan(layout.roleY);
    expect(layout.roleY).toBeLessThan(layout.rowsY);
    expect(layout.rowsY + layout.rowStep * 3).toBeLessThanOrEqual(layout.qr.y);
    expect(layout.qr.y + layout.qr.size).toBeLessThanOrEqual(layout.bars.y);
    expect(layout.bars.y + layout.bars.height).toBeLessThan(layout.captionY);
  });

  it('gives the bars enough height to be swept', () => {
    // Under about 5mm a hand-held laser starts missing the symbol on a pass.
    expect(layout.bars.height).toBeGreaterThanOrEqual(5);
  });

  it('centres the photo', () => {
    expect(layout.photo.x + layout.photo.size / 2).toBeCloseTo(CARD_W_MM / 2, 6);
  });

  it('still fits if a fourth info row is ever added back', () => {
    // Guards the trade that was made: the BADGE / RFID row was dropped to buy
    // the barcode its height. Whoever puts a row back gets a failing test here
    // rather than a caption printed under the footer.
    expect(badgePdfLayout(4).bottom).toBeLessThanOrEqual(CARD_H_MM - CARD_FOOTER_MM);
  });
});
