import type {
  FilterConfig,
  DatePreset,
  GroupByOption,
  FilterCategory,
} from './advanced-search-types';

// Every entry's `field` MUST be a real SalesOrder document path. The server
// resolves a filter by that path and drops anything it does not recognise, so a
// config naming a field the schema does not have is a control that silently
// does nothing — which is what the previous 64-entry list mostly was
// (`activityState`, `salesTeam`, `tasks`, `website`, `invoiceStatus`,
// `deliveryStatus`, `expectedDate`… none of them exist on SalesOrder).
//
// Keep this list honest: if you add a filter here, the path has to exist.
export const FILTER_CONFIGS: FilterConfig[] = [
  // ── Dates ──────────────────────────────────────────────────────────────
  {
    id: 'creation_date',
    label: 'Creation Date',
    field: 'createdAt',
    type: 'date-range',
    category: 'dates',
  },
  {
    id: 'last_updated_on',
    label: 'Last Updated on',
    field: 'updatedAt',
    type: 'date-range',
    category: 'dates',
  },
  {
    id: 'expiration',
    label: 'Expiration',
    field: 'validUntil',
    type: 'date-range',
    category: 'dates',
  },
  {
    id: 'due_date',
    label: 'Due Date',
    field: 'dueDate',
    type: 'date-range',
    category: 'dates',
  },

  // ── Customer ───────────────────────────────────────────────────────────
  {
    id: 'customer',
    label: 'Customer',
    field: 'customerSnapshot.name',
    type: 'text',
    category: 'customer',
  },

  // ── General ────────────────────────────────────────────────────────────
  {
    id: 'order_reference',
    label: 'Order Reference',
    field: 'soNumber',
    type: 'text',
    category: 'general',
  },
  {
    id: 'currency',
    label: 'Currency',
    field: 'currency',
    type: 'select',
    category: 'general',
    options: [
      { label: 'NGN', value: 'NGN' },
      { label: 'USD', value: 'USD' },
      { label: 'EUR', value: 'EUR' },
      { label: 'GBP', value: 'GBP' },
    ],
  },
  {
    id: 'payment_method',
    label: 'Payment Method',
    field: 'paymentMethod',
    type: 'select',
    category: 'general',
    options: [
      { label: 'Cash', value: 'cash' },
      { label: 'Card', value: 'card' },
      { label: 'Transfer', value: 'transfer' },
      { label: 'POS', value: 'pos' },
      { label: 'Wallet', value: 'wallet' },
      { label: 'Split', value: 'split' },
    ],
  },
  {
    id: 'payment_terms',
    label: 'Payment Terms',
    field: 'paymentTerms',
    type: 'select',
    category: 'general',
    options: [
      { label: 'Immediate', value: 'immediate' },
      { label: 'Net 7', value: 'net_7' },
      { label: 'Net 15', value: 'net_15' },
      { label: 'Net 30', value: 'net_30' },
      { label: 'Net 45', value: 'net_45' },
      { label: 'Net 60', value: 'net_60' },
      { label: 'End of Month', value: 'end_of_month' },
    ],
  },

  // ── Sales ──────────────────────────────────────────────────────────────
  // A name, not a ref — `salesperson` is a String written from req.user.name.
  {
    id: 'salesperson',
    label: 'Salesperson',
    field: 'salesperson',
    type: 'text',
    category: 'sales',
  },

  // ── Status ─────────────────────────────────────────────────────────────
  // Orders and quotations carry separate lifecycle fields, so one "Status"
  // control cannot serve both — it would have to guess which field to name.
  {
    id: 'order_status',
    label: 'Order Status',
    field: 'orderStatus',
    type: 'select',
    category: 'status',
    options: [
      { label: 'Draft', value: 'draft' },
      { label: 'Confirmed', value: 'confirmed' },
      { label: 'Partially Fulfilled', value: 'partially_fulfilled' },
      { label: 'Fulfilled', value: 'fulfilled' },
      { label: 'Cancelled', value: 'cancelled' },
    ],
  },
  {
    id: 'quote_status',
    label: 'Quotation Status',
    field: 'quoteStatus',
    type: 'select',
    category: 'status',
    options: [
      { label: 'Draft', value: 'draft' },
      { label: 'Sent', value: 'sent' },
      { label: 'Accepted', value: 'accepted' },
      { label: 'Rejected', value: 'rejected' },
      { label: 'Expired', value: 'expired' },
      { label: 'Converted', value: 'converted' },
    ],
  },
  // Without this a partially-paid order is unfindable: 'partial' is neither of
  // the two values the old UI could ask for.
  {
    id: 'payment_status',
    label: 'Payment Status',
    field: 'paymentStatus',
    type: 'select',
    category: 'status',
    options: [
      { label: 'Unpaid', value: 'unpaid' },
      { label: 'Partial', value: 'partial' },
      { label: 'Paid', value: 'paid' },
    ],
  },

  // ── Pricing ────────────────────────────────────────────────────────────
  {
    id: 'coupon_code',
    label: 'Coupon Code',
    field: 'couponCode',
    type: 'text',
    category: 'pricing',
  },
  {
    id: 'total',
    label: 'Total',
    field: 'total',
    type: 'number',
    category: 'pricing',
  },
  {
    id: 'amount_paid',
    label: 'Amount Paid',
    field: 'amountPaid',
    type: 'number',
    category: 'pricing',
  },
];

function startOfDay(d: Date): Date {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  return s;
}
function endOfDay(d: Date): Date {
  const e = new Date(d);
  e.setHours(23, 59, 59, 999);
  return e;
}

export const DATE_PRESETS: DatePreset[] = [
  {
    id: 'today',
    label: 'Today',
    getRange: () => [startOfDay(new Date()), new Date()],
  },
  {
    id: 'yesterday',
    label: 'Yesterday',
    getRange: () => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return [startOfDay(d), endOfDay(d)];
    },
  },
  {
    id: 'last7',
    label: 'Last 7 Days',
    getRange: () => {
      const d = new Date();
      d.setDate(d.getDate() - 6);
      return [startOfDay(d), new Date()];
    },
  },
  {
    id: 'this-week',
    label: 'This Week',
    getRange: () => {
      const d = new Date();
      const dow = (d.getDay() + 6) % 7;
      d.setDate(d.getDate() - dow);
      return [startOfDay(d), new Date()];
    },
  },
  {
    id: 'this-month',
    label: 'This Month',
    getRange: () => [
      new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      new Date(),
    ],
  },
  {
    id: 'last-month',
    label: 'Last Month',
    getRange: () => {
      const s = new Date(
        new Date().getFullYear(),
        new Date().getMonth() - 1,
        1
      );
      const e = new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        0,
        23,
        59,
        59,
        999
      );
      return [s, e];
    },
  },
  {
    id: 'this-quarter',
    label: 'This Quarter',
    getRange: () => {
      const q = Math.floor(new Date().getMonth() / 3) * 3;
      return [new Date(new Date().getFullYear(), q, 1), new Date()];
    },
  },
  {
    id: 'last-quarter',
    label: 'Last Quarter',
    getRange: () => {
      const now = new Date();
      const q = Math.floor(now.getMonth() / 3);
      const startQ = (q - 1 + 4) % 4;
      const yearOff = q === 0 ? -1 : 0;
      const sy = now.getFullYear() + yearOff;
      const s = new Date(sy, startQ * 3, 1);
      const e = new Date(sy, startQ * 3 + 3, 0, 23, 59, 59, 999);
      return [s, e];
    },
  },
  {
    id: 'this-year',
    label: 'This Year',
    getRange: () => [new Date(new Date().getFullYear(), 0, 1), new Date()],
  },
  {
    id: 'last-year',
    label: 'Last Year',
    getRange: () => {
      const y = new Date().getFullYear() - 1;
      return [new Date(y, 0, 1), new Date(y, 11, 31, 23, 59, 59, 999)];
    },
  },
  { id: 'custom', label: 'Custom Range', getRange: () => null },
];

export const GROUP_BY_OPTIONS: GroupByOption[] = [
  { id: 'salesperson', label: 'Salesperson', field: 'salesperson' },
  { id: 'customer', label: 'Customer', field: 'customer' },
  {
    id: 'orderDate',
    label: 'Order Date',
    field: 'createdAt',
    subOptions: [
      { id: 'year', label: 'Year', field: 'createdAt' },
      { id: 'quarter', label: 'Quarter', field: 'createdAt' },
      { id: 'month', label: 'Month', field: 'createdAt' },
      { id: 'week', label: 'Week', field: 'createdAt' },
      { id: 'day', label: 'Day', field: 'createdAt' },
    ],
  },
  { id: 'paymentMethod', label: 'Payment Method', field: 'paymentMethod' },
  // `defaultSalesPriceInclude` used to sit here; its extractor returned the
  // literal 'N/A' for every order, so the grouping was one bucket called N/A.
  { id: 'paymentStatus', label: 'Payment Status', field: 'paymentStatus' },
  { id: 'orderStatus', label: 'Order Status', field: 'orderStatus' },
];

export const DOC_TYPE_FILTERS = [
  { id: 'my', label: 'My Quotations', field: 'salesperson' },
  {
    id: 'quotation',
    label: 'Quotations',
    field: 'docType',
    value: 'quotation',
  },
  { id: 'order', label: 'Sales Orders', field: 'docType', value: 'order' },
];

export const FILTER_CATEGORIES: { id: FilterCategory; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'dates', label: 'Dates' },
  { id: 'customer', label: 'Customer' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'delivery', label: 'Delivery' },
  { id: 'status', label: 'Status' },
  { id: 'sales', label: 'Sales' },
  { id: 'other', label: 'Other' },
];
