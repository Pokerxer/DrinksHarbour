import { expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { pdfPageStreams } from './pdf-test-content';
import { TEMPLATES } from './registry';
import { COLLECTION_IDS } from './layout-collection';
import { LAYOUT_IDS } from './layout-presets';
import { renderDocument, renderDocuments } from '../pdf-render';
import { templateSample } from '@/app/shared/document-templates/template-sample';
function streams(raw: string) {
  return pdfPageStreams(raw).join('\n');
}
it('renders all twenty-eight sample PDFs and preserves financial text in their page streams', () => {
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
it.each(TEMPLATES)(
  'long notes and final rows survive pagination in $name',
  (t) => {
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
      sections: [
        {
          title: 'Terms',
          body: 'Long terms with details. '.repeat(600) + 'FINAL TERMS',
        },
      ],
    });
    const content = streams(doc.output());
    expect(content).toContain('Product 119');
    expect(content).toContain('FINAL TERMS');
  }
);
it('writes a review catalogue containing all twenty-eight layouts', () => {
  const models = TEMPLATES.map((t) => ({
    ...templateSample(),
    templateId: t.id,
    sections: [
      {
        title: `${t.name} template`,
        body: t.description + '. Demonstration data only.',
      },
    ],
  }));
  const doc = renderDocuments(models);
  expect(doc.getNumberOfPages()).toBe(TEMPLATES.length);
  writeFileSync(
    '/tmp/document-template-preview/template-catalogue.pdf',
    Buffer.from(doc.output('arraybuffer'))
  );
});

it('gives all new invoice mastheads different text positions', () => {
  const placements = [...LAYOUT_IDS, ...COLLECTION_IDS].map((templateId) => {
    const content = streams(
      renderDocument({ ...templateSample(), templateId }).output()
    );
    const positionOf = (label: string) => {
      const positions = [
        ...content.matchAll(
          new RegExp(`([^\\n]+ Td)\\n\\(${label}\\) Tj`, 'g')
        ),
      ];
      expect(positions.length, label).toBeGreaterThan(0);
      return positions.at(-1)![1];
    };
    return [positionOf('Harbour House'), positionOf('INVOICE')].join(' / ');
  });
  expect(new Set(placements).size).toBe(20);
});

it('places totals before itemisation only in Balance First', () => {
  for (const templateId of [...LAYOUT_IDS, ...COLLECTION_IDS]) {
    const content = streams(
      renderDocument({ ...templateSample(), templateId }).output()
    );
    const total = content.indexOf('285,950.00');
    const item = content.indexOf('Reserve Red Wine');
    expect(total).toBeGreaterThan(-1);
    expect(item).toBeGreaterThan(-1);
    expect(total < item).toBe(templateId === 'balance-first');
  }
});
