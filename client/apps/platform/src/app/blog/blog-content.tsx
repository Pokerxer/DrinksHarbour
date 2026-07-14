import React from 'react';
import Link from 'next/link';
import * as Icon from 'react-icons/pi';
import type { ContentBlock } from './data';
import BlogImage from './BlogImage';

// Parse inline markdown into styled nodes, leaving surrounding text intact:
//   [anchor](/internal/path)  → internal Next link (leading-slash hrefs only)
//   **bold**                  → <strong>
//   *italic*                  → <em>
const INLINE_TOKEN_RE = /\[([^\]]+)\]\((\/[^)\s]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*/g;

export function renderRichText(text?: string): React.ReactNode {
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
        <Link
          key={`lnk-${key++}`}
          href={m[2]}
          className="font-semibold text-red-700 underline decoration-red-300 underline-offset-2 transition-colors hover:decoration-red-600"
        >
          {m[1]}
        </Link>,
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

// Slugify a heading for anchor IDs (matches the TOC generator).
function headingId(text?: string): string {
  return String(text || '')
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function renderBlock(block: ContentBlock, i: number) {
  switch (block.type) {
    case 'h2':
      return (
        <h2
          key={i}
          id={headingId(block.text)}
          className="mb-3 mt-10 scroll-mt-24 text-2xl font-black tracking-tight text-gray-900 sm:text-3xl"
        >
          {renderRichText(block.text)}
        </h2>
      );
    case 'h3':
      return (
        <h3
          key={i}
          id={headingId(block.text)}
          className="mb-2 mt-6 scroll-mt-24 text-lg font-bold text-gray-900"
        >
          {renderRichText(block.text)}
        </h3>
      );
    case 'p':
      return (
        <p key={i} className="text-[17px] leading-[1.8] text-gray-700">
          {renderRichText(block.text)}
        </p>
      );
    case 'ul':
      return (
        <ul key={i} className="my-2 space-y-2.5">
          {block.items?.map((item, j) => (
            <li
              key={j}
              className="flex items-start gap-3 text-[17px] leading-relaxed text-gray-600"
            >
              <span className="mt-2.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-500" />
              {renderRichText(item)}
            </li>
          ))}
        </ul>
      );
    case 'ol':
      return (
        <ol key={i} className="my-2 list-none space-y-2.5">
          {block.items?.map((item, j) => (
            <li
              key={j}
              className="flex items-start gap-3 text-[17px] leading-relaxed text-gray-600"
            >
              <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-red-100 text-[11px] font-black text-red-700">
                {j + 1}
              </span>
              {renderRichText(item)}
            </li>
          ))}
        </ol>
      );
    case 'quote':
      return (
        <blockquote
          key={i}
          className="my-5 rounded-r-2xl border-l-[3px] border-red-400 bg-red-50/40 py-4 pl-6 pr-5 italic leading-relaxed text-gray-700"
        >
          {renderRichText(block.text)}
        </blockquote>
      );
    case 'tip':
      return (
        <div
          key={i}
          className="my-5 flex items-start gap-3.5 rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm"
        >
          <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-amber-100">
            <Icon.PiLightbulbFilamentBold size={16} className="text-amber-700" />
          </div>
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-wider text-amber-700">
              Pro tip
            </p>
            <p className="text-[15px] leading-relaxed text-amber-900">
              {renderRichText(block.text)}
            </p>
          </div>
        </div>
      );
    case 'image':
      if (!block.src) return null;
      return (
        <figure key={i} className="my-8">
          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl bg-gray-100">
            <BlogImage
              src={block.src}
              alt={block.alt || block.caption || ''}
              fill
              sizes="(max-width: 768px) 100vw, 768px"
              className="object-cover"
            />
          </div>
          {block.caption ? (
            <figcaption className="mt-3 flex items-center justify-center gap-2 text-center text-sm italic text-gray-500">
              <span className="h-px w-4 bg-gray-300" />
              {block.caption}
              <span className="h-px w-4 bg-gray-300" />
            </figcaption>
          ) : null}
        </figure>
      );
    default:
      return null;
  }
}

// Collect h2/h3 blocks for the table of contents.
export function buildToc(
  content: ContentBlock[],
): { id: string; text: string; level: 2 | 3 }[] {
  return content
    .filter((b) => b.type === 'h2' || b.type === 'h3')
    .map((b) => ({
      id: headingId(b.text),
      text: String(b.text || '').replace(/\*\*([^*]+)\*\*/g, '$1'),
      level: b.type === 'h2' ? 2 : 3,
    }));
}