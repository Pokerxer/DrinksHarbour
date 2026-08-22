import { describe, expect, test } from 'vitest';
import { parseInline, parseMessage } from './chat-markdown.ts';

/**
 * The chatbot's mini-markdown, ported from `ChatbotWidget.tsx:8-133`.
 *
 * The web parses and renders in one pass, returning React nodes. That cannot be
 * tested in vitest's `node` environment, so this returns a block tree and the
 * screen maps it — the parse rules stay assertable, the rendering stays dumb.
 */

const text = (t) => ({ kind: 'text', text: t });
const bold = (t) => ({ kind: 'bold', text: t });
const link = (t, href) => ({ kind: 'link', text: t, href });

describe('parseInline', () => {
  test('plain text is one node', () => {
    expect(parseInline('Just words')).toEqual([text('Just words')]);
  });

  test('**bold** becomes a bold node', () => {
    expect(parseInline('a **b** c')).toEqual([text('a '), bold('b'), text(' c')]);
  });

  test('a markdown link becomes a link node, internal href preserved', () => {
    expect(parseInline('See [your cart](/cart) now')).toEqual([
      text('See '),
      link('your cart', '/cart'),
      text(' now'),
    ]);
  });

  test('an external link keeps its absolute href', () => {
    expect(parseInline('[site](https://drinksharbour.com)')).toEqual([
      link('site', 'https://drinksharbour.com'),
    ]);
  });

  test('links are split before bold, so both survive in one line', () => {
    expect(parseInline('**Total**: [pay](/checkout)')).toEqual([
      bold('Total'),
      text(': '),
      link('pay', '/checkout'),
    ]);
  });

  test('emits no empty text nodes', () => {
    for (const node of parseInline('**a**')) expect(node.text).not.toBe('');
  });

  test('an empty string yields no nodes', () => {
    expect(parseInline('')).toEqual([]);
  });
});

describe('parseMessage', () => {
  test('a bare line is a paragraph', () => {
    expect(parseMessage('Hello there')).toEqual([
      { kind: 'paragraph', content: [text('Hello there')] },
    ]);
  });

  test('a blank line is a spacer block, not dropped', () => {
    expect(parseMessage('a\n\nb')).toEqual([
      { kind: 'paragraph', content: [text('a')] },
      { kind: 'blank' },
      { kind: 'paragraph', content: [text('b')] },
    ]);
  });

  test('a whole-line **Header** is a header, not a bold paragraph', () => {
    expect(parseMessage('**About this bottle**')).toEqual([
      { kind: 'header', text: 'About this bottle' },
    ]);
  });

  test('a header tolerates a trailing colon', () => {
    expect(parseMessage('**Grand Total:**')).toEqual([{ kind: 'header', text: 'Grand Total:' }]);
  });

  test('three or more dashes is a divider', () => {
    expect(parseMessage('---')).toEqual([{ kind: 'divider' }]);
    expect(parseMessage('———')).toEqual([{ kind: 'divider' }]);
  });

  test('bullets are recognised in all three markers', () => {
    expect(parseMessage('• one\n- two\n* three').map((b) => b.kind)).toEqual([
      'bullet',
      'bullet',
      'bullet',
    ]);
  });

  test('a bullet indented two spaces or more is nested', () => {
    expect(parseMessage('- top\n  - under')).toEqual([
      { kind: 'bullet', nested: false, content: [text('top')] },
      { kind: 'bullet', nested: true, content: [text('under')] },
    ]);
  });

  test('numbered items keep their marker so the list is not renumbered', () => {
    // The AI sometimes starts at 2, or skips. Echoing the marker keeps the
    // rendered list agreeing with the text the model actually wrote.
    expect(parseMessage('2. second\n3) third')).toEqual([
      { kind: 'numbered', marker: '2', nested: false, content: [text('second')] },
      { kind: 'numbered', marker: '3', nested: false, content: [text('third')] },
    ]);
  });

  test('bullet content is parsed inline too', () => {
    expect(parseMessage('- 2 × **Lagavulin** (70cl)')).toEqual([
      {
        kind: 'bullet',
        nested: false,
        content: [text('2 × '), bold('Lagavulin'), text(' (70cl)')],
      },
    ]);
  });

  test('consecutive pipe lines collapse into ONE table block', () => {
    const [block, ...rest] = parseMessage('| Drink | Price |\n|---|---|\n| Gin | ₦5,000 |');

    expect(rest).toEqual([]);
    expect(block.kind).toBe('table');
    expect(block.header).toEqual([[text('Drink')], [text('Price')]]);
    expect(block.rows).toEqual([[[text('Gin')], [text('₦5,000')]]]);
  });

  test('the table separator row is dropped, not rendered as data', () => {
    const [block] = parseMessage('| A |\n| :--- |\n| x |');

    expect(block.rows).toEqual([[[text('x')]]]);
  });

  test('a table with only a header still parses', () => {
    const [block] = parseMessage('| A | B |');

    expect(block.header).toEqual([[text('A')], [text('B')]]);
    expect(block.rows).toEqual([]);
  });

  test('text after a table resumes as normal blocks', () => {
    expect(parseMessage('| A |\n|---|\n| x |\nAfterwards').map((b) => b.kind)).toEqual([
      'table',
      'paragraph',
    ]);
  });

  test('the real add-to-cart confirmation parses end to end', () => {
    const blocks = parseMessage(
      '✅ Done! Added to your cart:\n• 2 × **Lagavulin 16** (70cl)\n\n[View cart](/cart) when ready.'
    );

    expect(blocks.map((b) => b.kind)).toEqual(['paragraph', 'bullet', 'blank', 'paragraph']);
    expect(blocks[3].content).toEqual([link('View cart', '/cart'), text(' when ready.')]);
  });

  test('an empty message yields no blocks', () => {
    expect(parseMessage('')).toEqual([]);
  });
});
