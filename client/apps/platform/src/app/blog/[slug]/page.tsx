import React from 'react';
import Link from 'next/link';
import * as Icon from 'react-icons/pi';
import { CATEGORY_COLORS } from '../data';
import { getPosts, getPostBySlug } from '../api';
import { renderBlock, buildToc } from '../blog-content';
import {
  AuthorCard,
  TagList,
  RelatedArticles,
  PrevNextNav,
  BackToBlogLink,
} from '../blog-sections';
import BlogImage from '../BlogImage';
import ShareButtons, { ShareRail } from './ShareButtons';
import TableOfContents from './TableOfContents';
import PlacementBanner from '@/components/Banner/PlacementBanner';

export const revalidate = 300;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  const all = post ? await getPosts() : [];
  const related = all
    .filter((p) => p.slug !== slug && p.category === post?.category)
    .slice(0, 3);
  const others =
    related.length < 2 ? all.filter((p) => p.slug !== slug).slice(0, 3) : related;

  if (!post) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-700">
            <Icon.PiBookOpenTextBold size={30} />
          </div>
          <h1 className="mb-2 text-2xl font-black text-gray-900">
            Article not found
          </h1>
          <p className="mb-6 text-gray-500">
            This article may have been moved or removed.
          </p>
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-red-700 to-red-900 px-6 py-3 text-sm font-bold text-white"
          >
            <Icon.PiArrowLeft size={15} /> Back to Blog
          </Link>
        </div>
      </div>
    );
  }

  const categoryColor =
    CATEGORY_COLORS[post.category] ?? 'bg-gray-100 text-gray-700';
  const postIndex = all.findIndex((p) => p.slug === slug);
  const prevPost = postIndex > 0 ? all[postIndex - 1] : null;
  const nextPost =
    postIndex >= 0 && postIndex < all.length - 1 ? all[postIndex + 1] : null;
  const toc = buildToc(post.content);
  const heroAlt = post.imageAlt || post.title;

  return (
    <div className="min-h-screen bg-gray-50">
      <main>
        {/* ─── Hero ─────────────────────────────────────────────────────── */}
        <div className="relative h-80 min-h-[360px] w-full overflow-hidden sm:h-[52vh]">
          <style
            dangerouslySetInnerHTML={{
              __html: `@keyframes hero-zoom{0%{transform:scale(1)}100%{transform:scale(1.06)}}.hero-zoom{animation:hero-zoom 12s cubic-bezier(.25,.46,.45,.94) forwards}@media(prefers-reduced-motion:reduce){.hero-zoom{animation:none;transform:none}}`,
            }}
          />
          <BlogImage
            src={post.image}
            alt={heroAlt}
            fill
            priority
            sizes="100vw"
            aspectClassName="absolute inset-0"
            className="object-cover hero-zoom"
          />

          <div className="absolute inset-0 z-[1] bg-gradient-to-t from-black/80 via-black/20 to-black/40" />
          <div className="absolute inset-0 z-[1] bg-gradient-to-br from-black/40 to-transparent" />

          <div
            className="pointer-events-none absolute inset-0 z-[2] opacity-[0.04] mix-blend-overlay"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'repeat',
              backgroundSize: '256px 256px',
            }}
          />

          {/* Breadcrumb */}
          <div className="absolute left-0 right-0 top-6 z-10">
            <div className="container mx-auto max-w-4xl px-4">
              <nav
                aria-label="Breadcrumb"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-4 py-1.5 text-xs shadow-lg backdrop-blur-md"
              >
                <Link
                  href="/blog"
                  className="flex items-center gap-1 text-white/70 transition-colors hover:text-white"
                >
                  <Icon.PiBookOpenText size={12} /> Blog
                </Link>
                <Icon.PiCaretRight size={11} className="text-white/30" />
                <Link
                  href={`/blog?category=${encodeURIComponent(post.category)}`}
                  className="rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-bold text-white transition-colors hover:bg-white/30"
                >
                  {post.category}
                </Link>
              </nav>
            </div>
          </div>

          {/* Title + featured badge */}
          <div className="absolute bottom-0 left-0 right-0 z-10 pb-8 sm:pb-12">
            <div className="container mx-auto max-w-4xl px-4">
              {post.featured ? (
                <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-amber-400/90 px-3 py-1 text-[11px] font-bold text-amber-900 shadow-sm backdrop-blur-sm">
                  <Icon.PiStarFill size={12} /> Featured
                </span>
              ) : null}
              <h1 className="text-3xl font-black leading-tight text-white drop-shadow-2xl sm:text-4xl lg:text-5xl">
                {post.title}
              </h1>
            </div>
          </div>
        </div>

        {/* ─── Meta bar ─────────────────────────────────────────────────── */}
        <div className="container mx-auto max-w-4xl px-4">
          <div className="-mt-6 relative z-10 mb-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-white px-5 py-4 shadow-md">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-gray-500">
              <span className="flex items-center gap-2">
                <Icon.PiUserCircleBold size={16} className="text-red-600" />
                <Link
                  href={`/blog?q=${encodeURIComponent(post.author.name)}`}
                  className="font-semibold text-gray-700 transition-colors hover:text-red-700"
                >
                  {post.author.name}
                </Link>
                {post.author.role ? (
                  <span className="hidden text-gray-400 sm:inline">
                    · {post.author.role}
                  </span>
                ) : null}
              </span>
              <span className="flex items-center gap-1.5">
                <Icon.PiCalendar size={13} className="text-red-600" />
                <time dateTime={post.isoDate}>{post.date}</time>
              </span>
              <span className="flex items-center gap-1.5">
                <Icon.PiClock size={13} className="text-red-600" />
                {post.readTime}
              </span>
            </div>
            <Link
              href={`/blog?category=${encodeURIComponent(post.category)}`}
              className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-opacity hover:opacity-80 ${categoryColor}`}
            >
              {post.category}
            </Link>
          </div>
        </div>

        {/* ─── Article body: share rail + main + TOC ────────────────────── */}
        <div className="container mx-auto max-w-4xl px-4 pb-16">
          {/* Excerpt */}
          <p className="mb-10 border-l-[3px] border-red-400/60 py-1.5 pl-5 text-lg font-medium leading-relaxed text-gray-800">
            {post.excerpt}
          </p>

          <div className="flex gap-8">
            {/* Desktop share rail */}
            <ShareRail />

            {/* Article */}
            <article className="min-w-0 flex-1 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm space-y-5 sm:p-8">
              {post.content.map((block, i) => renderBlock(block, i))}
            </article>

            {/* Desktop TOC */}
            {toc.length >= 3 ? (
              <aside className="hidden w-56 flex-shrink-0 xl:block">
                <div className="sticky top-24 space-y-4">
                  <TableOfContents items={toc} />
                  <PlacementBanner
                    placement="sidebar"
                    variant="sidebar"
                    limit={1}
                  />
                </div>
              </aside>
            ) : null}
          </div>

          {/* Tags */}
          <TagList tags={post.tags} />

          {/* Share (mobile + full bar) */}
          <ShareButtons />

          {/* Author */}
          <AuthorCard post={post} />

          {/* Related */}
          <RelatedArticles posts={others} />

          {/* Prev / Next */}
          <PrevNextNav prev={prevPost} next={nextPost} />

          {/* Back to blog */}
          <BackToBlogLink />
        </div>
      </main>
    </div>
  );
}