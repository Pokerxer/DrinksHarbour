import Link from 'next/link';

type SeoContextBlockProps = {
  heading: string;
  paragraphs: string[];
  links: Array<{ href: string; label: string }>;
};

/** Crawlable, screen-reader-friendly context that does not alter visual layout. */
export default function SeoContextBlock({ heading, paragraphs, links }: SeoContextBlockProps) {
  const headingId = `seo-context-${heading.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'page'}`;
  return (
    <section className="sr-only" aria-labelledby={headingId}>
      <h2 id={headingId}>{heading}</h2>
      {paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
      <p>
        DrinksHarbour sells original, authentic products sourced through verified channels. We do not sell counterfeit drinks, and products are checked before dispatch.
      </p>
      <nav aria-label={`${heading} links`}>
        {links.map((link) => <Link key={link.href} href={link.href}>{link.label}</Link>)}
      </nav>
    </section>
  );
}
