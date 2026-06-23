'use client';

import React, { use } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import * as Icon from 'react-icons/pi';
import { POSTS, CATEGORY_COLORS, type ContentBlock } from '../data';

// ─── Content renderer ─────────────────────────────────────────────────────────

function renderBlock(block: ContentBlock, i: number) {
  switch (block.type) {
    case 'h2':
      return <h2 key={i} className="text-xl font-black text-gray-900 mt-8 mb-3">{block.text}</h2>;
    case 'h3':
      return <h3 key={i} className="text-base font-bold text-gray-900 mt-6 mb-2">{block.text}</h3>;
    case 'p':
      return <p key={i} className="text-gray-600 leading-relaxed">{block.text}</p>;
    case 'ul':
      return (
        <ul key={i} className="space-y-2 my-1">
          {block.items?.map((item, j) => (
            <li key={j} className="flex items-start gap-2.5 text-gray-600 text-sm leading-relaxed">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0 mt-2" />
              {item}
            </li>
          ))}
        </ul>
      );
    case 'ol':
      return (
        <ol key={i} className="space-y-2 my-1 list-none">
          {block.items?.map((item, j) => (
            <li key={j} className="flex items-start gap-3 text-gray-600 text-sm leading-relaxed">
              <span className="w-5 h-5 rounded-full bg-red-100 text-red-700 text-[10px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">
                {j + 1}
              </span>
              {item}
            </li>
          ))}
        </ol>
      );
    case 'quote':
      return (
        <blockquote key={i} className="border-l-4 border-red-600 pl-5 py-1 my-2 italic text-gray-700 bg-red-50 rounded-r-xl pr-4">
          {block.text}
        </blockquote>
      );
    case 'tip':
      return (
        <div key={i} className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4 my-2">
          <Icon.PiLightbulbFilamentBold size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 leading-relaxed">{block.text}</p>
        </div>
      );
    default:
      return null;
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const post    = POSTS.find(p => p.slug === slug);
  const related = POSTS.filter(p => p.slug !== slug && p.category === post?.category).slice(0, 3);
  const others  = related.length < 2 ? POSTS.filter(p => p.slug !== slug).slice(0, 3) : related;

  // ── 404 state ──────────────────────────────────────────────────────────────
  if (!post) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-50 text-red-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Icon.PiBookOpenTextBold size={30} />
          </div>
          <h1 className="text-2xl font-black text-gray-900 mb-2">Article not found</h1>
          <p className="text-gray-500 mb-6">This article may have been moved or removed.</p>
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 bg-gradient-to-br from-red-700 to-red-900 text-white px-6 py-3 rounded-xl font-bold text-sm"
          >
            <Icon.PiArrowLeft size={15} /> Back to Blog
          </Link>
        </div>
      </div>
    );
  }

  const categoryColor = CATEGORY_COLORS[post.category] ?? 'bg-gray-100 text-gray-700';

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Hero image ──────────────────────────────────────────────────────── */}
      <div className="relative h-72 sm:h-96 w-full overflow-hidden">
        <Image
          src={post.image}
          alt={post.title}
          fill
          priority
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

        {/* Breadcrumb */}
        <div className="absolute top-5 left-0 right-0">
          <div className="container mx-auto max-w-3xl px-4">
            <nav className="flex items-center gap-2 text-xs text-white/70">
              <Link href="/blog" className="hover:text-white transition-colors flex items-center gap-1">
                <Icon.PiBookOpenText size={12} /> Blog
              </Link>
              <Icon.PiCaretRight size={11} />
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${categoryColor}`}>{post.category}</span>
            </nav>
          </div>
        </div>

        {/* Title overlay */}
        <div className="absolute bottom-0 left-0 right-0">
          <div className="container mx-auto max-w-3xl px-4 pb-7">
            <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight">{post.title}</h1>
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-3xl px-4 py-8 pb-16">

        {/* ── Meta bar ────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex flex-wrap items-center justify-between gap-3 mb-8">
          <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
            <span className="flex items-center gap-1.5">
              <Icon.PiUserCircleBold size={14} className="text-red-600" />
              <span className="font-semibold text-gray-700">{post.author.name}</span>
              <span className="text-gray-400">· {post.author.role}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Icon.PiCalendar size={13} className="text-red-600" /> {post.date}
            </span>
            <span className="flex items-center gap-1.5">
              <Icon.PiClock size={13} className="text-red-600" /> {post.readTime}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${categoryColor}`}>{post.category}</span>
          </div>
        </div>

        {/* ── Excerpt ─────────────────────────────────────────────────────── */}
        <p className="text-lg text-gray-700 leading-relaxed font-medium border-l-4 border-red-600 pl-4 mb-8 bg-red-50 rounded-r-2xl pr-5 py-4">
          {post.excerpt}
        </p>

        {/* ── Article body ────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8 space-y-4 text-sm">
          {post.content.map((block, i) => renderBlock(block, i))}
        </div>

        {/* ── Tags ────────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 flex-wrap mt-6">
          <span className="text-xs text-gray-400 font-semibold">Tags:</span>
          {post.tags.map(tag => (
            <Link
              key={tag}
              href={`/blog?q=${encodeURIComponent(tag)}`}
              className="text-xs bg-gray-100 hover:bg-red-50 hover:text-red-700 text-gray-600 px-3 py-1 rounded-full font-medium transition-colors"
            >
              #{tag}
            </Link>
          ))}
        </div>

        {/* ── Share ───────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mt-6 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="font-bold text-gray-900 text-sm">Enjoyed this article?</p>
            <p className="text-xs text-gray-400 mt-0.5">Share it with your friends</p>
          </div>
          <div className="flex items-center gap-2">
            {[
              { icon: Icon.PiWhatsappLogo,  label: 'WhatsApp', color: 'hover:bg-green-50 hover:text-green-700' },
              { icon: Icon.PiTwitterLogo,   label: 'Twitter',  color: 'hover:bg-blue-50 hover:text-blue-700' },
              { icon: Icon.PiFacebookLogo,  label: 'Facebook', color: 'hover:bg-blue-50 hover:text-blue-800' },
              { icon: Icon.PiLink,          label: 'Copy link', color: 'hover:bg-gray-100 hover:text-gray-700' },
            ].map(({ icon: Ic, label, color }) => (
              <button
                key={label}
                aria-label={label}
                className={`w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-400 transition-all ${color}`}
                onClick={() => label === 'Copy link' && navigator.clipboard?.writeText(window.location.href)}
              >
                <Ic size={16} />
              </button>
            ))}
          </div>
        </div>

        {/* ── Author card ─────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mt-6 flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-100 to-red-200 flex items-center justify-center flex-shrink-0">
            <Icon.PiUserCircleBold size={30} className="text-red-700" />
          </div>
          <div>
            <p className="font-black text-gray-900">{post.author.name}</p>
            <p className="text-xs text-red-700 font-semibold mb-2">{post.author.role}</p>
            <p className="text-xs text-gray-500 leading-relaxed">
              A drinks professional writing for DrinksHarbour on all things beverages — from tasting notes and cocktail recipes to lifestyle guides for Nigerian drinkers.
            </p>
          </div>
        </div>

        {/* ── Related posts ───────────────────────────────────────────────── */}
        {others.length > 0 && (
          <div className="mt-12">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-black text-gray-900">More articles</h2>
              <Link href="/blog" className="text-xs font-semibold text-red-700 hover:underline flex items-center gap-1">
                View all <Icon.PiArrowRight size={12} />
              </Link>
            </div>
            <div className="grid sm:grid-cols-3 gap-4">
              {others.map(rel => (
                <Link
                  key={rel.slug}
                  href={`/blog/${rel.slug}`}
                  className="group bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md hover:border-red-100 transition-all"
                >
                  <div className="relative h-36 overflow-hidden">
                    <Image
                      src={rel.image}
                      alt={rel.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                    <span className={`absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[rel.category] ?? 'bg-gray-100 text-gray-700'}`}>
                      {rel.category}
                    </span>
                  </div>
                  <div className="p-4">
                    <p className="text-xs font-black text-gray-900 leading-snug group-hover:text-red-700 transition-colors line-clamp-2">
                      {rel.title}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-1.5 flex items-center gap-1">
                      <Icon.PiClock size={10} /> {rel.readTime}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── Back to blog ────────────────────────────────────────────────── */}
        <div className="mt-10 text-center">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 border border-gray-200 text-gray-700 px-6 py-3 rounded-xl font-bold text-sm hover:border-red-200 hover:text-red-700 transition-all"
          >
            <Icon.PiArrowLeft size={15} /> Back to Blog
          </Link>
        </div>

      </div>
    </div>
  );
}
