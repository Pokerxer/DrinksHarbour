'use client';

// Live preview of content blocks — mirrors the public renderer at
// client/apps/platform/src/app/blog/[slug]/page.tsx so editors see what
// readers will get. Inline markdown: **bold**, *italic*, [anchor](/path).

import {
  PiQuotesBold,
  PiLightbulbFilamentBold,
  PiImageBold,
} from 'react-icons/pi';
import type { ContentBlock } from './blog-helpers';

const INLINE_TOKEN_RE = /\[([^\]]+)\]\((\/[^)\s]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*/g;

function renderInline(text?: string): React.ReactNode {
  if (!text) return text ?? null;
  const parts: React.ReactNode[] = [];
  const re = new RegExp(INLINE_TOKEN_RE.source, 'g');
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[2]) {
      parts.push(
        <a
          key={`lnk-${key++}`}
          href={m[2]}
          className="font-semibold text-red-700 underline decoration-red-300 underline-offset-2"
        >
          {m[1]}
        </a>,
      );
    } else if (m[3] !== undefined) {
      parts.push(
        <strong key={`b-${key++}`} className="font-bold text-gray-900">
          {m[3]}
        </strong>,
      );
    } else if (m[4] !== undefined) {
      parts.push(<em key={`i-${key++}`}>{m[4]}</em>);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length ? parts : text;
}

export function PreviewBlock({ block }: { block: ContentBlock }) {
  switch (block.type) {
    case 'h2':
      return (
        <h2 className="mt-8 mb-3 text-xl font-black text-gray-900">
          {renderInline(block.text)}
        </h2>
      );
    case 'h3':
      return (
        <h3 className="mt-6 mb-2 text-base font-bold text-gray-900">
          {renderInline(block.text)}
        </h3>
      );
    case 'p':
      return (
        <p className="leading-relaxed text-gray-700">
          {renderInline(block.text)}
        </p>
      );
    case 'ul':
      return (
        <ul className="my-1 space-y-2">
          {block.items?.map((item, j) => (
            <li
              key={j}
              className="flex items-start gap-2.5 text-sm leading-relaxed text-gray-600"
            >
              <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-500" />
              {renderInline(item)}
            </li>
          ))}
        </ul>
      );
    case 'ol':
      return (
        <ol className="my-1 list-none space-y-2">
          {block.items?.map((item, j) => (
            <li
              key={j}
              className="flex items-start gap-3 text-sm leading-relaxed text-gray-600"
            >
              <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-red-100 text-[10px] font-black text-red-700">
                {j + 1}
              </span>
              {renderInline(item)}
            </li>
          ))}
        </ol>
      );
    case 'quote':
      return (
        <blockquote className="my-3 rounded-r-xl border-l-[3px] border-red-400 bg-red-50/50 py-3 pl-5 pr-5 italic leading-relaxed text-gray-600">
          {renderInline(block.text)}
        </blockquote>
      );
    case 'tip':
      return (
        <div className="my-2 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-amber-100">
            <PiLightbulbFilamentBold size={15} className="text-amber-700" />
          </div>
          <p className="text-sm leading-relaxed text-amber-800">
            {renderInline(block.text)}
          </p>
        </div>
      );
    case 'image':
      if (!block.src)
        return (
          <div className="my-4 flex h-32 items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 text-xs text-gray-400">
            <PiImageBold className="me-2 h-5 w-5" /> No image yet
          </div>
        );
      return (
        <figure className="my-4">
          <div className="overflow-hidden rounded-2xl bg-gray-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={block.src}
              alt={block.alt || block.caption || ''}
              className="h-auto w-full object-cover"
            />
          </div>
          {block.caption ? (
            <figcaption className="mt-2 text-center text-xs italic text-gray-500">
              {block.caption}
            </figcaption>
          ) : null}
        </figure>
      );
    default:
      return null;
  }
}

export default function BlogPreview({
  title,
  excerpt,
  content,
  author,
}: {
  title: string;
  excerpt: string;
  content: ContentBlock[];
  author: { name: string; role: string };
}) {
  const empty =
    !title && !excerpt && content.every((b) => !b.text && !b.src && !(b.items?.length));
  return (
    <article className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
      {empty ? (
        <p className="py-10 text-center text-sm text-gray-400">
          Your live preview will appear here as you write.
        </p>
      ) : (
        <>
          <h1 className="text-3xl font-black leading-tight text-gray-900 sm:text-4xl">
            {title || 'Untitled post'}
          </h1>
          {(author.name || author.role) && (
            <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
              {author.name && (
                <span className="font-semibold text-gray-700">
                  {author.name}
                </span>
              )}
              {author.role && (
                <span className="text-gray-400">· {author.role}</span>
              )}
            </div>
          )}
          {excerpt ? (
            <p className="mt-5 border-l-[3px] border-red-400/60 py-1.5 pl-5 text-lg font-medium leading-relaxed text-gray-800">
              {excerpt}
            </p>
          ) : null}
          <div className="mt-6 space-y-4 text-base leading-[1.75]">
            {content.map((b, i) => (
              <PreviewBlock key={i} block={b} />
            ))}
          </div>
        </>
      )}
    </article>
  );
}