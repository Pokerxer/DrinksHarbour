import Link from 'next/link';
import Image from 'next/image';
import * as Icon from 'react-icons/pi';
import { CATEGORY_COLORS, type Post } from './data';

function initials(name: string): string {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

// ─── Author card ─────────────────────────────────────────────────────────────

export function AuthorCard({ post }: { post: Post }) {
  const name = post.author.name;
  return (
    <div className="group mt-8 flex items-start gap-4 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-md">
      <div
        className={`flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl text-xl font-bold transition-transform duration-300 group-hover:scale-105 ${
          name
            ? 'bg-gradient-to-br from-red-100 to-red-200 text-red-700'
            : 'bg-gray-100 text-gray-400'
        }`}
      >
        {name ? initials(name) : <Icon.PiUserCircleBold size={30} className="text-red-700" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-base font-black text-gray-900">{post.author.name}</p>
        <p className="mb-2 text-xs font-semibold text-red-700">{post.author.role}</p>
        <p className="text-sm leading-relaxed text-gray-500">{post.author.bio}</p>
      </div>
    </div>
  );
}

// ─── Tag chips ───────────────────────────────────────────────────────────────

export function TagList({ tags }: { tags: string[] }) {
  if (!tags.length) return null;
  return (
    <div className="mt-8 flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
        Tags
      </span>
      {tags.map((tag) => (
        <Link
          key={tag}
          href={`/blog?q=${encodeURIComponent(tag)}`}
          className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 transition-all hover:bg-red-50 hover:text-red-700 hover:shadow-sm"
        >
          #{tag}
        </Link>
      ))}
    </div>
  );
}

// ─── Related articles ────────────────────────────────────────────────────────

export function RelatedArticles({ posts }: { posts: Post[] }) {
  if (!posts.length) return null;
  return (
    <div className="mt-14">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-lg font-black text-gray-900">More articles</h2>
        <Link
          href="/blog"
          className="flex items-center gap-1 text-xs font-semibold text-red-700 hover:underline"
        >
          View all <Icon.PiArrowRight size={12} />
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {posts.map((rel) => (
          <Link
            key={rel.slug}
            href={`/blog/${rel.slug}`}
            className="group overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all duration-300 hover:border-red-100 hover:shadow-lg"
          >
            <div className="relative h-36 overflow-hidden">
              <Image
                src={rel.image}
                alt={rel.imageAlt || rel.title}
                fill
                sizes="(max-width: 640px) 100vw, 33vw"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
              <span
                className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  CATEGORY_COLORS[rel.category] ?? 'bg-gray-100 text-gray-700'
                }`}
              >
                {rel.category}
              </span>
            </div>
            <div className="p-4">
              <h3 className="line-clamp-2 text-sm font-black leading-snug text-gray-900 transition-colors group-hover:text-red-700">
                {rel.title}
              </h3>
              <p className="mt-1.5 flex items-center gap-1 text-[11px] text-gray-400">
                <Icon.PiClock size={11} /> {rel.readTime}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ─── Previous / Next navigation ───────────────────────────────────────────────

export function PrevNextNav({
  prev,
  next,
}: {
  prev: Post | null;
  next: Post | null;
}) {
  return (
    <div className="mt-10 grid grid-cols-2 gap-3">
      {prev ? (
        <Link
          href={`/blog/${prev.slug}`}
          className="group rounded-2xl border border-gray-100 bg-white p-4 text-left shadow-sm transition-all duration-300 hover:border-red-100 hover:shadow-lg"
        >
          <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold text-gray-400 transition-colors group-hover:text-red-500">
            <Icon.PiArrowLeft size={10} /> Previous
          </p>
          <p className="line-clamp-2 text-xs font-bold leading-snug text-gray-700 transition-colors group-hover:text-red-700">
            {prev.title}
          </p>
        </Link>
      ) : (
        <div />
      )}
      {next ? (
        <Link
          href={`/blog/${next.slug}`}
          className="group rounded-2xl border border-gray-100 bg-white p-4 text-right shadow-sm transition-all duration-300 hover:border-red-100 hover:shadow-lg"
        >
          <p className="mb-1 flex items-center justify-end gap-1 text-[10px] font-semibold text-gray-400 transition-colors group-hover:text-red-500">
            Next <Icon.PiArrowRight size={10} />
          </p>
          <p className="line-clamp-2 text-xs font-bold leading-snug text-gray-700 transition-colors group-hover:text-red-700">
            {next.title}
          </p>
        </Link>
      ) : (
        <div />
      )}
    </div>
  );
}

// ─── Back-to-top button (client) ─────────────────────────────────────────────

export function BackToBlogLink() {
  return (
    <div className="mt-4 text-center">
      <Link
        href="/blog"
        className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-6 py-3 text-sm font-bold text-gray-700 transition-all duration-300 hover:border-red-200 hover:text-red-700 hover:shadow-sm"
      >
        <Icon.PiArrowLeft size={15} /> Back to Blog
      </Link>
    </div>
  );
}