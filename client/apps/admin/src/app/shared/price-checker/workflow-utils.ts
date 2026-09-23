import { eligiblePricelists } from './form-utils';
import type { KioskInput, KioskOptions } from './types';
const DAY = 86400000;
export function datePreset(days: number, now = new Date()) {
  const to = new Date(now.getTime() + 3600000).toISOString().slice(0, 10);
  const from = new Date(Date.parse(`${to}T00:00:00Z`) - (days - 1) * DAY)
    .toISOString()
    .slice(0, 10);
  return { from, to };
}
export function reportDateError(from: string, to: string) {
  const valid = (s: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    Number.isFinite(Date.parse(s)) &&
    new Date(s).toISOString().slice(0, 10) === s;
  if (!valid(from) || !valid(to)) return 'Choose a valid start and end date.';
  const span = Date.parse(to) - Date.parse(from);
  if (span < 0) return 'The end date must be on or after the start date.';
  if (span >= 366 * DAY) return 'Choose a period of 366 days or fewer.';
  return '';
}
export function suggestedSlug(name: string) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120)
    .replace(/-$/, '');
}
export function setupError(input: KioskInput, options: KioskOptions) {
  if (!input.name.trim() || !input.internalId.trim()) return 'Enter a kiosk name and internal ID.';
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug))
    return 'Use lowercase letters, numbers and hyphens for the kiosk URL.';
  const shop = options.shops.find((row) => row._id === input.shopId);
  if (
    !shop ||
    !options.locations.some((row) => row._id === input.location) ||
    shop.location !== input.location
  )
    return 'Choose an active store with its assigned stock location.';
  if (
    input.pricelist &&
    !eligiblePricelists(options.pricelists, input.shopId, input.location, input.currency).some(
      (row) => row._id === input.pricelist
    )
  )
    return 'The selected pricelist is unavailable for this store and currency. Choose another or use automatic pricing.';
  if (
    !Number.isInteger(input.settings.resetSeconds) ||
    input.settings.resetSeconds < 3 ||
    input.settings.resetSeconds > 30
  )
    return 'Return-to-welcome time must be a whole number from 3 to 30 seconds.';
  if (input.settings.logo) {
    try {
      const url = new URL(input.settings.logo);
      if (url.protocol !== 'https:' || url.username || url.password) throw new Error();
    } catch {
      return 'Use an HTTPS logo URL without embedded credentials.';
    }
  }
  return '';
}
