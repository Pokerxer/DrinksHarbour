import type { Metadata } from "next";
import { type ContentBlock } from "../data";
import { getPostBySlug } from "../api";
import ReadingProgress from "./ReadingProgress";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://www.drinksharbour.com";
const SITE_NAME = "DrinksHarbour";

function blocksToPlainText(blocks: ContentBlock[]): string {
  return blocks.map(b => {
    if (b.text) return b.text;
    if (b.items) return b.items.join(". ");
    return "";
  }).join("\n\n");
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function readTimeToDuration(readTime: string): string {
  const match = readTime.match(/(\d+)\s*min/);
  if (match) return `PT${match[1]}M`;
  return "PT5M";
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return { title: "Article not found" };

  return {
    title: `${post.title} | DrinksHarbour Blog`,
    description: post.excerpt,
    robots: { index: true, follow: true },
    alternates: {
      canonical: `${BASE_URL}/blog/${slug}`,
      languages: { "en-NG": `${BASE_URL}/blog/${slug}` },
    },
    openGraph: {
      type: "article",
      url: `${BASE_URL}/blog/${slug}`,
      siteName: SITE_NAME,
      title: `${post.title} | DrinksHarbour Blog`,
      description: post.excerpt,
      images: [{ url: post.image, width: 1200, height: 630, alt: post.title }],
      locale: "en_NG",
      publishedTime: post.isoDate,
      modifiedTime: post.isoDate,
      authors: [post.author.name],
      tags: post.tags,
    },
    twitter: {
      card: "summary_large_image",
      site: "@DrinkHarbour",
      title: `${post.title} | DrinksHarbour Blog`,
      description: post.excerpt,
      images: [post.image],
    },
  };
}

export default async function BlogPostLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return <>{children}</>;

  const bodyText = blocksToPlainText(post.content);
  const wordCount = countWords(bodyText);

  const articleJsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    image: { "@type": "ImageObject", url: post.image, width: 1200, height: 630 },
    thumbnailUrl: post.image,
    datePublished: post.isoDate,
    dateModified: post.isoDate,
    author: {
      "@type": "Person",
      name: post.author.name,
      description: post.author.role,
      url: `${BASE_URL}/blog?q=${encodeURIComponent(post.author.name)}`,
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: BASE_URL,
      logo: { "@type": "ImageObject", url: `${BASE_URL}/logo.png` },
      sameAs: [
        "https://twitter.com/DrinkHarbour",
        "https://instagram.com/drinksharbour",
        "https://facebook.com/drinksharbour",
      ],
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": `${BASE_URL}/blog/${slug}` },
    isPartOf: {
      "@type": "Blog",
      "@id": `${BASE_URL}/blog`,
      name: "DrinksHarbour Blog",
    },
    keywords: post.tags.join(", "),
    articleSection: post.category,
    about: post.tags.map(t => ({ "@type": "Thing", name: t })),
    wordCount,
    timeRequired: readTimeToDuration(post.readTime),
    articleBody: bodyText,
    inLanguage: "en-NG",
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: BASE_URL },
      { "@type": "ListItem", position: 2, name: "Blog", item: `${BASE_URL}/blog` },
      { "@type": "ListItem", position: 3, name: post.title, item: `${BASE_URL}/blog/${slug}` },
    ],
  };

  return (
    <>
      <link rel="preconnect" href="https://images.unsplash.com" crossOrigin="anonymous" />
      <link rel="dns-prefetch" href="https://images.unsplash.com" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <ReadingProgress />
      {children}
    </>
  );
}