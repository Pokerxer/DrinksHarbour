export const BOTTLE_UNITS = ['bottles', 'cans', 'cases'] as const;
export type BottleUnit = typeof BOTTLE_UNITS[number];
export type BottleChoice = { name: string; productId?: string; slug?: string; image?: string; suggestedQuantity?: number };
export type BottleListItem = BottleChoice & { id: string; size: string; unit: BottleUnit; quantity: string };
const clean = (value: string) => value.trim().replace(/\s+/g, ' ');
const validQuantity = (value: string) => /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 9999;

export function validateBottleList(items: BottleListItem[]): string | undefined {
  if (items.length > 20) return 'Keep the list to 20 different entries.';
  for (const item of items) {
    if (!clean(item.name) || item.name.length > 120) return 'Enter a bottle name of up to 120 characters.';
    if (!validQuantity(item.quantity)) return 'Each quantity must be a whole number between 1 and 9999.';
    if (item.size.length > 60) return 'Keep each size description to 60 characters.';
    if (!BOTTLE_UNITS.includes(item.unit)) return 'Choose bottles, cans or cases for every entry.';
  }
}

export function addBottle(items: BottleListItem[], choice: BottleChoice): { items: BottleListItem[]; error?: string } {
  const name = clean(choice.name);
  if (!name || name.length > 120) return { items, error: 'Enter a bottle name of up to 120 characters.' };
  const count = choice.suggestedQuantity ?? 1;
  if (!Number.isSafeInteger(count) || count < 1 || count > 9999) return { items, error: 'Choose a whole quantity between 1 and 9999.' };
  const existing = items.find(item => !item.size.trim() && item.unit === 'bottles' &&
    (choice.productId ? item.productId === choice.productId : !item.productId && clean(item.name).toLowerCase() === name.toLowerCase()));
  if (existing) {
    if (!validQuantity(existing.quantity) || Number(existing.quantity) + count > 9999) return { items, error: 'Check this entry’s quantity before adding more.' };
    return { items: items.map(item => item.id === existing.id ? { ...item, quantity: String(Number(item.quantity) + count) } : item) };
  }
  if (items.length >= 20) return { items, error: 'Keep the list to 20 different entries.' };
  let next = 1; while (items.some(item => item.id === `bottle-${next}`)) next++;
  return { items: [...items, { ...choice, name, id: `bottle-${next}`, size: '', unit: 'bottles', quantity: String(count) }] };
}

export function describeBottleList(items: BottleListItem[]): string {
  if (!items.length || validateBottleList(items)) return '';
  return 'Bottle list:\n' + items.map(item => `${Number(item.quantity)} ${item.unit} — ${clean(item.name)} — ${clean(item.size) || 'size to confirm'} [${item.productId ? `catalogue: ${item.slug || item.productId}` : 'custom'}]`).join('\n');
}

export function bottleSummary(items: BottleListItem[]): string {
  if (validateBottleList(items)) return 'Check your list quantities.';
  return BOTTLE_UNITS.map(unit => {
    const count = items.filter(item => item.unit === unit).reduce((sum, item) => sum + Number(item.quantity), 0);
    return count ? `${count.toLocaleString('en-NG')} ${unit}` : '';
  }).filter(Boolean).join(' · ') || 'Your bottle list is empty.';
}

export function publicBottleChoices(payload: unknown, limit = 6): BottleChoice[] {
  if (!payload || typeof payload !== 'object') throw new Error('Invalid search response');
  const result = payload as { success?: boolean; data?: { products?: unknown } };
  if (result.success !== true || !Array.isArray(result.data?.products)) throw new Error('Invalid search response');
  const seen = new Set<string>();
  return result.data.products.flatMap((value: unknown): BottleChoice[] => {
    if (!value || typeof value !== 'object') return [];
    const item = value as Record<string, unknown>, id = item._id ?? item.id;
    if (typeof id !== 'string' || !/^[\w-]{1,80}$/.test(id) || seen.has(id) || typeof item.name !== 'string' || !clean(item.name) || item.name.length > 120 || typeof item.slug !== 'string' || !/^[\w-]+$/.test(item.slug)) return [];
    const imageValues = [item.primaryImage, ...(Array.isArray(item.thumbImage) ? item.thumbImage : []), ...(Array.isArray(item.images) ? item.images : []), item.image];
    const image = imageValues.map(value => typeof value === 'string' ? value : value && typeof value === 'object' && 'url' in value ? (value as { url: unknown }).url : undefined).find((value): value is string => {
      if (typeof value !== 'string' || value.length > 2048) return false;
      if (value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')) return true;
      try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; } catch { return false; }
    });
    seen.add(id);
    return [{ productId: id, name: clean(item.name), slug: item.slug, ...(image ? { image } : {}) }];
  }).slice(0, Math.min(20, Math.max(1, limit)));
}
