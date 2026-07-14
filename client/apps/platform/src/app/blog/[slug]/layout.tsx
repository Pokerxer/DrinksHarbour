import type { Metadata } from "next";
import { type ContentBlock } from "../data";
import { getPostBySlug } from "../api";
import ReadingProgress from "./ReadingProgress";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://www.drinksharbour.com";
const SITE_NAME = "DrinksHarbour";

// Strip inline markdown so structured-data body text is clean prose for crawlers:
//   [anchor](/slug) → anchor,  **bold** → bold,  *italic* → italic
function stripInlineMarkdown(text: string): string {
  return String(text || "")
    .replace(/\[([^\]]+)\]\((\/[^)\s]+)\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1");
}

function blocksToPlainText(blocks: ContentBlock[]): string {
  return blocks
    .map(b => {
      if (b.type === "image") return b.caption ? stripInlineMarkdown(b.caption) : "";
      if (b.text) return stripInlineMarkdown(b.text);
      if (b.items) return b.items.map(stripInlineMarkdown).join(". ");
      return "";
    })
    .filter(Boolean)
    .join("\n\n");
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

  const metaTitle = post.seo?.metaTitle || `${post.title} | DrinksHarbour Blog`;
  const metaDescription = post.seo?.metaDescription || post.excerpt;
  const ogImage = post.seo?.ogImage || post.image;

  return {
    title: metaTitle,
    description: metaDescription,
    robots: { index: true, follow: true },
    alternates: {
      canonical: `${BASE_URL}/blog/${slug}`,
      languages: { "en-NG": `${BASE_URL}/blog/${slug}` },
    },
    openGraph: {
      type: "article",
      url: `${BASE_URL}/blog/${slug}`,
      siteName: SITE_NAME,
      title: metaTitle,
      description: metaDescription,
      images: [{ url: ogImage, width: 1200, height: 630, alt: post.imageAlt || post.title }],
      locale: "en_NG",
      publishedTime: post.isoDate,
      modifiedTime: post.isoDate,
      authors: [post.author.name],
      tags: post.tags,
    },
    twitter: {
      card: "summary_large_image",
      site: "@DrinkHarbour",
      title: metaTitle,
      description: metaDescription,
      images: [ogImage],
    },
  };
}

export default async function BlogPostLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return <>{children}</>;

  const bodyText = blocksToPlainText(post.content);
  const wordCount = countWords(bodyText);

  const metaTitle = post.seo?.metaTitle || `${post.title} | DrinksHarbour Blog`;
  const metaDescription = post.seo?.metaDescription || post.excerpt;
  const ogImage = post.seo?.ogImage || post.image;

  const articleJsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: metaTitle,
    description: metaDescription,
    image: { "@type": "ImageObject", url: ogImage, width: 1200, height: 630 },
    thumbnailUrl: ogImage,
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