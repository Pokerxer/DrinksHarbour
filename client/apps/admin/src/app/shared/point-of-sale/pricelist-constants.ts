// Shared pricelist constants — single source of truth used across admin, POS, and promotions
// @ts-nocheck

export const RULE_TYPE_META = {
  discount:       { label: 'Discount',        color: '#059669', bg: '#ecfdf5', border: '#a7f3d0', hint: 'Stacks on current price in sequence order' },
  flash_sale:     { label: 'Flash Sale',      color: '#d97706', bg: '#fffbeb', border: '#fcd34d', hint: 'Time-limited urgency discount' },
  fixed:          { label: 'Fixed Price',     color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', hint: 'Sets the selling price directly' },
  formula:        { label: 'Formula',         color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe', hint: 'Price = cost × (1 + markup%)' },
  bundle:         { label: 'Bundle',          color: '#9333ea', bg: '#faf5ff', border: '#e9d5ff', hint: 'Qty threshold deal — applied at order time' },
  cart_threshold: { label: 'Spend Threshold', color: '#0d9488', bg: '#f0fdfa', border: '#99f6e4', hint: 'Cart-level discount when spend threshold is met' },
} as const;

export type RuleCategory = 'permanent' | 'dynamic';

/** permanent = writes baseSellingPrice to DB when Applied; dynamic = session-only */
export const RULE_CATEGORY: Record<string, RuleCategory> = {
  fixed:          'permanent',
  formula:        'permanent',
  discount:       'dynamic',
  flash_sale:     'dynamic',
  bundle:         'dynamic',
  cart_threshold: 'dynamic',
};

export const RULE_CATEGORY_META: Record<RuleCategory, { label: string; color: string; hint: string }> = {
  permanent: {
    label: 'Permanent',
    color: '#2563eb',
    hint:  'Updates base price in DB when "Apply prices" is clicked',
  },
  dynamic: {
    label: 'Dynamic',
    color: '#059669',
    hint:  'Only activates when this pricelist is selected in a POS session',
  },
};
