import { venueRequest } from './api';
type CataloguePage<T> = { items: T[]; nextCursor?: string | null };
// Setup selectors need the complete owned catalogue, not only its first API page.
export async function collectCataloguePages<T>(token: string, path: string): Promise<{ items: T[] }> {
  const items: T[] = [];
  const seen = new Set<string>();
  let cursor: string | undefined;
  do {
    const url = cursor ? `${path}${path.includes('?') ? '&' : '?'}${new URLSearchParams({ cursor })}` : path;
    const page = await venueRequest<CataloguePage<T>>(token, url);
    if (!Array.isArray(page.items)) throw new Error('Invalid catalogue page. Reload the list.');
    items.push(...page.items);
    if (!page.nextCursor) return { items };
    if (seen.has(page.nextCursor)) throw new Error('Catalogue cursor repeated. Reload the list.');
    seen.add(page.nextCursor);
    cursor = page.nextCursor;
  } while (cursor);
  return { items };
}
