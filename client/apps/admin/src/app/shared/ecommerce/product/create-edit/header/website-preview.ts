/** The platform resolves products by their saved catalogue slug, never admin ID. */
export function productWebsiteUrl(slug?: string): string | null {
  if (!slug?.trim()) return null;
  try {
    const platform = new URL(
      process.env.NEXT_PUBLIC_PLATFORM_URL || 'https://drinksharbour.com'
    );
    if (!['https:', 'http:'].includes(platform.protocol)) return null;
    return new URL(`/product/${encodeURIComponent(slug.trim())}`, platform).href;
  } catch {
    return null;
  }
}
