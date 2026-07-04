import type { Metadata } from "next";
import { POSTS } from "../data";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://www.drinksharbour.com";
const SITE_NAME = "DrinksHarbour";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = POSTS.find(p => p.slug === slug);
  if (!post) return { title: "Article not found" };

  return {
    title: `${post.title} | DrinksHarbour Blog`,
    description: post.excerpt,
    alternates: { canonical: `${BASE_URL}/blog/${slug}` },
    openGraph: {
      type: "article",
      url: `${BASE_URL}/blog/${slug}`,
      siteName: SITE_NAME,
      title: `${post.title} | DrinksHarbour Blog`,
      description: post.excerpt,
      images: [{ url: post.image, width: 1200, height: 630, alt: post.title }],
      locale: "en_NG",
      publishedTime: post.date,
      authors: [post.author.name],
      tags: post.tags,
    },
    twitter: {
      card: "summary_large_image",
      title: `${post.title} | DrinksHarbour Blog`,
      description: post.excerpt,
      images: [post.image],
    },
  };
}

export default async function BlogPostLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = POSTS.find(p => p.slug === slug);
  if (!post) return <>{children}</>;

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    image: post.image,
    datePublished: post.date,
    author: {
      "@type": "Person",
      name: post.author.name,
      description: post.author.role,
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: BASE_URL,
      logo: { "@type": "ImageObject", url: `${BASE_URL}/logo.png` },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": `${BASE_URL}/blog/${slug}` },
    keywords: post.tags.join(", "),
    articleSection: post.category,
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      {children}
    </>
  );
}