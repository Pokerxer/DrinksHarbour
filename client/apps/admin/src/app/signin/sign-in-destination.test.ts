import { expect, test } from 'vitest';
import { signInDestination } from './sign-in-destination';

const origin = 'http://localhost:3000';
const destination = (value: string) => signInDestination('?callbackUrl=' + encodeURIComponent(value), origin);

test('returns to document settings and preserves document query options', () => {
  expect(destination('/settings/document-templates')).toBe(origin + '/settings/document-templates');
  expect(destination('/sales/123/print?type=proforma')).toBe(origin + '/sales/123/print?type=proforma');
  expect(destination(origin + '/settings/document-templates')).toBe(origin + '/settings/document-templates');
});
test.each(['https://evil.example', '//evil.example', '/\\evil.example', 'javascript:alert(1)', '/signin?callbackUrl=/signin', '/api/auth/signin'])('rejects unsafe or looping destination %s', value => {
  expect(destination(value)).toBe(signInDestination('', origin));
});
