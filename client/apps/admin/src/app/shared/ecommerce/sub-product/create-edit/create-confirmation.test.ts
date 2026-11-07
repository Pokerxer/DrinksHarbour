import { describe, expect, it } from 'vitest';
import {
  CREATE_CONFIRMATION_LEGACY,
  TENANT_PRIVATE_CREATE_CONFIRMATION,
  getCreateConfirmationMessage,
} from './create-confirmation';

describe('sub-product create confirmation copy', () => {
  it('legacy payloads (no publicationScope) keep the historic wording byte-for-byte', () => {
    // Flag-off server: status pending, NO publicationScope field.
    expect(
      getCreateConfirmationMessage({ name: 'Amber Lager', status: 'pending' })
    ).toBe('Sub Product created successfully!');
    expect(getCreateConfirmationMessage(undefined)).toBe(
      CREATE_CONFIRMATION_LEGACY
    );
    expect(getCreateConfirmationMessage(null)).toBe(CREATE_CONFIRMATION_LEGACY);
    // The constant itself is the pinned historic string.
    expect(CREATE_CONFIRMATION_LEGACY).toBe('Sub Product created successfully!');
  });

  it('approved canonical identities keep the existing wording unchanged', () => {
    expect(
      getCreateConfirmationMessage({
        name: 'Amber Lager',
        status: 'approved',
        publicationScope: 'canonical',
      })
    ).toBe(CREATE_CONFIRMATION_LEGACY);
  });

  it('an unpopulated product id (string) reads as legacy-canon', () => {
    expect(getCreateConfirmationMessage('6abf1c2d3e4f5a6b7c8d9e0f')).toBe(
      CREATE_CONFIRMATION_LEGACY
    );
  });

  it('explicit tenant_private identities confirm immediate sellability', () => {
    expect(
      getCreateConfirmationMessage({
        name: 'Amber Lager',
        status: 'pending',
        publicationScope: 'tenant_private',
      })
    ).toBe(
      '"Amber Lager" created and sellable in your store right away — DrinksHarbour reviews marketplace publication'
    );
    expect(TENANT_PRIVATE_CREATE_CONFIRMATION).toContain('sellable');
    expect(TENANT_PRIVATE_CREATE_CONFIRMATION).toContain('reviews');
    expect(TENANT_PRIVATE_CREATE_CONFIRMATION).not.toContain('owningTenant');
  });

  it('private confirmation falls back to a neutral identity label when unnamed', () => {
    expect(getCreateConfirmationMessage({ publicationScope: 'tenant_private' })).toBe(
      'New product created and sellable in your store right away — DrinksHarbour reviews marketplace publication'
    );
  });

  it('unknown scope values never trigger the private copy', () => {
    expect(
      getCreateConfirmationMessage({
        publicationScope: 'future-scope',
        status: 'pending',
      })
    ).toBe(CREATE_CONFIRMATION_LEGACY);
  });
});
