import { jsonLdHtml } from '@/lib/jsonld';
import { GUIDE_ORIGIN } from './GuideMetadata';
import { getOccasionPage } from '@/lib/commercialPages';

type Props = {
  path: string;
  name: string;
  description: string;
  /** With items the page is an index: CollectionPage replaces WebPage. */
  collectionItems?: { name: string; url: string }[];
};

/**
 * WebPage/CollectionPage plus a BreadcrumbList built from the real URL depth:
 * /occasions/<occasion> gets Home → Occasions → occasion, a subpage gets the
 * occasion level between them instead of collapsing it. The leaf breadcrumb
 * name follows the visible nav wording, not the meta title.
 */
export default function GuideStructuredData({ path, name, description, collectionItems }: Props) {
  const url = `${GUIDE_ORIGIN}${path}`;
  const page = collectionItems?.length
    ? { '@context': 'https://schema.org', '@type': 'CollectionPage', name, description, url, inLanguage: 'en-NG', itemListElement: collectionItems.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.name, item: `${GUIDE_ORIGIN}${item.url}` })) }
    : { '@context': 'https://schema.org', '@type': 'WebPage', name, description, url, inLanguage: 'en-NG' };
  // /occasions/<slug>/<subpage> → occasion lookup for the parent crumb name.
  const occasionSlug = path.match(/^\/occasions\/([a-z-]+)\/[a-z-]+$/)?.[1];
  const occasion = occasionSlug ? getOccasionPage(occasionSlug) : undefined;
  const crumbs = [
    { '@type': 'ListItem', position: 1, name: 'Home', item: GUIDE_ORIGIN },
  ];
  if (path === '/occasions') {
    crumbs.push({ '@type': 'ListItem', position: 2, name: 'Occasions', item: url });
  } else {
    crumbs.push({ '@type': 'ListItem', position: 2, name: 'Occasions', item: `${GUIDE_ORIGIN}/occasions` });
    if (occasion) {
      crumbs.push({ '@type': 'ListItem', position: 3, name: occasion.label, item: `${GUIDE_ORIGIN}${occasion.path}` });
      crumbs.push({ '@type': 'ListItem', position: 4, name: name, item: url });
    } else {
      crumbs.push({ '@type': 'ListItem', position: 3, name, item: url });
    }
  }
  const schemas = [
    page,
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: crumbs },
  ];
  return <>{schemas.map((schema, index) => <script key={index} type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(schema) }} />)}</>;
}
