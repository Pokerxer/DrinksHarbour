import { describe, expect, it } from 'vitest';
import { buildPrintBody } from './pos-receipt-print';

const CONTENT = '<div id="receipt">TOTAL ₦4,000</div>';

// The copies setting is a number a human types into a settings box. Everything
// it can arrive as — undefined from an old tenant document, 0, a float, or a
// fat-fingered 50 — must resolve to something printable rather than a blank
// slip or fifty of them.
describe('buildPrintBody', () => {
  it('renders a single copy bare, with no wrapper', () => {
    // The wrapper class carries the page-break; wrapping a single copy would
    // add a trailing blank page on every receipt.
    expect(buildPrintBody(CONTENT, 1)).toBe(CONTENT);
  });

  it('wraps each copy in a page-break container', () => {
    const body = buildPrintBody(CONTENT, 3);
    // The break itself is CSS on .dh-receipt-copy in RECEIPT_STYLES; here we
    // pin that every copy carries the class the stylesheet targets.
    expect(body.match(/dh-receipt-copy/g)).toHaveLength(3);
  });

  it('clamps to 5 copies', () => {
    const body = buildPrintBody(CONTENT, 50);
    expect(body.match(/dh-receipt-copy/g)).toHaveLength(5);
  });

  it('treats 0 and negatives as one copy', () => {
    expect(buildPrintBody(CONTENT, 0)).toBe(CONTENT);
    expect(buildPrintBody(CONTENT, -2)).toBe(CONTENT);
  });

  it('floors fractional copies', () => {
    expect(buildPrintBody(CONTENT, 2.9)).toBe(buildPrintBody(CONTENT, 2));
  });

  it('falls back to one copy for NaN / undefined', () => {
    expect(buildPrintBody(CONTENT, Number.NaN)).toBe(CONTENT);
    expect(
      buildPrintBody(CONTENT, undefined as unknown as number)
    ).toBe(CONTENT);
  });
});
