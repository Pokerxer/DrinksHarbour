import Link from 'next/link';

type StoreLink = { slug: string; name: string };

/** Complements the interactive directory with links available in initial HTML. */
export default async function StoreDirectoryLinks() {
  const api = process.env.NEXT_PUBLIC_API_URL;
  if (!api) return null;
  const stores: StoreLink[] = [];
  try {
    let page = 1;
    let pages = 1;
    do {
      const response = await fetch(`${api}/api/stores?page=${page}&limit=48`, { next: { revalidate: 300 } });
      if (!response.ok) return null;
      const payload = await response.json();
      if (!Array.isArray(payload?.data?.stores)) return null;
      for (const store of payload.data.stores) {
        if (typeof store.slug === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(store.slug) && typeof store.name === 'string') {
          stores.push({ slug: store.slug, name: store.name });
        }
      }
      pages = Number(payload.data.pagination?.pages) || 1;
      page++;
    } while (page <= pages);
  } catch { return null; }
  if (!stores.length) return null;
  return <section className="container mx-auto px-4 py-8" aria-labelledby="store-directory-heading">
    <h2 id="store-directory-heading" className="mb-4 text-xl font-semibold">Browse stores by name</h2>
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {stores.map(store => <li key={store.slug}><Link prefetch={false} className="underline" href={`/vendors/${store.slug}`}>{store.name}</Link></li>)}
    </ul>
  </section>;
}
