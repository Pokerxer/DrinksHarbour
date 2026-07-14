// Pure helpers + shared constants for the blog create/edit editor.
// No React, no side-effects — safe to import from any component.

export const CATEGORIES = [
  'Wine Guide',
  'Spirits Guide',
  'Beer Guide',
  'Recipes',
  'Entertaining',
  'Lifestyle',
] as const;

export const CATEGORY_OPTIONS = CATEGORIES.map((c) => ({
  label: c,
  value: c,
}));

// Mirrors client/apps/platform/src/app/blog/data.ts CATEGORY_COLORS so the
// admin editor previews match what readers see on the public blog.
export const CATEGORY_COLORS: Record<string, string> = {
  'Wine Guide': 'bg-purple-100 text-purple-700 ring-purple-200',
  'Spirits Guide': 'bg-amber-100 text-amber-700 ring-amber-200',
  'Beer Guide': 'bg-yellow-100 text-yellow-700 ring-yellow-200',
  Recipes: 'bg-orange-100 text-orange-700 ring-orange-200',
  Entertaining: 'bg-pink-100 text-pink-700 ring-pink-200',
  Lifestyle: 'bg-teal-100 text-teal-700 ring-teal-200',
};

export function categoryColor(c: string): string {
  return CATEGORY_COLORS[c] ?? 'bg-gray-100 text-gray-700 ring-gray-200';
}

export type BlockType =
  | 'p'
  | 'h2'
  | 'h3'
  | 'ul'
  | 'ol'
  | 'quote'
  | 'tip'
  | 'image';

export interface ContentBlock {
  type: BlockType;
  text?: string;
  items?: string[];
  src?: string;
  alt?: string;
  caption?: string;
}

export const BLOCK_OPTIONS: { label: string; value: BlockType }[] = [
  { label: 'Paragraph', value: 'p' },
  { label: 'Heading 2', value: 'h2' },
  { label: 'Heading 3', value: 'h3' },
  { label: 'Bullet list', value: 'ul' },
  { label: 'Numbered list', value: 'ol' },
  { label: 'Blockquote', value: 'quote' },
  { label: 'Pro tip', value: 'tip' },
  { label: 'Image', value: 'image' },
];

export const BLOCK_LABEL: Record<BlockType, string> = {
  p: 'Paragraph',
  h2: 'Heading 2',
  h3: 'Heading 3',
  ul: 'Bullet list',
  ol: 'Numbered list',
  quote: 'Blockquote',
  tip: 'Pro tip',
  image: 'Image',
};

export const BLOCK_ACCENT: Record<BlockType, string> = {
  p: 'border-l-gray-300',
  h2: 'border-l-blue-500',
  h3: 'border-l-blue-300',
  ul: 'border-l-green-500',
  ol: 'border-l-emerald-400',
  quote: 'border-l-amber-400',
  tip: 'border-l-violet-500',
  image: 'border-l-sky-500',
};

export const BLOCK_PLACEHOLDER: Record<BlockType, string> = {
  p: 'Write your paragraph…',
  h2: 'Section heading…',
  h3: 'Sub-heading…',
  ul: 'One list item per line',
  ol: 'One list item per line',
  quote: 'Blockquote text…',
  tip: 'Pro tip text…',
  image: '',
};

export const LIST_TYPES: BlockType[] = ['ul', 'ol'];
export const TEXT_TYPES: BlockType[] = [
  'p',
  'h2',
  'h3',
  'quote',
  'tip',
];

export const emptyPost = {
  title: '',
  slug: '',
  excerpt: '',
  category: 'Wine Guide' as (typeof CATEGORIES)[number],
  tags: [] as string[],
  image: '',
  imageAlt: '',
  featured: false,
  author: { name: '', role: '', bio: '' },
  content: [{ type: 'p' as BlockType, text: '', items: [] }] as ContentBlock[],
  seo: { metaTitle: '', metaDescription: '', ogImage: '' },
};

export function slugify(title: string): string {
  return String(title || '')
    .toLowerCase()
    .trim()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function countWords(str: string): number {
  return String(str || '')
    .split(/\s+/)
    .filter(Boolean).length;
}

export function computeReadTime(content: ContentBlock[]): string {
  const blocks = Array.isArray(content) ? content : [];
  const words = blocks.reduce((sum, b) => {
    if (!b) return sum;
    const itemWords = Array.isArray(b.items)
      ? b.items.reduce((s, it) => s + countWords(it), 0)
      : 0;
    return sum + countWords(b.text || '') + itemWords;
  }, 0);
  return `${Math.max(1, Math.round(words / 200))} min read`;
}

export function countWordsInContent(content: ContentBlock[]): number {
  const blocks = Array.isArray(content) ? content : [];
  return blocks.reduce((sum, b) => {
    if (!b) return sum;
    const itemWords = Array.isArray(b.items)
      ? b.items.reduce((s, it) => s + countWords(it), 0)
      : 0;
    return sum + countWords(b.text || '') + itemWords;
  }, 0);
}

export function makeBlock(type: BlockType = 'p'): ContentBlock {
  if (type === 'image') return { type, src: '', alt: '', caption: '' };
  if (LIST_TYPES.includes(type)) return { type, items: [] };
  return { type, text: '' };
}

// ─── Inline markdown formatting helpers ──────────────────────────────────────
// Storage format stays markdown-shorthand so the public renderer is unchanged:
//   **bold**   *italic*   [anchor](/path)

export interface TextEdit {
  text: string;
  selStart: number;
  selEnd: number;
}

/** Wrap the current selection in `before` + `after`. If no selection, insert
 *  empty markers and place the caret between them. */
export function wrapSelection(
  value: string,
  selStart: number,
  selEnd: number,
  before: string,
  after: string,
): TextEdit {
  const sel = value.slice(selStart, selEnd);
  const next = `${value.slice(0, selStart)}${before}${sel}${after}${value.slice(selEnd)}`;
  if (sel) {
    return {
      text: next,
      selStart: selStart + before.length,
      selEnd: selEnd + before.length,
    };
  }
  return {
    text: next,
    selStart: selStart + before.length,
    selEnd: selStart + before.length,
  };
}

/** Toggle a symmetric token (e.g. ** or *) around the selection. */
export function toggleInline(
  value: string,
  selStart: number,
  selEnd: number,
  token: string,
): TextEdit {
  const sel = value.slice(selStart, selEnd);
  if (!sel) return wrapSelection(value, selStart, selEnd, token, token);
  const wrapped = `${token}${sel}${token}`;
  const before = value.slice(0, selStart);
  const after = value.slice(selEnd);
  const isWrapped =
    before.endsWith(token) && after.startsWith(token) && sel.length > 0;
  if (isWrapped) {
    const stripped = `${before.slice(0, -token.length)}${sel}${after.slice(token.length)}`;
    return {
      text: stripped,
      selStart: selStart - token.length,
      selEnd: selEnd - token.length,
    };
  }
  const next = `${before}${wrapped}${after}`;
  return {
    text: next,
    selStart: selStart + token.length,
    selEnd: selEnd + token.length,
  };
}

/** Wrap the selection as a markdown link. Prompts for the URL. */
export function insertLink(
  value: string,
  selStart: number,
  selEnd: number,
  url: string,
): TextEdit {
  const sel = value.slice(selStart, selEnd) || 'anchor text';
  const md = `[${sel}](${url})`;
  const next = `${value.slice(0, selStart)}${md}${value.slice(selEnd)}`;
  return {
    text: next,
    selStart: selStart + 1,
    selEnd: selStart + 1 + sel.length,
  };
}