'use strict';
// Pure (no-DB, no-network) tests for the gift-checkout config helpers:
// requested-delivery-date bounds and the gift subdoc normaliser.
// Contract: docs/superpowers/specs/2026-10-27-gift-checkout-design.md

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  assertRequestedDeliveryDate,
  normalizeGiftSubdoc,
  lagosDayStart,
  GIFT_DATE_MAX_DAYS,
} = require('../config/giftPackaging');

const DAY_MS = 24 * 60 * 60 * 1000;
// A Lagos date, rendered from today's Lagos day-start (UTC+1, no DST).
const lagosOffsetDate = (days) => new Date(lagosDayStart() + days * DAY_MS).toISOString().slice(0, 10);

test('requested delivery date format', () => {
  assert.throws(() => assertRequestedDeliveryDate('2026/11/01'), /YYYY-MM-DD/);
  assert.throws(() => assertRequestedDeliveryDate('01-11-2026'), /YYYY-MM-DD/);
  assert.throws(() => assertRequestedDeliveryDate('2026-11-01T00:00:00Z'), /YYYY-MM-DD/);
  assert.throws(() => assertRequestedDeliveryDate(20261101), /YYYY-MM-DD/);
  assert.throws(() => assertRequestedDeliveryDate(undefined), /YYYY-MM-DD/);
  assert.throws(() => assertRequestedDeliveryDate(''), /YYYY-MM-DD/);
});

test('requested delivery date must be a real calendar date', () => {
  assert.throws(() => assertRequestedDeliveryDate('2026-02-31'), /calendar date/);
  assert.throws(() => assertRequestedDeliveryDate('2026-13-01'), /calendar date/);
  assert.throws(() => assertRequestedDeliveryDate('2026-00-10'), /calendar date/);
});

test('requested delivery date must be at least tomorrow (Lagos)', () => {
  assert.throws(() => assertRequestedDeliveryDate(lagosOffsetDate(-1)), /tomorrow/);
  assert.throws(() => assertRequestedDeliveryDate(lagosOffsetDate(0)), /tomorrow/);
  assert.doesNotThrow(() => assertRequestedDeliveryDate(lagosOffsetDate(1)));
});

test('requested delivery date may be at most 180 days ahead (Lagos)', () => {
  assert.equal(GIFT_DATE_MAX_DAYS, 180);
  assert.doesNotThrow(() => assertRequestedDeliveryDate(lagosOffsetDate(180)));
  assert.throws(() => assertRequestedDeliveryDate(lagosOffsetDate(181)), /180 days/);
  assert.throws(() => assertRequestedDeliveryDate(lagosOffsetDate(365)), /180 days/);
});

test('normalizeGiftSubdoc keeps only complete, contract-shaped gifts', () => {
  const valid = normalizeGiftSubdoc({
    isGift: true,
    from: '  Ada  ',
    to: 'Chinedu',
    message: 'Happy birthday!',
    requestedDeliveryDate: lagosOffsetDate(3),
    packagingRequested: true,
  });
  assert.deepEqual(valid, {
    isGift: true,
    from: 'Ada',
    to: 'Chinedu',
    message: 'Happy birthday!',
    requestedDeliveryDate: lagosOffsetDate(3),
    packagingRequested: true,
  });
});

test('normalizeGiftSubdoc defaults message to empty and packaging to false', () => {
  const gift = normalizeGiftSubdoc({
    isGift: true,
    from: 'A',
    to: 'B',
    requestedDeliveryDate: lagosOffsetDate(2),
    packagingRequested: 'yes',
  });
  assert.equal(gift.message, '');
  assert.equal(gift.packagingRequested, false);
});

test('normalizeGiftSubdoc refuses incomplete or wrong-typed gifts', () => {
  for (const bad of [
    undefined,
    null,
    {},
    { isGift: false, from: 'a', to: 'b', requestedDeliveryDate: lagosOffsetDate(2) },
    { isGift: true, from: '   ', to: 'b', requestedDeliveryDate: lagosOffsetDate(2) },
    { isGift: true, from: 'a', to: '', requestedDeliveryDate: lagosOffsetDate(2) },
    { isGift: true, from: 'a', to: 'b', requestedDeliveryDate: 'not-a-date' },
  ]) {
    assert.equal(normalizeGiftSubdoc(bad), undefined, `accepted ${JSON.stringify(bad)}`);
  }
});

test('normalizeGiftSubdoc clamps the message to the 500-char cap', () => {
  const gift = normalizeGiftSubdoc({
    isGift: true, from: 'a', to: 'b',
    message: 'x'.repeat(600),
    requestedDeliveryDate: lagosOffsetDate(2),
  });
  assert.equal(gift.message.length, 500);
});

test('the recipient phone stays separate from the buyer contact and normalizes for staff', () => {
  const gift = {
    isGift: true, from: 'Ada', to: 'Chinedu',
    requestedDeliveryDate: lagosOffsetDate(2),
  };
  assert.equal(normalizeGiftSubdoc({ ...gift, recipientPhone: '+234 803 123 4567' }).recipientPhone, '+2348031234567');
  assert.equal(normalizeGiftSubdoc(gift).recipientPhone, undefined);
  assert.equal(normalizeGiftSubdoc({ ...gift, recipientPhone: 'call my office' }).recipientPhone, undefined);
});
