'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import * as Icon from 'react-icons/pi';
import { type Category, type Post, CATEGORY_COLORS } from './data';
import BlogImage from './BlogImage';

// ─── Categories ───────────────────────────────────────────────────────────────

const CATEGORIES: { key: Category; icon: React.ElementType }[] = [
  { key: 'all',            icon: Icon.PiListBold },
  { key: 'Wine Guide',     icon: Icon.PiWineBold },
  { key: 'Spirits Guide',  icon: Icon.PiFlaskBold },
  { key: 'Beer Guide',     icon: Icon.PiBeerBottleBold },
  { key: 'Recipes',        icon: Icon.PiCookingPotBold },
  { key: 'Entertaining',   icon: Icon.PiConfettiBold },
  { key: 'Lifestyle',      icon: Icon.PiSparkleBold },
];


// ─── Card ─────────────────────────────────────────────────────────────────────

function PostCard({ post, large = false }: { post: Post; large?: boolean }) {
  return (
    <article className={`group bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md hover:border-red-100 transition-all flex flex-col ${large ? 'md:flex-row' : ''}`}>
      <div className={`relative overflow-hidden flex-shrink-0 ${large ? 'md:w-2/5 h-56 md:h-auto' : 'h-48'}`}>
        <BlogImage
          src={post.image}
          alt={post.imageAlt || post.title}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
        <span className={`absolute top-3 left-3 text-[11px] font-bold px-2.5 py-1 rounded-full ${CATEGORY_COLORS[post.category] ?? 'bg-gray-100 text-gray-700'}`}>
          {post.category}
        </span>
        {post.featured && (
          <span className="absolute top-3 right-3 text-[10px] font-black bg-red-700 text-white px-2 py-0.5 rounded-full">
            Featured
          </span>
        )}
      </div>

      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-center gap-3 text-xs text-gray-400 mb-2.5">
          <span className="flex items-center gap-1"><Icon.PiCalendar size={12} /> {post.date}</span>
          <span className="w-1 h-1 rounded-full bg-gray-200" />
          <span className="flex items-center gap-1"><Icon.PiClock size={12} /> {post.readTime}</span>
        </div>

        <h2 className={`font-black text-gray-900 mb-2 leading-snug group-hover:text-red-700 transition-colors ${large ? 'text-xl' : 'text-base'}`}>
          <Link href={`/blog/${post.slug}`}>{post.title}</Link>
        </h2>

        <p className="text-sm text-gray-500 leading-relaxed mb-4 flex-1 line-clamp-2">{post.excerpt}</p>

        <div className="flex items-center justify-between mt-auto">
          <div className="flex gap-1.5 flex-wrap">
            {post.tags.slice(0, 2).map(tag => (
              <span key={tag} className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">
                #{tag}
              </span>
            ))}
          </div>
          <Link
            href={`/blog/${post.slug}`}
            className="inline-flex items-center gap-1 text-xs font-bold text-red-700 hover:gap-2 transition-all"
          >
            Read <Icon.PiArrowRight size={13} />
          </Link>
        </div>
      </div>
    </article>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BlogIndexClient({ posts }: { posts: Post[] }) {
  const searchParams = useSearchParams();
  const [activeCategory, setActiveCategory] = useState<Category>(() => {
    const cat = searchParams.get('category') as Category | null;
    return cat && CATEGORIES.some(c => c.key === cat) ? cat : 'all';
  });
  const [search, setSearch] = useState(() => searchParams.get('q') || '');

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return posts.filter(p => {
      const matchCat = activeCategory === 'all' || p.category === activeCategory;
      const matchQ   = !q || p.title.toLowerCase().includes(q) || p.excerpt.toLowerCase().includes(q) || p.tags.some(t => t.toLowerCase().includes(q));
      return matchCat && matchQ;
    });
  }, [posts, activeCategory, search]);

  const featured     = posts.find(p => p.featured);
  const isFiltered   = search !== '' || activeCategory !== 'all';
  const showFeatured = !isFiltered && featured;
  const grid         = filtered.filter(p => !showFeatured || p.id !== featured?.id);

  return (
    <div className="min-h-screen bg-gray-50">

      {isFiltered && <meta name="robots" content="noindex,follow" />}

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="relative bg-gradient-to-br from-gray-900 via-red-950 to-gray-900 text-white overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-96 h-96 bg-red-700 opacity-10 rounded-full blur-3xl -translate-y-1/3 translate-x-1/4" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-red-500 opacity-10 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4" />
        </div>
        <div className="container mx-auto max-w-5xl px-4 py-16 relative text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-1.5 text-xs font-medium text-red-300 mb-5">
            <Icon.PiBookOpenText size={13} />
            The DrinksHarbour Journal
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-3">
            Nigeria Drinks Guides, Recipes & Lifestyle
          </h1>
          <p className="text-gray-300 text-sm sm:text-base max-w-xl mx-auto mb-7">
            Expert tips, tasting notes, cocktail recipes, and everything you need to drink better in Nigeria.
          </p>

          {/* Search */}
          <div className="relative max-w-md mx-auto">
            <Icon.PiMagnifyingGlass size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search articles…"
              className="w-full pl-11 pr-10 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-gray-400 text-sm focus:outline-none focus:border-white/40 focus:bg-white/15 transition-all"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                <Icon.PiX size={15} />
              </button>
            )}
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-12">
            <path d="M0 48L1440 48L1440 12C1200 44 960 56 720 40C480 24 240 0 0 12L0 48Z" fill="rgb(249 250 251)" />
          </svg>
        </div>
      </div>

      <div className="container mx-auto max-w-5xl px-4 py-10 pb-16">

        {/* ── Visible breadcrumb ────────────────────────────────────────── */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-gray-400 mb-6">
          <Link href="/" className="hover:text-red-700 transition-colors">Home</Link>
          <Icon.PiCaretRight size={11} />
          <span className="text-gray-700 font-semibold">Blog</span>
        </nav>

        {/* ── Category tabs ─────────────────────────────────────────────── */}
        <div className="flex gap-2 flex-wrap mb-8">
          {CATEGORIES.map(({ key, icon: Ic }) => {
            const active = activeCategory === key;
            const count  = key === 'all' ? posts.length : posts.filter(p => p.category === key).length;
            return (
              <Link
                key={key}
                href={key === 'all' ? '/blog' : `/blog?category=${encodeURIComponent(key)}`}
                onClick={() => setActiveCategory(key)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border text-xs font-semibold transition-all ${
                  active
                    ? 'bg-red-700 border-red-700 text-white shadow-md'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-red-200 hover:text-red-700'
                }`}
              >
                <Ic size={13} />
                {key === 'all' ? 'All' : key}
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-0.5 ${active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-400'}`}>
                  {count}
                </span>
              </Link>
            );
          })}
        </div>

        {/* ── Search result count ───────────────────────────────────────── */}
        {search && (
          <p className="text-sm text-gray-500 mb-5">
            {filtered.length === 0
              ? 'No articles found.'
              : `${filtered.length} article${filtered.length !== 1 ? 's' : ''} for "${search}"`}
          </p>
        )}

        {/* ── Featured post ─────────────────────────────────────────────── */}
        {showFeatured && featured && (
          <div className="mb-8">
            <PostCard post={featured} large />
          </div>
        )}

        {/* ── Grid ──────────────────────────────────────────────────────── */}
        {grid.length === 0 && !showFeatured ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
            <Icon.PiMagnifyingGlass size={36} className="mx-auto text-gray-300 mb-3" />
            <p className="font-semibold text-gray-700 mb-1">No articles found</p>
            <p className="text-sm text-gray-400 mb-5">Try a different search or browse all categories.</p>
            <Link
              href="/blog"
              className="text-sm text-red-700 font-semibold hover:underline"
            >
              Clear filters
            </Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {grid.map(post => <PostCard key={post.id} post={post} />)}
          </div>
        )}

        {/* ── Newsletter CTA ────────────────────────────────────────────── */}
        <div className="mt-14 bg-gradient-to-br from-red-700 to-red-900 rounded-3xl p-8 sm:p-10 text-white text-center relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none opacity-10">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white rounded-full blur-3xl" />
          </div>
          <div className="relative">
            <div className="w-12 h-12 bg-white/15 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Icon.PiEnvelope size={24} />
            </div>
            <h2 className="text-xl font-black mb-2">Never miss an article</h2>
            <p className="text-red-100 text-sm max-w-md mx-auto mb-6">
              Get the latest drink guides, recipes, and exclusive offers delivered to your inbox every week.
            </p>
            <form
              action="/api/newsletter/subscribe"
              method="POST"
              className="flex gap-2 max-w-sm mx-auto"
            >
              <input
                type="email"
                name="email"
                required
                placeholder="your@email.com"
                className="flex-1 px-4 py-3 rounded-xl bg-white/15 border border-white/25 text-white placeholder-white/50 text-sm focus:outline-none focus:border-white/50 focus:bg-white/20 transition-all"
              />
              <button
                type="submit"
                className="px-5 py-3 bg-white text-red-700 font-bold text-sm rounded-xl hover:bg-red-50 transition-all flex-shrink-0"
              >
                Subscribe
              </button>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}
