import type { FilterConfig, DatePreset, GroupByOption, FilterCategory } from './advanced-search-types';

export const FILTER_CONFIGS: FilterConfig[] = [
  { id: 'activity_state', label: 'Activity State', field: 'activityState', type: 'select', category: 'general', options: [{ label: 'Planned', value: 'planned' }, { label: 'Done', value: 'done' }, { label: 'Canceled', value: 'canceled' }] },
  { id: 'campaign', label: 'Campaign', field: 'campaign', type: 'text', category: 'general' },
  { id: 'cart_recovery', label: 'Cart recovery email already sent', field: 'cartRecoveryEmailSent', type: 'boolean', category: 'general' },
  { id: 'company', label: 'Company', field: 'company', type: 'text', category: 'general' },
  { id: 'country_code', label: 'Country code', field: 'countryCode', type: 'text', category: 'general' },
  { id: 'created_by', label: 'Created by', field: 'createdBy', type: 'text', category: 'general' },
  { id: 'creation_date', label: 'Creation Date', field: 'createdAt', type: 'date-range', category: 'dates' },
  { id: 'currency', label: 'Currency', field: 'currency', type: 'select', category: 'general', options: [{ label: 'NGN', value: 'NGN' }, { label: 'USD', value: 'USD' }, { label: 'EUR', value: 'EUR' }, { label: 'GBP', value: 'GBP' }] },
  { id: 'customer', label: 'Customer', field: 'customer', type: 'text', category: 'customer' },
  { id: 'customer_reference', label: 'Customer Reference', field: 'customerReference', type: 'text', category: 'customer' },
  { id: 'default_sales_price_include', label: 'Default Sales Price Include', field: 'defaultSalesPriceInclude', type: 'select', category: 'pricing', options: [{ label: 'Tax Included', value: 'tax_included' }, { label: 'Tax Excluded', value: 'tax_excluded' }] },
  { id: 'delivery_address', label: 'Delivery Address', field: 'deliveryAddress', type: 'text', category: 'delivery' },
  { id: 'delivery_date', label: 'Delivery Date', field: 'deliveryDate', type: 'date-range', category: 'delivery' },
  { id: 'delivery_message', label: 'Delivery Message', field: 'deliveryMessage', type: 'text', category: 'delivery' },
  { id: 'delivery_method', label: 'Delivery Method', field: 'deliveryMethod', type: 'text', category: 'delivery' },
  { id: 'delivery_status', label: 'Delivery Status', field: 'deliveryStatus', type: 'select', category: 'delivery', options: [{ label: 'Not Delivered', value: 'not_delivered' }, { label: 'Partially Delivered', value: 'partially_delivered' }, { label: 'Fully Delivered', value: 'fully_delivered' }] },
  { id: 'delivery_cost_recompute', label: 'Delivery cost should be recomputed', field: 'deliveryCostRecompute', type: 'boolean', category: 'delivery' },
  { id: 'disabled_auto_rewards', label: 'Disabled Auto Rewards', field: 'disabledAutoRewards', type: 'boolean', category: 'general' },
  { id: 'effective_date', label: 'Effective Date', field: 'effectiveDate', type: 'date-range', category: 'dates' },
  { id: 'expiration', label: 'Expiration', field: 'validUntil', type: 'date-range', category: 'dates' },
  { id: 'fiscal_position', label: 'Fiscal Position', field: 'fiscalPosition', type: 'text', category: 'general' },
  { id: 'headers_footers', label: 'Headers/Footers', field: 'headersFooters', type: 'text', category: 'general' },
  { id: 'incoterm', label: 'Incoterm', field: 'incoterm', type: 'text', category: 'delivery' },
  { id: 'incoterm_location', label: 'Incoterm Location', field: 'incotermLocation', type: 'text', category: 'delivery' },
  { id: 'invoice_address', label: 'Invoice Address', field: 'invoiceAddress', type: 'text', category: 'customer' },
  { id: 'invoice_status', label: 'Invoice Status', field: 'invoiceStatus', type: 'select', category: 'status', options: [{ label: 'Not Invoiced', value: 'not_invoiced' }, { label: 'Invoiced', value: 'invoiced' }] },
  { id: 'invoicing_journal', label: 'Invoicing Journal', field: 'invoicingJournal', type: 'text', category: 'general' },
  { id: 'last_updated_by', label: 'Last Updated by', field: 'lastUpdatedBy', type: 'text', category: 'general' },
  { id: 'last_updated_on', label: 'Last Updated on', field: 'updatedAt', type: 'date-range', category: 'dates' },
  { id: 'locked', label: 'Locked', field: 'locked', type: 'boolean', category: 'general' },
  { id: 'manually_applied_coupons', label: 'Manually Applied Coupons', field: 'manuallyAppliedCoupons', type: 'text', category: 'pricing' },
  { id: 'manually_triggered_rules', label: 'Manually Triggered Rules', field: 'manuallyTriggeredRules', type: 'text', category: 'general' },
  { id: 'medium', label: 'Medium', field: 'medium', type: 'text', category: 'general' },
  { id: 'online_payment', label: 'Online payment', field: 'onlinePayment', type: 'boolean', category: 'general' },
  { id: 'online_signature', label: 'Online signature', field: 'onlineSignature', type: 'boolean', category: 'general' },
  { id: 'opportunity', label: 'Opportunity', field: 'opportunity', type: 'text', category: 'general' },
  { id: 'order_date', label: 'Order Date', field: 'createdAt', type: 'date-range', category: 'dates' },
  { id: 'order_reference', label: 'Order Reference', field: 'soNumber', type: 'text', category: 'general' },
  { id: 'payment_method', label: 'Payment Method', field: 'paymentMethod', type: 'select', category: 'general', options: [{ label: 'Cash', value: 'cash' }, { label: 'Card', value: 'card' }, { label: 'Transfer', value: 'transfer' }, { label: 'POS', value: 'pos' }, { label: 'Wallet', value: 'wallet' }, { label: 'Split', value: 'split' }] },
  { id: 'payment_ref', label: 'Payment Ref.', field: 'paymentRef', type: 'text', category: 'general' },
  { id: 'payment_terms', label: 'Payment Terms', field: 'paymentTerms', type: 'select', category: 'general', options: [{ label: 'Immediate', value: 'immediate' }, { label: 'Net 7', value: 'net_7' }, { label: 'Net 15', value: 'net_15' }, { label: 'Net 30', value: 'net_30' }, { label: 'Net 45', value: 'net_45' }, { label: 'Net 60', value: 'net_60' }, { label: 'End of Month', value: 'end_of_month' }] },
  { id: 'pending_email_template', label: 'Pending Email Template', field: 'pendingEmailTemplate', type: 'text', category: 'general' },
  { id: 'pricelist', label: 'Pricelist', field: 'pricelist', type: 'text', category: 'pricing' },
  { id: 'project', label: 'Project', field: 'project', type: 'text', category: 'general' },
  { id: 'project_account', label: 'Project Account', field: 'projectAccount', type: 'text', category: 'general' },
  { id: 'quotation_template', label: 'Quotation Template', field: 'quotationTemplate', type: 'text', category: 'general' },
  { id: 'quote_calculator', label: 'Quote calculator', field: 'quoteCalculator', type: 'text', category: 'general' },
  { id: 'references', label: 'References', field: 'references', type: 'text', category: 'general' },
  { id: 'sales_team', label: 'Sales Team', field: 'salesTeam', type: 'text', category: 'sales' },
  { id: 'salesperson', label: 'Salesperson', field: 'salesperson', type: 'text', category: 'sales' },
  { id: 'security_token', label: 'Security Token', field: 'securityToken', type: 'text', category: 'general' },
  { id: 'shipping_policy', label: 'Shipping Policy', field: 'shippingPolicy', type: 'text', category: 'delivery' },
  { id: 'signed_by', label: 'Signed By', field: 'signedBy', type: 'text', category: 'general' },
  { id: 'signed_on', label: 'Signed On', field: 'signedOn', type: 'date-range', category: 'dates' },
  { id: 'source', label: 'Source', field: 'source', type: 'text', category: 'general' },
  { id: 'source_document', label: 'Source Document', field: 'sourceDocument', type: 'text', category: 'general' },
  { id: 'status', label: 'Status', field: 'status', type: 'select', category: 'status', options: [{ label: 'Draft', value: 'draft' }, { label: 'Sent', value: 'sent' }, { label: 'Accepted', value: 'accepted' }, { label: 'Rejected', value: 'rejected' }, { label: 'Confirmed', value: 'confirmed' }, { label: 'Fulfilled', value: 'fulfilled' }, { label: 'Cancelled', value: 'cancelled' }] },
  { id: 'tags', label: 'Tags', field: 'tags', type: 'text', category: 'general' },
  { id: 'tax_calculation_rounding', label: 'Tax Calculation Rounding Method', field: 'taxRoundingMethod', type: 'select', category: 'pricing', options: [{ label: 'Round Per Line', value: 'per_line' }, { label: 'Round Globally', value: 'globally' }] },
  { id: 'terms_conditions', label: 'Terms & Conditions format', field: 'terms', type: 'text', category: 'general' },
  { id: 'transactions', label: 'Transactions', field: 'transactions', type: 'text', category: 'general' },
  { id: 'warehouse', label: 'Warehouse', field: 'warehouse', type: 'text', category: 'delivery' },
  { id: 'warning', label: 'Warning', field: 'warning', type: 'text', category: 'general' },
  { id: 'website', label: 'Website', field: 'website', type: 'text', category: 'general' },
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
  { id: 'today', label: 'Today', getRange: () => [startOfDay(new Date()), new Date()] },
  { id: 'yesterday', label: 'Yesterday', getRange: () => {
    const d = new Date(); d.setDate(d.getDate() - 1);
    return [startOfDay(d), endOfDay(d)];
  }},
  { id: 'last7', label: 'Last 7 Days', getRange: () => {
    const d = new Date(); d.setDate(d.getDate() - 6);
    return [startOfDay(d), new Date()];
  }},
  { id: 'this-week', label: 'This Week', getRange: () => {
    const d = new Date(); const dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow);
    return [startOfDay(d), new Date()];
  }},
  { id: 'this-month', label: 'This Month', getRange: () => [new Date(new Date().getFullYear(), new Date().getMonth(), 1), new Date()] },
  { id: 'last-month', label: 'Last Month', getRange: () => {
    const s = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
    const e = new Date(new Date().getFullYear(), new Date().getMonth(), 0, 23, 59, 59, 999);
    return [s, e];
  }},
  { id: 'this-quarter', label: 'This Quarter', getRange: () => {
    const q = Math.floor(new Date().getMonth() / 3) * 3;
    return [new Date(new Date().getFullYear(), q, 1), new Date()];
  }},
  { id: 'last-quarter', label: 'Last Quarter', getRange: () => {
    const now = new Date(); const q = Math.floor(now.getMonth() / 3);
    const startQ = ((q - 1 + 4) % 4); const yearOff = q === 0 ? -1 : 0;
    const sy = now.getFullYear() + yearOff;
    const s = new Date(sy, startQ * 3, 1);
    const e = new Date(sy, startQ * 3 + 3, 0, 23, 59, 59, 999);
    return [s, e];
  }},
  { id: 'this-year', label: 'This Year', getRange: () => [new Date(new Date().getFullYear(), 0, 1), new Date()] },
  { id: 'last-year', label: 'Last Year', getRange: () => {
    const y = new Date().getFullYear() - 1;
    return [new Date(y, 0, 1), new Date(y, 11, 31, 23, 59, 59, 999)];
  }},
  { id: 'custom', label: 'Custom Range', getRange: () => null },
];

export const GROUP_BY_OPTIONS: GroupByOption[] = [
  { id: 'salesperson', label: 'Salesperson', field: 'salesperson' },
  { id: 'customer', label: 'Customer', field: 'customer' },
  { id: 'orderDate', label: 'Order Date', field: 'createdAt', subOptions: [
    { id: 'year', label: 'Year', field: 'createdAt' },
    { id: 'quarter', label: 'Quarter', field: 'createdAt' },
    { id: 'month', label: 'Month', field: 'createdAt' },
    { id: 'week', label: 'Week', field: 'createdAt' },
    { id: 'day', label: 'Day', field: 'createdAt' },
  ]},
  { id: 'paymentMethod', label: 'Payment Method', field: 'paymentMethod' },
  { id: 'defaultSalesPriceInclude', label: 'Default Sales Price Include', field: 'defaultSalesPriceInclude' },
];

export const DOC_TYPE_FILTERS = [
  { id: 'my', label: 'My Quotations', field: 'salesperson' },
  { id: 'quotation', label: 'Quotations', field: 'docType', value: 'quotation' },
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
