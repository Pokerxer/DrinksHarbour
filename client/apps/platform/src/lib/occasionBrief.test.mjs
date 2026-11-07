import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareOccasionBrief, nigeriaDate } from './occasionBrief.ts';

const empty = { occasion: 'weddings', city: '', date: '', guests: '', budget: '', notes: '' };

test('city and an existing occasion are required, without inventing other brief details', () => {
  assert.equal(prepareOccasionBrief(empty, '2026-10-20').ok, false);
  assert.equal(prepareOccasionBrief({ ...empty, city: 'Abuja', occasion: 'unknown' }, '2026-10-20').ok, false);
  const result = prepareOccasionBrief({ ...empty, city: '  Abuja  ' }, '2026-10-20');
  assert.equal(result.ok, true);
  assert.match(result.message, /Occasion: Weddings/);
  assert.match(result.message, /Delivery city: Abuja/);
  assert(!/Guests:|Budget:|Preferred date:/.test(result.message));
});

test('past, impossible and malformed dates are rejected using Nigeria today', () => {
  for (const date of ['2026-10-19', '2027-02-30', 'tomorrow', '2026-13-01']) {
    const result = prepareOccasionBrief({ ...empty, city: 'Lagos', date }, '2026-10-20');
    assert.equal(result.ok, false, date);
    assert(result.errors.date);
  }
  assert.equal(prepareOccasionBrief({ ...empty, city: 'Lagos', date: '2026-10-20' }, '2026-10-20').ok, true);
});

test('guest counts and budgets reject invalid numbers and preserve a real event brief', () => {
  for (const change of [{ guests: '0' }, { guests: '2.5' }, { guests: '-4' }, { budget: '-2000' }, { budget: 'NaN' }, { budget: '100.999' }]) {
    assert.equal(prepareOccasionBrief({ ...empty, city: 'Lagos', ...change }, '2026-10-20').ok, false);
  }
  const result = prepareOccasionBrief({ ...empty, occasion: 'corporate', city: 'Lagos', date: '2026-12-12', guests: '80', budget: '250000', notes: 'No gift wrapping needed.' }, '2026-10-20');
  assert.equal(result.ok, true);
  assert.match(result.message, /Occasion: Corporate events/);
  assert.match(result.message, /Guests: 80/);
  assert.match(result.message, /Budget: NGN 250,000/);
  assert.match(result.message, /Preferred date: 2026-12-12/);
  assert.match(result.message, /No gift wrapping needed/);
});

test('Nigeria date advances at Lagos midnight independently of the host timezone', () => {
  assert.equal(nigeriaDate(new Date('2026-10-20T23:30:00Z')), '2026-10-21');
  assert.equal(nigeriaDate(new Date('2026-10-20T22:30:00Z')), '2026-10-20');
});
