import { expect, it } from 'vitest';
import { adjustmentTarget } from './inventory-adjustment-entry-data';
it('supports local counted zero, adds/removals and rejects unchanged/fractional/reserved quantities', () => {
  expect(adjustmentTarget('count', '0', 10, 0)).toMatchObject({ target: 0, delta: -10, error: '' });
  expect(adjustmentTarget('add', '3', 10, 2)).toMatchObject({ target: 13, delta: 3, error: '' });
  expect(adjustmentTarget('remove', '3', 10, 2)).toMatchObject({ target: 7, delta: -3, error: '' });
  for (const value of ['', '-1', '0.5', '10'])
    expect(adjustmentTarget('count', value, 10, 0).error).toBeTruthy();
  expect(adjustmentTarget('count', '1', 10, 2).error).toContain('reserved');
});

it('rejects invalid stock counts and unsafe correction deltas', () => {
  for (const [current, reserved] of [
    [NaN, 0],
    [10, -1],
    [10, 0.5],
    [10, Infinity],
  ])
    expect(adjustmentTarget('count', '4', current, reserved).error).toContain('Current stock');
  expect(adjustmentTarget('count', String(Number.MAX_SAFE_INTEGER), -10, 0).error).toContain(
    'too large',
  );
});
