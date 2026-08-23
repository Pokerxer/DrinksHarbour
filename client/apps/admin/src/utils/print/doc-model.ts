// Typed description of a printable purchase document. Builders in ./ *-print.ts
// produce these models; pdf-render.ts turns one into a real branded PDF.
// Keeping layout data separate from rendering keeps every document testable.

export type DocAlign = 'left' | 'center' | 'right';

/** One table cell: main text, optional secondary gray line, optional styling. */
export interface DocCell {
  text: string;
  sub?: string;
  /** Hex text color override, e.g. '#16a34a' for a fully received count. */
  color?: string;
  strong?: boolean;
}

export interface DocColumn {
  label: string;
  align?: DocAlign;
}

export interface DocTable {
  columns: DocColumn[];
  rows: DocCell[][];
}

export type DocTotalVariant = 'normal' | 'strong' | 'grand';

export interface DocTotalRow {
  label: string;
  value: string;
  variant?: DocTotalVariant;
  color?: string;
}

export interface DocPartyBox {
  heading: string;
  name: string;
  lines?: string[];
}

export interface DocSection {
  title: string;
  body: string;
}

/** Labelled key/value strip, e.g. shipment carrier + tracking number. */
export interface DocKvGroup {
  title: string;
  items: [string, string][];
}

/** Small secondary table under the main one, e.g. bill payment history. */
export interface DocMiniTable {
  title: string;
  columns: [string, DocAlign][];
  rows: DocCell[][];
}

export interface DocSignature {
  role: string;
  name?: string;
}

export interface DocumentModel {
  kind: 'rfq' | 'po' | 'bill' | 'transfer' | 'return';
  companyName: string;
  /** Small chip under the company name, e.g. "Purchase Department". */
  department: string;
  /** Right-hand document label, e.g. "Request for Quotation". */
  docTitle: string;
  number: string;
  status?: string;
  parties: DocPartyBox[];
  meta: [string, string][];
  table: DocTable;
  miniTables?: DocMiniTable[];
  kvGroups?: DocKvGroup[];
  totals: DocTotalRow[];
  /** "Four Million… Naira Only" — rendered under the totals when present. */
  words?: string;
  /** Banner directly under the header band, e.g. backorder provenance. */
  notice?: { tone: 'info' | 'warn'; title: string; body: string };
  sections: DocSection[];
  signatures: DocSignature[];
  watermark?: string;
  fileName: string;
}
