import { expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { TEMPLATES } from './registry';
import { renderDocument, renderDocuments } from '../pdf-render';
import { templateSample } from '@/app/shared/document-templates/template-sample';
function streams(raw: string) {
  return Array.from(raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g))
    .map((match) => {
      try {
        return inflateSync(Buffer.from(match[1], 'latin1')).toString('latin1');
      } catch {
        return match[1];
      }
    })
    .join('\n');
}
it('renders all eight sample PDFs and preserves financial text in their page streams', () => {
  mkdirSync('/tmp/document-template-preview', { recursive: true });
  for (const t of TEMPLATES) {
    const doc = renderDocument({ ...templateSample(), templateId: t.id });
    const content = streams(doc.output());
    expect(content).toContain('285,950.00');
    expect(content).toContain('266,000.00');
    expect(content).toContain('19,950.00');
    expect(content).toContain('Harbour House');
    writeFileSync(
      `/tmp/document-template-preview/${t.id}.pdf`,
      Buffer.from(doc.output('arraybuffer'))
    );
  }
});
it('bulk exports retain both documents and separate page counts', () => {
  const sample = templateSample();
  const doc = renderDocuments([
    { ...sample, templateId: 'modern', number: 'FIRST' },
    { ...sample, templateId: 'ledger', number: 'SECOND' },
  ]);
  expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2);
  const content = streams(doc.output());
  expect(content).toContain('FIRST');
  expect(content).toContain('SECOND');
});
it('long notes and final rows survive pagination in every style', () => {
  for (const t of TEMPLATES) {
    const sample = templateSample();
    const rows = Array.from({ length: 120 }, (_, i) => [
      { text: `Product ${i}` },
      { text: '4' },
      { text: 'NGN 40,000.00' },
    ]);
    const doc = renderDocument({
      ...sample,
      templateId: t.id,
      table: { ...sample.table, rows },
      sections: [{ title: 'Terms', body: 'Long terms with details. '.repeat(600) + 'FINAL TERMS' }],
    });
    const content = streams(doc.output());
    expect(content).toContain('Product 119');
    expect(content).toContain('FINAL TERMS');
  }
});
it('writes a review catalogue containing all eight approved layouts', () => {
  const models = TEMPLATES.map((t) => ({
    ...templateSample(),
    templateId: t.id,
    sections: [{ title: `${t.name} template`, body: t.description + '. Demonstration data only.' }],
  }));
  const doc = renderDocuments(models);
  expect(doc.getNumberOfPages()).toBe(8);
  writeFileSync(
    '/tmp/document-template-preview/template-catalogue.pdf',
    Buffer.from(doc.output('arraybuffer'))
  );
});
