import {
  type ChannelConfiguration,
  type SalesChannel,
} from '@/services/market-foundation.service';
export const blank = (): ChannelConfiguration => ({
  tenant: null,
  code: '',
  kind: 'marketplace',
  market: 'NG',
  currency: 'NGN',
  active: false,
  legalOwner: { type: 'platform', reference: '' },
  paymentOwner: {
    type: 'platform',
    reference: '',
    provider: 'paystack',
    account: '',
  },
  pricingPolicy: { code: '', version: 1, termsReference: '' },
});
export function configuration(row: SalesChannel): ChannelConfiguration {
  const keys = [
    'tenant',
    'code',
    'kind',
    'market',
    'currency',
    'active',
    'legalOwner',
    'paymentOwner',
    'allowedPaymentOwners',
    'pricingPolicy',
    'storefrontChannel',
    'apiKey',
    'location',
  ] as const;
  return Object.fromEntries(
    keys.filter((key) => row[key] !== undefined).map((key) => [key, row[key]])
  ) as unknown as ChannelConfiguration;
}
