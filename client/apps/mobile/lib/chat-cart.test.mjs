import { describe, expect, test } from 'vitest';
import { buildCartConfirmation, clampProposedQuantity, describeAddedLine } from './chat-cart.ts';

/**
 * What the assistant says after acting on its own cart offer, ported from
 * `ChatbotWidget.tsx:660-680`. The text matters: it is the only confirmation
 * the shopper gets that money-shaped things happened.
 */

describe('clampProposedQuantity', () => {
  test('takes the proposed quantity when the size allows it', () => {
    expect(clampProposedQuantity(3, { stock: 10 })).toBe(3);
  });

  test('never goes below the size\'s minimum order quantity', () => {
    expect(clampProposedQuantity(1, { stock: 10, minOrderQuantity: 6 })).toBe(6);
  });

  test('never exceeds the maximum order quantity', () => {
    expect(clampProposedQuantity(50, { stock: 99, maxOrderQuantity: 12 })).toBe(12);
  });

  test('falls back to stock when there is no explicit maximum', () => {
    expect(clampProposedQuantity(50, { stock: 4 })).toBe(4);
  });

  test('a missing or zero quantity becomes 1, never 0', () => {
    expect(clampProposedQuantity(0, { stock: 10 })).toBe(1);
    expect(clampProposedQuantity(undefined, { stock: 10 })).toBe(1);
  });
});

describe('describeAddedLine', () => {
  test('reads back quantity, name and size', () => {
    expect(describeAddedLine(2, 'Lagavulin 16', '70cl')).toBe('2 × **Lagavulin 16** (70cl)');
  });

  test('omits the bracket when the size is unknown', () => {
    expect(describeAddedLine(1, 'Lagavulin 16', '')).toBe('1 × **Lagavulin 16**');
  });
});

describe('buildCartConfirmation', () => {
  test('lists what went in', () => {
    const message = buildCartConfirmation(['2 × **Lagavulin 16** (70cl)'], []);

    expect(message).toContain('✅');
    expect(message).toContain('• 2 × **Lagavulin 16** (70cl)');
    expect(message).toContain('[View cart](/cart)');
  });

  test('names what could NOT be added, alongside what could', () => {
    const message = buildCartConfirmation(['1 × **Gin**'], ['Rare Macallan']);

    expect(message).toContain('• 1 × **Gin**');
    expect(message).toContain('**Rare Macallan**');
    expect(message).toContain('⚠️');
  });

  test('when nothing was added it says so instead of claiming success', () => {
    const message = buildCartConfirmation([], ['Rare Macallan', 'Vintage Port']);

    expect(message).not.toContain('✅');
    expect(message).toContain('⚠️');
    expect(message).toContain('**Rare Macallan**, **Vintage Port**');
  });

  test('links to the cart only when something is actually in it', () => {
    expect(buildCartConfirmation([], ['x'])).not.toContain('[View cart](/cart)');
  });
});
