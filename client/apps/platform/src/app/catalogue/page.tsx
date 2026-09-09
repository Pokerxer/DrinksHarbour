import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';
const BASE = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.drinksharbour.com';
export const metadata: Metadata = {
  title: 'Drinks A–Z: Browse the Catalogue',
  description: 'Find drinks by name in the DrinksHarbour A–Z catalogue. Browse wines, spirits and more, then open a bottle’s page to see prices and buying options.',
  alternates: { canonical: `${BASE}/catalogue` },
};

export default async function CataloguePage() {
  // This is the central marketplace catalogue, not a tenant inventory view.
  if ((await headers()).get('x-tenant-slug')) notFound();
  const api = process.env.NEXT_PUBLIC_API_URL;
  if (!api) throw new Error('Catalogue API is not configured');
  const response = await fetch(`${api}/api/products/slugs`, { next: { revalidate: 300 } });
  if (!response.ok) throw new Error('Catalogue is temporarily unavailable');
  const payload = await response.json();
  if (!Array.isArray(payload?.data?.slugs)) throw new Error('Invalid catalogue response');
  // Same visibility authority as the XML sitemap: public, sellable products.
  const slugs = Array.from(new Set<string>(payload.data.slugs.filter(
    (slug: unknown): slug is string => typeof slug === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug),
  ))).sort();
  const groups = new Map<string, string[]>();
  for (const slug of slugs) {
    const letter = /^[a-z]/.test(slug) ? slug[0].toUpperCase() : '0–9';
    groups.set(letter, [...(groups.get(letter) || []), slug]);
  }
  return (
    <main className="container mx-auto space-y-8 px-4 py-12">
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold">Drinks A–Z</h1>
        <p>Find a bottle by name, then check its current prices and available sizes.</p>
        <Link className="underline" href="/shop">Shop drinks with filters and photos</Link>
      </div>
      <nav aria-label="Catalogue letters" className="flex flex-wrap gap-4">
        {Array.from(groups.keys()).map(letter => <a key={letter} href={`#letter-${letter}`} className="underline">{letter}</a>)}
      </nav>
      {Array.from(groups.entries()).map(([letter, entries]) => (
        <section key={letter} id={`letter-${letter}`} aria-labelledby={`heading-${letter}`}>
          <h2 id={`heading-${letter}`} className="mb-4 text-2xl font-semibold">{letter}</h2>
          <ul className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            {entries.map(slug => <li key={slug}>
              <Link prefetch={false} className="capitalize underline underline-offset-4" href={`/product/${slug}`}>
                {slug.replace(/-\d{13}$/, '').replace(/-/g, ' ')}
              </Link>
            </li>)}
          </ul>
        </section>
      ))}
    </main>
  );
}
