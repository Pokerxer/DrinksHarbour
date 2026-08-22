/**
 * The chatbot's mini-markdown: **bold**, [links](/path), bullets, numbered
 * lists, whole-line **Headers**, `---` dividers and pipe tables.
 *
 * Ported from `ChatbotWidget.tsx:8-133`, with one structural change: the web
 * parses and emits React nodes in a single pass, which cannot be asserted in
 * vitest's `node` environment. This returns a block tree instead, so the parse
 * rules are testable and the screen's renderer stays a dumb `map`.
 *
 * Not a general markdown parser and not meant to become one — it handles
 * exactly what the assistant is prompted to emit.
 */

export type InlineNode =
  | { kind: 'text'; text: string }
  | { kind: 'bold'; text: string }
  | { kind: 'link'; text: string; href: string };

export type Block =
  | { kind: 'blank' }
  | { kind: 'divider' }
  | { kind: 'header'; text: string }
  | { kind: 'paragraph'; content: InlineNode[] }
  | { kind: 'bullet'; nested: boolean; content: InlineNode[] }
  | { kind: 'numbered'; marker: string; nested: boolean; content: InlineNode[] }
  | { kind: 'table'; header: InlineNode[][]; rows: InlineNode[][][] };

const LINK_SPLIT = /(\[[^\]]+\]\([^)]+\))/g;
const LINK_MATCH = /^\[([^\]]+)\]\(([^)]+)\)$/;
const BOLD_SPLIT = /(\*\*[^*]+\*\*)/g;

/** Links are split BEFORE bold, so a bold label inside a link cannot break it. */
export function parseInline(text: string): InlineNode[] {
  const out: InlineNode[] = [];

  for (const part of text.split(LINK_SPLIT)) {
    if (!part) continue;

    const linkMatch = part.match(LINK_MATCH);
    if (linkMatch) {
      out.push({ kind: 'link', text: linkMatch[1], href: linkMatch[2] });
      continue;
    }

    for (const fragment of part.split(BOLD_SPLIT)) {
      if (!fragment) continue;
      if (fragment.startsWith('**') && fragment.endsWith('**')) {
        out.push({ kind: 'bold', text: fragment.slice(2, -2) });
      } else {
        out.push({ kind: 'text', text: fragment });
      }
    }
  }

  return out;
}

const isTableLine = (l: string) => /^\s*\|.*\|\s*$/.test(l);
const isTableSeparator = (l: string) => /^\s*\|[\s:|-]+\|\s*$/.test(l);

function splitRow(line: string): InlineNode[][] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => parseInline(cell.trim()));
}

export function parseMessage(text: string): Block[] {
  if (!text) return [];

  const lines = text.split('\n');
  const out: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // A run of consecutive |…| lines is one table.
    if (isTableLine(line)) {
      const tableLines: string[] = [];
      while (i < lines.length && isTableLine(lines[i])) {
        tableLines.push(lines[i]);
        i += 1;
      }
      const rows = tableLines.filter((l) => !isTableSeparator(l)).map(splitRow);
      if (rows.length) out.push({ kind: 'table', header: rows[0], rows: rows.slice(1) });
      continue;
    }

    if (!line.trim()) {
      out.push({ kind: 'blank' });
      i += 1;
      continue;
    }

    if (/^\s*[-—]{3,}\s*$/.test(line)) {
      out.push({ kind: 'divider' });
      i += 1;
      continue;
    }

    // A whole line that is nothing but **…** is a section header.
    const header = line.match(/^\*\*([^*]+)\*\*:?\s*$/);
    if (header) {
      out.push({ kind: 'header', text: header[1] });
      i += 1;
      continue;
    }

    const bullet = line.match(/^(\s*)[•\-*]\s+(.*)/);
    const numbered = line.match(/^\s*(\d+)[.)]\s+(.*)/);

    if (bullet) {
      out.push({
        kind: 'bullet',
        nested: bullet[1].length >= 2,
        content: parseInline(bullet[2]),
      });
      i += 1;
      continue;
    }

    if (numbered) {
      // The marker is echoed rather than regenerated: the assistant sometimes
      // starts at 2 or skips a number, and a renumbered list would disagree
      // with the text it actually wrote.
      out.push({
        kind: 'numbered',
        marker: numbered[1],
        nested: false,
        content: parseInline(numbered[2]),
      });
      i += 1;
      continue;
    }

    out.push({ kind: 'paragraph', content: parseInline(line) });
    i += 1;
  }

  return out;
}
