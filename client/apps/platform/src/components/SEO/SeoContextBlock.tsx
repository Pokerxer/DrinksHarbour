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
        Check the selected seller and bottle details before ordering. Read our <Link href="/authenticity-guarantee">authenticity and bottle-check guidance</Link> for questions about your purchase.
      </p>
      <nav aria-label={`${heading} links`}>
        {links.map((link) => <Link key={link.href} href={link.href}>{link.label}</Link>)}
      </nav>
    </section>
  );
}
