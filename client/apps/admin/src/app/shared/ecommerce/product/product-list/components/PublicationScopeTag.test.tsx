// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import PublicationScopeTag, { getApproveCopy } from './PublicationScopeTag';

afterEach(cleanup);

it('renders nothing for legacy rows without a publication scope', () => {
  const { container } = render(<PublicationScopeTag />);
  expect(container.textContent).toBe('');
  const { container: withUndefined } = render(
    <PublicationScopeTag publicationScope={undefined} />
  );
  expect(withUndefined.textContent).toBe('');
  expect(screen.queryByText('Marketplace')).toBeNull();
  expect(screen.queryByText('Store-only')).toBeNull();
  expect(getApproveCopy(undefined).explanation).toBeNull();
  expect(getApproveCopy(undefined).label).toBe('Approved');
});

it('flags canonical identities as Marketplace', () => {
  render(<PublicationScopeTag publicationScope="canonical" />);
  expect(screen.getByText('Marketplace')).toBeTruthy();
});

it('flags tenant-private rows as Store-only with the owning tenant when known', () => {
  render(
    <PublicationScopeTag
      publicationScope="tenant_private"
      owningTenantName="Havour Wine"
    />
  );
  expect(screen.getByText('Store-only · Havour Wine')).toBeTruthy();

  cleanup();
  render(<PublicationScopeTag publicationScope="tenant_private" />);
  expect(screen.getByText('Store-only')).toBeTruthy();
});

it('uses promotion wording for approving a tenant-private product', () => {
  const copy = getApproveCopy('tenant_private');
  expect(copy.label).toBe('Approve & publish to marketplace');
  expect(copy.explanation).toContain('Payout and commission rules are unchanged');
});
