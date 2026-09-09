export function buildBrandDescription(name: string, copy = ''): string {
  const brand = name.replace(/\s+/g, ' ').trim();
  const editorial = copy.replace(/\s+/g, ' ').trim();
  const text = editorial.length >= 120
    ? editorial
    : `Shop ${brand} drinks online in Nigeria. Explore the range, compare bottles and prices, and order with delivery from DrinksHarbour.`;
  if (text.length <= 160) return text;
  const shortened = text.slice(0, 160);
  const boundary = shortened.lastIndexOf(' ');
  return `${shortened.slice(0, boundary > 0 ? boundary : 159).trimEnd()}…`;
}
