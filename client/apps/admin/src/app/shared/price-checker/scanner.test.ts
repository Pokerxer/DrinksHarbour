import { describe, it, expect } from 'vitest';
import {
  createScanner,
  validBarcode,
  latestScan,
} from '../../../components/price-checker/scanner';
import {
  proxyAction,
  sameOrigin,
} from '../../../components/price-checker/proxy-policy';
describe('keyboard scanner', () => {
  it('preserves leading zeros, accepts Enter and consumes its buffer once', () => {
    const scanner = createScanner();
    for (const key of '00123') scanner.feed(key, 100);
    expect(scanner.feed('Enter', 110)).toBe('00123');
    expect(scanner.feed('Enter', 111)).toBeNull();
  });
  it('ignores short input and expires abandoned input', () => {
    const scanner = createScanner();
    for (const key of '123') scanner.feed(key, 0);
    expect(scanner.feed('Enter', 1)).toBeNull();
    for (const key of '12345') scanner.feed(key, 10);
    expect(scanner.feed('Enter', 5000)).toBeNull();
  });
  it('Shift does not truncate a scanner barcode and cooldown only affects the same code', () => {
    const scanner = createScanner();
    for (const key of ['0', '0', 'Shift', 'A', 'B', 'C']) scanner.feed(key, 100);
    expect(scanner.feed('Enter', 101)).toBe('00ABC');
    for (const key of '00ABC') scanner.feed(key, 110);
    expect(scanner.feed('Enter', 111)).toBeNull();
    for (const key of '00ABD') scanner.feed(key, 120);
    expect(scanner.feed('Enter', 121)).toBe('00ABD');
  });
  it('validates manual codes and bounds scanner input', () => {
    expect(validBarcode(' 00123 ')).toBe('00123');
    expect(validBarcode('12')).toBeNull();
    expect(validBarcode('a'.repeat(129))).toBeNull();
    expect(validBarcode('001\n23')).toBeNull();
  });
  it('superseded responses and reset callbacks cannot overwrite a newer scan', () => {
    const latest = latestScan();
    const first = latest.begin();
    const second = latest.begin();
    expect(latest.isCurrent(first)).toBe(false);
    expect(latest.isCurrent(second)).toBe(true);
    latest.begin();
    expect(latest.isCurrent(second)).toBe(false);
  });
});
describe('same-origin kiosk proxy', () => {
  it('accepts only fixed public operations and never administrative paths', () => {
    expect(proxyAction(['shop-one', 'session'])).toEqual({ slug: 'shop-one', action: 'session' });
    expect(proxyAction(['kiosks', 'delete', 'id'])).toBeNull();
    expect(proxyAction(['../admin', 'scan'])).toBeNull();
    expect(proxyAction(['shop-one', 'kiosks'])).toBeNull();
  });
  it('refuses cross-site and missing origins', () => {
    expect(sameOrigin('https://www.drinksharbour.com', 'https://www.drinksharbour.com/api/x')).toBe(
      true
    );
    expect(sameOrigin('https://evil.test', 'https://www.drinksharbour.com/api/x')).toBe(false);
    expect(sameOrigin(null, 'https://www.drinksharbour.com/api/x')).toBe(false);
  });
});

it('origin validation uses the requested host when Next normalizes its internal URL', () => {
  expect(sameOrigin('http://127.0.0.1:3107', 'http://localhost:3107/api/x', '127.0.0.1:3107')).toBe(
    true
  );
  expect(
    sameOrigin('https://foreign.invalid', 'http://localhost:3107/api/x', '127.0.0.1:3107')
  ).toBe(false);
});
