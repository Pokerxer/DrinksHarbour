import { expect, it } from 'vitest';
import { createScanner } from './scanner';

it('discards the entire overflowing scan rather than looking up its trailing suffix', () => {
  const scanner = createScanner();
  for (const key of 'A'.repeat(129) + '00123') scanner.feed(key, 10);
  expect(scanner.feed('Enter', 11)).toBeNull();
  for (const key of '00123') scanner.feed(key, 20);
  expect(scanner.feed('Enter', 21)).toBe('00123');
});

it('recovers from overflow when explicitly cleared or a fresh scan starts after inactivity', () => {
  const scanner = createScanner();
  for (const key of 'A'.repeat(129)) scanner.feed(key, 0);
  scanner.clear();
  for (const key of '00123') scanner.feed(key, 10);
  expect(scanner.feed('Enter', 11)).toBe('00123');
  for (const key of 'A'.repeat(129)) scanner.feed(key, 100);
  for (const key of '00456') scanner.feed(key, 2000);
  expect(scanner.feed('Enter', 2001)).toBe('00456');
});
