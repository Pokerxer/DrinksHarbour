export const TEMPLATE_IDS = [
  'classic',
  'modern',
  'editorial',
  'ledger',
  'signature',
  'axis',
  'atelier',
  'blueprint',
] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];
export type DocumentFamily = 'sales' | 'purchases' | 'pricelist' | 'stock';
export interface TemplatePreferences {
  version?: 1;
  defaultTemplate: string;
  families?: Partial<Record<DocumentFamily, string>>;
}
export interface DocumentTemplate {
  id: TemplateId;
  name: string;
  description: string;
  accent: string;
  secondary: string;
  wash: string;
  font: 'helvetica' | 'times' | 'courier';
  density: number;
  headerHeight: number;
  table: 'grid' | 'striped' | 'plain';
  parties: 'cards' | 'open' | 'ruled';
  totals: 'bar' | 'rule' | 'frame';
}
export const TEMPLATES: readonly DocumentTemplate[] = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'Formal red masthead and gold details',
    accent: '#b20202',
    secondary: '#c9a227',
    wash: '#fdf7f7',
    font: 'helvetica',
    density: 6,
    headerHeight: 108,
    table: 'striped',
    parties: 'cards',
    totals: 'bar',
  },
  {
    id: 'modern',
    name: 'Modern',
    description: 'Open columns and a bold navy title',
    accent: '#153b67',
    secondary: '#3185cf',
    wash: '#eef5fb',
    font: 'helvetica',
    density: 8,
    headerHeight: 120,
    table: 'plain',
    parties: 'open',
    totals: 'bar',
  },
  {
    id: 'editorial',
    name: 'Editorial',
    description: 'Serif typography and fine burgundy rules',
    accent: '#762c3c',
    secondary: '#a17954',
    wash: '#faf7f4',
    font: 'times',
    density: 8,
    headerHeight: 115,
    table: 'plain',
    parties: 'open',
    totals: 'rule',
  },
  {
    id: 'ledger',
    name: 'Ledger',
    description: 'Compact monochrome for detailed reports',
    accent: '#222222',
    secondary: '#555555',
    wash: '#f4f4f4',
    font: 'courier',
    density: 3.5,
    headerHeight: 86,
    table: 'grid',
    parties: 'ruled',
    totals: 'rule',
  },
  {
    id: 'signature',
    name: 'Signature',
    description: 'Rich green, gold and framed summaries',
    accent: '#174b3a',
    secondary: '#b78b36',
    wash: '#f1f6f2',
    font: 'times',
    density: 7,
    headerHeight: 124,
    table: 'striped',
    parties: 'cards',
    totals: 'frame',
  },
  {
    id: 'axis',
    name: 'Axis',
    description: 'Charcoal reference rail with teal accents',
    accent: '#24343b',
    secondary: '#087f82',
    wash: '#eff8f7',
    font: 'helvetica',
    density: 6,
    headerHeight: 130,
    table: 'plain',
    parties: 'ruled',
    totals: 'bar',
  },
  {
    id: 'atelier',
    name: 'Atelier',
    description: 'Centered letterhead and warm terracotta',
    accent: '#a14b35',
    secondary: '#bd9276',
    wash: '#fbf6f2',
    font: 'times',
    density: 9,
    headerHeight: 138,
    table: 'plain',
    parties: 'open',
    totals: 'rule',
  },
  {
    id: 'blueprint',
    name: 'Blueprint',
    description: 'Outlined modules and numbered sections',
    accent: '#205ba0',
    secondary: '#517dab',
    wash: '#f2f6fc',
    font: 'helvetica',
    density: 5,
    headerHeight: 114,
    table: 'grid',
    parties: 'ruled',
    totals: 'frame',
  },
];
export function templateById(id?: string): DocumentTemplate {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}
export function documentFamily(kind: string): DocumentFamily {
  if (kind === 'pricelist') return 'pricelist';
  if (['transfer', 'return', 'stock'].includes(kind)) return 'stock';
  if (['rfq', 'po', 'bill'].includes(kind)) return 'purchases';
  return 'sales';
}
export function resolveTemplate(
  preferences: TemplatePreferences | undefined,
  kind: string,
  override?: string
): TemplateId {
  return templateById(
    override ?? preferences?.families?.[documentFamily(kind)] ?? preferences?.defaultTemplate
  ).id;
}
