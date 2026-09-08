import type { DocumentModel, DocCell, DocAlign } from './doc-model';
const WINANSI_EXTRAS = '€‚ƒ„…†‡ˆ‰Š‹Œ' + 'Ž‘’“”•–—˜™š›' + 'œžŸ';

const SUBSTITUTES: Record<string, string> = {
  '✓': '', // ✓ — the renderer draws a vector tick instead
  '✔': '',
  '✗': 'x',
  '✘': 'x',
  '−': '-', // − MINUS SIGN
  '₦': 'NGN ', // ₦
  '→': '->',
  '≤': '<=',
  '≥': '>=',
};

export function safeText(s: string): string {
  let out = '';
  for (const ch of s) {
    if (ch.codePointAt(0)! <= 0xff || WINANSI_EXTRAS.includes(ch)) {
      out += ch;
      continue;
    }
    out += SUBSTITUTES[ch] ?? '?';
  }
  return out;
}

function safeCell(c: DocCell): DocCell {
  return {
    ...c,
    text: safeText(c.text),
    sub: c.sub == null ? c.sub : safeText(c.sub),
  };
}

/** Encoding-clean a whole model once, so no individual draw call can forget. */
export function sanitize(m: DocumentModel): DocumentModel {
  const pair = ([a, b]: [string, string]): [string, string] => [safeText(a), safeText(b)];
  return {
    ...m,
    companyName: safeText(m.companyName),
    head: m.head && {
      address: m.head.address == null ? undefined : safeText(m.head.address),
      city: m.head.city == null ? undefined : safeText(m.head.city),
      email: m.head.email == null ? undefined : safeText(m.head.email),
      phone: m.head.phone == null ? undefined : safeText(m.head.phone),
    },
    department: safeText(m.department),
    docTitle: safeText(m.docTitle),
    number: safeText(m.number),
    parties: m.parties.map((p) => ({
      ...p,
      heading: safeText(p.heading),
      name: safeText(p.name),
      lines: p.lines?.map(safeText),
    })),
    meta: m.meta.map(pair),
    table: {
      columns: m.table.columns.map((c) => ({ ...c, label: safeText(c.label) })),
      rows: m.table.rows.map((r) => r.map(safeCell)),
    },
    miniTables: m.miniTables?.map((t) => ({
      ...t,
      title: safeText(t.title),
      columns: t.columns.map(([l, a]) => [safeText(l), a] as [string, DocAlign]),
      rows: t.rows.map((r) => r.map(safeCell)),
    })),
    kvGroups: m.kvGroups?.map((g) => ({
      ...g,
      title: safeText(g.title),
      items: g.items.map(pair),
    })),
    totals: m.totals.map((t) => ({
      ...t,
      label: safeText(t.label),
      value: safeText(t.value),
    })),
    words: m.words == null ? m.words : safeText(m.words),
    notice: m.notice && {
      ...m.notice,
      title: safeText(m.notice.title),
      body: safeText(m.notice.body),
    },
    sections: m.sections.map((s) => ({
      title: safeText(s.title),
      body: safeText(s.body),
    })),
    signatures: m.signatures.map((s) => ({
      role: safeText(s.role),
      name: s.name == null ? s.name : safeText(s.name),
    })),
    watermark: m.watermark == null ? m.watermark : safeText(m.watermark),
  };
}
