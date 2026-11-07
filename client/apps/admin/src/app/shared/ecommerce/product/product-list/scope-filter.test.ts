import { expect, it } from 'vitest';
import {
  matchesPublicationScope,
  type PublicationScopeFilterValue,
} from './scope-filter';

// Cover the four contract cases of the visibility (publication-scope) facet.
const rows = [
  { id: 'legacy', publicationScope: undefined },
  { id: 'canonical', publicationScope: 'canonical' },
  { id: 'private', publicationScope: 'tenant_private' },
] as const;

it('does not change results when the facet is on its default "all" state', () => {
  for (const row of rows) {
    expect(
      matchesPublicationScope(row.publicationScope, 'all' as PublicationScopeFilterValue)
    ).toBe(true);
  }
});

it('buckets DEFAULT (absent) rows as "marketplace" only when explicitly selected', () => {
  expect(
    matchesPublicationScope(undefined, 'marketplace' as PublicationScopeFilterValue)
  ).toBe(true);
});

it('buckets canonical rows as "marketplace"', () => {
  expect(
    matchesPublicationScope('canonical', 'marketplace' as PublicationScopeFilterValue)
  ).toBe(true);
});

it('buckets only tenant_private rows as "private"', () => {
  expect(
    matchesPublicationScope(
      'tenant_private',
      'private' as PublicationScopeFilterValue
    )
  ).toBe(true);
  expect(
    matchesPublicationScope('canonical', 'private' as PublicationScopeFilterValue)
  ).toBe(false);
  expect(
    matchesPublicationScope(undefined, 'private' as PublicationScopeFilterValue)
  ).toBe(false);
});
