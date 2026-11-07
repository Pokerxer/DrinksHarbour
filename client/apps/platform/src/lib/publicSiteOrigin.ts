const DEFAULT_ORIGIN = 'https://www.drinksharbour.com';

/** Public metadata uses a clean origin; official domains always use HTTPS www. */
export function publicSiteOrigin(input = process.env.NEXT_PUBLIC_BASE_URL): string {
  try {
    const url = new URL(input || DEFAULT_ORIGIN);
    if (!['http:', 'https:'].includes(url.protocol)) return DEFAULT_ORIGIN;
    if (['drinksharbour.com', 'www.drinksharbour.com'].includes(url.hostname)) return DEFAULT_ORIGIN;
    if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) url.protocol = 'https:';
    return url.origin;
  } catch {
    return DEFAULT_ORIGIN;
  }
}
