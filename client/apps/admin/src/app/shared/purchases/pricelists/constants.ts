// app/shared/purchases/pricelists/constants.ts
export const CURRENCIES = ['NGN', 'USD', 'EUR', 'GBP'] as const;
export type Currency = (typeof CURRENCIES)[number];
export type SortKey = 'name' | 'vendor' | 'items' | 'recent';
