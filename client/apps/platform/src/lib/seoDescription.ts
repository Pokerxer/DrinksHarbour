export function normalizeDescription(copy: string, fallback: string): string {
  const clean = (value: string) => value.replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/gi, '&').replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ').trim();
  let text = clean(copy) || clean(fallback);
  if (text.length < 120) {
    text = `${text.replace(/[.!?]+$/, '')}. Explore the range, compare bottles and prices, and buy drinks online with DrinksHarbour in Nigeria.`;
  }
  if (text.length <= 160) return text;
  const cut = text.slice(0, 160);
  const space = cut.lastIndexOf(' ');
  return `${cut.slice(0, space > 0 ? space : 159).trimEnd()}…`;
}
