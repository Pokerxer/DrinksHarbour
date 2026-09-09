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
    description: 'Original red and gold document design',
    accent: '#b20202',
    secondary: '#c9a227',
    wash: '#fdf7f7',
    font: 'helvetica',
    density: 5.5,
    headerHeight: 116,
    table: 'grid',
    parties: 'cards',
    totals: 'bar',
  },
  {
    id: 'modern',
    name: 'Modern',
    description: 'Original design in navy and blue',
    accent: '#153b67',
    secondary: '#3185cf',
    wash: '#eef5fb',
    font: 'helvetica',
    density: 5.5,
    headerHeight: 116,
    table: 'grid',
    parties: 'cards',
    totals: 'bar',
  },
  {
    id: 'editorial',
    name: 'Editorial',
    description: 'Original design in burgundy and bronze',
    accent: '#762c3c',
    secondary: '#a17954',
    wash: '#faf7f4',
    font: 'helvetica',
    density: 5.5,
    headerHeight: 116,
    table: 'grid',
    parties: 'cards',
    totals: 'bar',
  },
  {
    id: 'ledger',
    name: 'Ledger',
    description: 'Original design in charcoal and grey',
    accent: '#222222',
    secondary: '#555555',
    wash: '#f4f4f4',
    font: 'helvetica',
    density: 5.5,
    headerHeight: 116,
    table: 'grid',
    parties: 'cards',
    totals: 'bar',
  },
  {
    id: 'signature',
    name: 'Signature',
    description: 'Original design in green and gold',
    accent: '#174b3a',
    secondary: '#b78b36',
    wash: '#f1f6f2',
    font: 'helvetica',
    density: 5.5,
    headerHeight: 116,
    table: 'grid',
    parties: 'cards',
    totals: 'bar',
  },
  {
    id: 'axis',
    name: 'Axis',
    description: 'Original design in charcoal and teal',
    accent: '#24343b',
    secondary: '#087f82',
    wash: '#eff8f7',
    font: 'helvetica',
    density: 5.5,
    headerHeight: 116,
    table: 'grid',
    parties: 'cards',
    totals: 'bar',
  },
  {
    id: 'atelier',
    name: 'Atelier',
    description: 'Original design in terracotta and sand',
    accent: '#a14b35',
    secondary: '#bd9276',
    wash: '#fbf6f2',
    font: 'helvetica',
    density: 5.5,
    headerHeight: 116,
    table: 'grid',
    parties: 'cards',
    totals: 'bar',
  },
  {
    id: 'blueprint',
    name: 'Blueprint',
    description: 'Original design in blue and slate',
    accent: '#205ba0',
    secondary: '#517dab',
    wash: '#f2f6fc',
    font: 'helvetica',
    density: 5.5,
    headerHeight: 116,
    table: 'grid',
    parties: 'cards',
    totals: 'bar',
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
