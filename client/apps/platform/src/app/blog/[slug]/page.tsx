import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import * as Icon from 'react-icons/pi';
import { POSTS, CATEGORY_COLORS, type ContentBlock } from '../data';
import ShareButtons from './ShareButtons';

export function generateStaticParams() {
  return POSTS.map(post => ({ slug: post.slug }));
}

// ─── Content renderer ─────────────────────────────────────────────────────────

function renderBlock(block: ContentBlock, i: number) {
  switch (block.type) {
    case 'h2':
      return <h2 key={i} className="text-xl font-black text-gray-900 mt-8 mb-3">{block.text}</h2>;
    case 'h3':
      return <h3 key={i} className="text-base font-bold text-gray-900 mt-6 mb-2">{block.text}</h3>;
    case 'p':
      return <p key={i} className="text-gray-700 leading-relaxed">{block.text}</p>;
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
        <blockquote key={i} className="border-l-[3px] border-red-400 pl-5 py-3 my-3 italic text-gray-600 bg-red-50/50 rounded-r-xl pr-5 leading-relaxed">
          {block.text}
        </blockquote>
      );
    case 'tip':
      return (
        <div key={i} className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4 my-2 shadow-sm">
          <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Icon.PiLightbulbFilamentBold size={15} className="text-amber-700" />
          </div>
          <p className="text-sm text-amber-800 leading-relaxed">{block.text}</p>
        </div>
      );
    default:
      return null;
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post    = POSTS.find(p => p.slug === slug);
  const related = POSTS.filter(p => p.slug !== slug && p.category === post?.category).slice(0, 3);
  const others  = related.length < 2 ? POSTS.filter(p => p.slug !== slug).slice(0, 3) : related;

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
  const postIndex = POSTS.findIndex(p => p.slug === slug);
  const prevPost = postIndex > 0 ? POSTS[postIndex - 1] : null;
  const nextPost = postIndex < POSTS.length - 1 ? POSTS[postIndex + 1] : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <main>
        <div className="relative h-80 min-h-[360px] sm:h-[50vh] w-full overflow-hidden">
          <style dangerouslySetInnerHTML={{
            __html: `@keyframes hero-zoom{0%{transform:scale(1)}100%{transform:scale(1.06)}}.hero-zoom{animation:hero-zoom 12s cubic-bezier(.25,.46,.45,.94) forwards}`
          }} />
          <Image
          src={post.image}
          alt={post.title}
          fill
          priority
          sizes="100vw"
          className="object-cover hero-zoom"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/40 z-[1]" />
        <div className="absolute inset-0 bg-gradient-to-br from-black/40 to-transparent z-[1]" />

        <div
          className="absolute inset-0 z-[2] opacity-[0.04] mix-blend-overlay pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'repeat',
            backgroundSize: '256px 256px',
          }}
        />

        <div className="absolute top-6 left-0 right-0 z-10">
          <div className="container mx-auto max-w-3xl px-4">
            <nav aria-label="Breadcrumb" className="inline-flex items-center gap-2 text-xs backdrop-blur-md bg-black/30 border border-white/10 rounded-full px-4 py-1.5 shadow-lg">
              <Link href="/blog" className="text-white/70 hover:text-white transition-colors flex items-center gap-1">
                <Icon.PiBookOpenText size={12} /> Blog
              </Link>
              <Icon.PiCaretRight size={11} className="text-white/30" />
              <Link href={`/blog?category=${encodeURIComponent(post.category)}`} className="bg-white/20 text-white px-2.5 py-0.5 rounded-full text-[10px] font-bold hover:bg-white/30 transition-colors">
                {post.category}
              </Link>
            </nav>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 pb-8 sm:pb-10 z-10">
          <div className="container mx-auto max-w-3xl px-4">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-tight drop-shadow-2xl">
              {post.title}
            </h1>
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-3xl px-4 py-8 pb-16">

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex flex-wrap items-center justify-between gap-3 mb-8">
          <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
            <span className="flex items-center gap-1.5">
              <Icon.PiUserCircleBold size={14} className="text-red-600" />
              <Link href={`/blog?q=${encodeURIComponent(post.author.name)}`} className="font-semibold text-gray-700 hover:text-red-700 transition-colors">{post.author.name}</Link>
              <span className="text-gray-400">· {post.author.role}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <time dateTime={post.isoDate}><Icon.PiCalendar size={13} className="text-red-600" /> {post.date}</time>
            </span>
            <span className="flex items-center gap-1.5">
              <Icon.PiClock size={13} className="text-red-600" /> {post.readTime}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/blog?category=${encodeURIComponent(post.category)}`} className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${categoryColor} hover:opacity-80 transition-opacity`}>{post.category}</Link>
          </div>
        </div>

        <p className="text-lg text-gray-800 leading-relaxed font-medium border-l-[3px] border-red-400/60 pl-5 mb-10 py-1.5">
          {post.excerpt}
        </p>

        <article className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8 space-y-5 text-base leading-[1.75]">
          {post.content.map((block, i) => renderBlock(block, i))}
        </article>

        <div className="flex items-center gap-2 flex-wrap mt-8">
          <span className="text-xs text-gray-400 font-semibold tracking-wider uppercase">Tags:</span>
          {post.tags.map(tag => (
            <Link
              key={tag}
              href={`/blog?q=${encodeURIComponent(tag)}`}
              className="text-xs bg-gray-100 hover:bg-red-50 hover:text-red-700 text-gray-600 px-3 py-1.5 rounded-full font-medium transition-all hover:shadow-sm"
            >
              #{tag}
            </Link>
          ))}
        </div>

        <ShareButtons />

        <div className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md p-6 mt-6 flex items-start gap-4 transition-all duration-300">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-100 to-red-200 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform duration-300">
            <Icon.PiUserCircleBold size={30} className="text-red-700" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-black text-gray-900">{post.author.name}</p>
            <p className="text-xs text-red-700 font-semibold mb-2">{post.author.role}</p>
            <p className="text-sm text-gray-500 leading-relaxed">
              {post.author.bio}
            </p>
          </div>
        </div>

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
                  className="group bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-lg hover:border-red-100 transition-all duration-300"
                >
                  <div className="relative h-36 overflow-hidden">
                    <Image
                      src={rel.image}
                      alt={rel.title}
                      fill
                      sizes="(max-width: 640px) 100vw, 33vw"
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                    <span className={`absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[rel.category] ?? 'bg-gray-100 text-gray-700'}`}>
                      {rel.category}
                    </span>
                  </div>
                  <div className="p-4">
                    <h3 className="text-xs font-black text-gray-900 leading-snug group-hover:text-red-700 transition-colors line-clamp-2">
                      {rel.title}
                    </h3>
                    <p className="text-[10px] text-gray-400 mt-1.5 flex items-center gap-1">
                      <Icon.PiClock size={10} /> {rel.readTime}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="mt-10 grid grid-cols-2 gap-3">
          {prevPost ? (
            <Link
              href={`/blog/${prevPost.slug}`}
              className="group bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:border-red-100 hover:shadow-lg transition-all duration-300 text-left"
            >
              <p className="text-[10px] text-gray-400 font-semibold flex items-center gap-1 mb-1 group-hover:text-red-500 transition-colors">
                <Icon.PiArrowLeft size={10} /> Previous
              </p>
              <p className="text-xs font-bold text-gray-700 leading-snug group-hover:text-red-700 transition-colors line-clamp-2">
                {prevPost.title}
              </p>
            </Link>
          ) : <div />}
          {nextPost ? (
            <Link
              href={`/blog/${nextPost.slug}`}
              className="group bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:border-red-100 hover:shadow-lg transition-all duration-300 text-right"
            >
              <p className="text-[10px] text-gray-400 font-semibold flex items-center gap-1 justify-end mb-1 group-hover:text-red-500 transition-colors">
                Next <Icon.PiArrowRight size={10} />
              </p>
              <p className="text-xs font-bold text-gray-700 leading-snug group-hover:text-red-700 transition-colors line-clamp-2">
                {nextPost.title}
              </p>
            </Link>
          ) : <div />}
        </div>

        <div className="mt-4 text-center">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 border border-gray-200 text-gray-700 px-6 py-3 rounded-xl font-bold text-sm hover:border-red-200 hover:text-red-700 hover:shadow-sm transition-all duration-300"
          >
            <Icon.PiArrowLeft size={15} /> Back to Blog
          </Link>
        </div>

      </div>
      </main>
    </div>
  );
}
