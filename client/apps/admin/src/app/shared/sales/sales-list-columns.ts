// The orders list's column set — one declaration, used by the header row, the
// body rows, the colspan and the column chooser.
//
// It used to be three lists: the JSX headers, the JSX cells, and OPTIONAL_COLS
// in the chooser, plus a hand-maintained arithmetic colspan. They drifted:
// eight of the fourteen offered toggles rendered nothing at all, and several
// named a field SalesOrder does not have. A column that is declared here is
// rendered; one that is not declared cannot be offered.

export type ColumnAlign = 'left' | 'right' | 'center';

export interface ListColumn {
  key: string;
  label: string;
  align?: ColumnAlign;
  /** Optional columns can be toggled off in the chooser; the rest always render. */
  optional: boolean;
  /** Only meaningful when optional. */
  defaultVisible?: boolean;
}

export interface OptionalCol {
  key: string;
  label: string;
  visible: boolean;
}

// Declaration order is render order.
export const LIST_COLUMNS: ListColumn[] = [
  { key: 'select', label: '', optional: false },
  { key: 'soNumber', label: 'Number', optional: false },
  {
    key: 'creationDate',
    label: 'Creation Date',
    optional: true,
    defaultVisible: true,
  },
  { key: 'customer', label: 'Customer', optional: false },
  { key: 'salesperson', label: 'Salesperson', optional: false },
  {
    key: 'activities',
    label: 'Activities',
    align: 'center',
    optional: true,
    defaultVisible: true,
  },
  {
    key: 'untaxedAmount',
    label: 'Untaxed Amt',
    align: 'right',
    optional: true,
    defaultVisible: false,
  },
  {
    key: 'total',
    label: 'Total',
    align: 'right',
    optional: true,
    defaultVisible: true,
  },
  {
    key: 'warehouse',
    label: 'Warehouse',
    optional: true,
    defaultVisible: true,
  },
  // `validUntil` on the schema — the only one of the old date toggles with a
  // field behind it. deliveryDate/expectedDate had none and are gone.
  {
    key: 'expiration',
    label: 'Expiration',
    optional: true,
    defaultVisible: false,
  },
  // Derived from `relatedInvoice`.
  {
    key: 'invoiceStatus',
    label: 'Invoice Status',
    optional: true,
    defaultVisible: false,
  },
  // paymentStatus + amountPaid. Shown by default: a partially-paid order that
  // renders no payment cell is money already taken and nowhere on the page.
  { key: 'payment', label: 'Payment', optional: true, defaultVisible: true },
  { key: 'status', label: 'Status', optional: false },
];

export const OPTIONAL_COLS: OptionalCol[] = LIST_COLUMNS.filter(
  (c) => c.optional
).map((c) => ({
  key: c.key,
  label: c.label,
  visible: c.defaultVisible ?? false,
}));

/**
 * The columns to render, in declaration order. A non-optional column is always
 * included — a stale saved preference naming one must not drop a cell the
 * header still emits.
 */
export function visibleColumns(cols: OptionalCol[]): ListColumn[] {
  return LIST_COLUMNS.filter(
    (c) =>
      !c.optional ||
      (cols.find((o) => o.key === c.key)?.visible ?? c.defaultVisible ?? false)
  );
}

/** The table's colspan. Derived, so it cannot disagree with the header row. */
export function visibleColumnCount(cols: OptionalCol[]): number {
  return visibleColumns(cols).length;
}
