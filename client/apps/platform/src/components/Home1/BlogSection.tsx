'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import * as Icon from 'react-icons/pi';
import BlogImage from '@/app/blog/BlogImage';
import { type Post, CATEGORY_COLORS } from '@/app/blog/data';

/* ─── Raw → Post mapping ───────────────────────────────────────────────────── */
// Mirrors the mapping in `app/blog/api.ts` so the homepage can seed its section
// from the same raw API payload the /blog pages consume.
function toPost(raw: any): Post {
  const iso = raw.publishedAt || raw.createdAt || new Date().toISOString();
  return {
    id: String(raw._id),
    title: raw.title,
    excerpt: raw.excerpt || '',
    category: raw.category,
    date: new Date(iso).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }),
    isoDate: String(new Date(iso).toISOString()).slice(0, 10),
    readTime: raw.readTime || '1 min read',
    image:
      raw.image ||
      'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=1200&q=80',
    imageAlt: raw.imageAlt || '',
    slug: raw.slug,
    featured: Boolean(raw.featured),
    tags: raw.tags || [],
    author: raw.author || { name: '', role: '', bio: '' },
    content: raw.content || [],
    seo: raw.seo || {},
  };
}

/* ─── Category Tabs ────────────────────────────────────────────────────────── */

const CATEGORIES: { key: string; icon: React.ElementType; label: string }[] = [
  { key: 'all',            icon: Icon.PiListBold,            label: 'All' },
  { key: 'Wine Guide',     icon: Icon.PiWineBold,            label: 'Wine' },
  { key: 'Spirits Guide',  icon: Icon.PiFlaskBold,           label: 'Spirits' },
  { key: 'Beer Guide',     icon: Icon.PiBeerBottleBold,      label: 'Beer' },
  { key: 'Recipes',        icon: Icon.PiCookingPotBold,      label: 'Recipes' },
  { key: 'Entertaining',   icon: Icon.PiConfettiBold,        label: 'Entertaining' },
  { key: 'Lifestyle',      icon: Icon.PiSparkleBold,         label: 'Lifestyle' },
];

/* ─── Post Card ────────────────────────────────────────────────────────────── */

function BlogPostCard({ post }: { post: Post }) {
  return (
    <article className="group bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-lg hover:border-red-100 transition-all duration-300 flex flex-col">
      {/* Image */}
      <div className="relative overflow-hidden h-52 sm:h-56">
        <BlogImage
          src={post.image}
          alt={post.imageAlt || post.title}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />

        {/* Category pill */}
        <span
          className={`absolute top-3 left-3 text-[11px] font-bold px-2.5 py-1 rounded-full backdrop-blur-sm ${CATEGORY_COLORS[post.category] ?? 'bg-gray-100 text-gray-700'}`}
        >
          {post.category}
        </span>

        {post.featured && (
          <span className="absolute top-3 right-3 text-[10px] font-black bg-red-700 text-white px-2 py-0.5 rounded-full shadow-sm">
            Featured
          </span>
        )}
      </div>

      {/* Body */}
      <div className="p-5 flex flex-col flex-1">
        {/* Meta row */}
        <div className="flex items-center gap-3 text-xs text-gray-400 mb-2.5">
          <span className="flex items-center gap-1">
            <Icon.PiCalendar size={12} /> {post.date}
          </span>
          <span className="w-1 h-1 rounded-full bg-gray-200" />
          <span className="flex items-center gap-1">
            <Icon.PiClock size={12} /> {post.readTime}
          </span>
        </div>

        {/* Title */}
        <h3 className="font-black text-gray-900 text-base leading-snug mb-2 group-hover:text-red-700 transition-colors line-clamp-2">
          <Link href={`/blog/${post.slug}`} className="after:absolute after:inset-0">
            {post.title}
          </Link>
        </h3>

        {/* Excerpt */}
        <p className="text-sm text-gray-500 leading-relaxed mb-4 flex-1 line-clamp-2">
          {post.excerpt}
        </p>

        {/* Footer: tags + read more */}
        <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-50">
          <div className="flex gap-1.5 flex-wrap min-w-0">
            {post.tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium whitespace-nowrap"
              >
                #{tag}
              </span>
            ))}
          </div>
          <Link
            href={`/blog/${post.slug}`}
            className="inline-flex items-center gap-1 text-xs font-bold text-red-700 hover:gap-2 transition-all flex-shrink-0 ml-2"
          >
            Read <Icon.PiArrowRight size={13} />
          </Link>
        </div>
      </div>
    </article>
  );
}

/* ─── Section ──────────────────────────────────────────────────────────────── */

interface BlogSectionProps {
  /** Raw posts from `/api/blog` (same shape the /blog index consumes). */
  posts: any[];
}

export default function BlogSection({ posts }: BlogSectionProps) {
  const [activeCategory, setActiveCategory] = useState('all');

  // Map raw posts once on the client so all downstream usage is typed.
  const mapped = useMemo(() => posts.map(toPost), [posts]);

  const filtered = useMemo(() => {
    if (activeCategory === 'all') return mapped;
    return mapped.filter((p) => p.category === activeCategory);
  }, [mapped, activeCategory]);

  // Show at most 6 cards in the homepage section
  const visible = filtered.slice(0, 6);

  if (mapped.length === 0) return null;

  return (
    <section className="py-10 bg-white">
      <div className="container mx-auto px-3 max-w-7xl">

        {/* ── Section Header ─────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
          <div>
            <div className="inline-flex items-center gap-2 bg-red-50 rounded-full px-3 py-1 text-xs font-semibold text-red-700 mb-3">
              <Icon.PiBookOpenText size={13} />
              Drinks Journal
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
              From the Blog
            </h2>
            <p className="text-sm text-gray-500 mt-1 max-w-md">
              Expert guides, tasting notes, cocktail recipes, and everything you need to drink better.
            </p>
          </div>
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-red-700 hover:text-red-800 hover:gap-2.5 transition-all flex-shrink-0"
          >
            View All Articles
            <Icon.PiArrowRight size={15} />
          </Link>
        </div>

        {/* ── Category Pills ─────────────────────────────────────────── */}
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1 mb-7 -mx-1 px-1">
          {CATEGORIES.map(({ key, icon: Ic, label }) => {
            const active = activeCategory === key;
            const count = key === 'all'
              ? mapped.length
              : mapped.filter((p) => p.category === key).length;

            // Hide categories with zero posts (except "All")
            if (key !== 'all' && count === 0) return null;

            return (
              <button
                key={key}
                onClick={() => setActiveCategory(key)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full border text-xs font-semibold transition-all whitespace-nowrap flex-shrink-0 ${
                  active
                    ? 'bg-red-700 border-red-700 text-white shadow-md shadow-red-700/20'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-red-200 hover:text-red-700'
                }`}
              >
                <Ic size={13} />
                {label}
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-0.5 ${
                    active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Posts Grid ─────────────────────────────────────────────── */}
        {visible.length === 0 ? (
          <div className="text-center py-16 bg-gray-50 rounded-2xl border border-gray-100">
            <Icon.PiMagnifyingGlass size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="font-semibold text-gray-700 mb-1">No articles yet</p>
            <p className="text-sm text-gray-400">
              Check back soon — new guides and recipes are on the way.
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {visible.map((post) => (
              <BlogPostCard key={post.id} post={post} />
            ))}
          </div>
        )}

        {/* ── Bottom CTA (only when more posts exist) ────────────────── */}
        {filtered.length > 6 && (
          <div className="text-center mt-8">
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white text-sm font-bold rounded-full hover:bg-red-700 transition-colors shadow-lg shadow-gray-900/10"
            >
              <Icon.PiBookOpenText size={16} />
              Explore All {filtered.length} Articles
              <Icon.PiArrowRight size={15} />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
