// Keep in sync with server/constants/generalProductTypes.js retailTypes
// (electronics_/fashion_/beauty_/home_ prefixed retail verticals, 2026-11-02).
// Values mirror the 37 server strings exactly; labels are the server
// Title-Case names; `category` mirrors the server TYPE_CATEGORIES group
// names (ELECTRONICS/FASHION/BEAUTY/HOME) the same way generalProductTypeOptions
// mirror server groups. NEVER rename a value: config/marketCategories.js and
// catalogKind.js map them by prefix rule server-side.
export const retailProductTypeValues = [
  // Electronics
  'electronics_phone',
  'electronics_tablet',
  'electronics_laptop',
  'electronics_desktop',
  'electronics_printer',
  'electronics_storage',
  'electronics_computer_accessory',
  'electronics_audio',
  'electronics_tv_display',
  'electronics_camera',
  'electronics_gaming',
  'electronics_wearable',
  'electronics_networking',
  'electronics_power',
  // Fashion
  'fashion_top',
  'fashion_dress',
  'fashion_bottom',
  'fashion_outerwear',
  'fashion_innerwear',
  'fashion_shoes',
  'fashion_bag',
  'fashion_accessory',
  'fashion_watch',
  'fashion_jewellery',
  'fashion_kids',
  // Beauty
  'beauty_skincare',
  'beauty_makeup',
  'beauty_hair',
  'beauty_fragrance',
  'beauty_nails',
  'beauty_tool',
  'beauty_hygiene',
  // Home
  'home_kitchen',
  'home_cookware',
  'home_decor',
  'home_furniture',
  'home_bedding',
  'home_storage',
  'home_cleaning',
  'home_small_appliance',
  'home_lighting',
  'home_bath',
  'home_garden',
] as const;

export type RetailGroup =
  | 'Electronics'
  | 'Fashion'
  | 'Beauty'
  | 'Home';

export const retailProductTypeOptions: ReadonlyArray<{
  value: string;
  label: string;
  category: RetailGroup;
}> = [
  // Electronics
  { value: 'electronics_phone', label: 'Mobile Phone', category: 'Electronics' },
  { value: 'electronics_tablet', label: 'Tablet', category: 'Electronics' },
  { value: 'electronics_laptop', label: 'Laptop', category: 'Electronics' },
  { value: 'electronics_desktop', label: 'Desktop Computer', category: 'Electronics' },
  { value: 'electronics_printer', label: 'Printer & Scanner', category: 'Electronics' },
  { value: 'electronics_storage', label: 'Data Storage', category: 'Electronics' },
  {
    value: 'electronics_computer_accessory',
    label: 'Computer Accessory',
    category: 'Electronics',
  },
  { value: 'electronics_audio', label: 'Audio Device', category: 'Electronics' },
  {
    value: 'electronics_tv_display',
    label: 'TV & Display',
    category: 'Electronics',
  },
  { value: 'electronics_camera', label: 'Camera', category: 'Electronics' },
  {
    value: 'electronics_gaming',
    label: 'Gaming & Console',
    category: 'Electronics',
  },
  {
    value: 'electronics_wearable',
    label: 'Smart Wearable',
    category: 'Electronics',
  },
  {
    value: 'electronics_networking',
    label: 'Networking Device',
    category: 'Electronics',
  },
  {
    value: 'electronics_power',
    label: 'Power & Charging',
    category: 'Electronics',
  },
  // Fashion
  { value: 'fashion_top', label: 'Top', category: 'Fashion' },
  { value: 'fashion_dress', label: 'Dress', category: 'Fashion' },
  { value: 'fashion_bottom', label: 'Bottoms', category: 'Fashion' },
  { value: 'fashion_outerwear', label: 'Outerwear', category: 'Fashion' },
  {
    value: 'fashion_innerwear',
    label: 'Innerwear & Sleep',
    category: 'Fashion',
  },
  { value: 'fashion_shoes', label: 'Shoes', category: 'Fashion' },
  { value: 'fashion_bag', label: 'Bags & Luggage', category: 'Fashion' },
  {
    value: 'fashion_accessory',
    label: 'Fashion Accessory',
    category: 'Fashion',
  },
  { value: 'fashion_watch', label: 'Watches', category: 'Fashion' },
  { value: 'fashion_jewellery', label: 'Jewellery', category: 'Fashion' },
  { value: 'fashion_kids', label: 'Kids Fashion', category: 'Fashion' },
  // Beauty
  { value: 'beauty_skincare', label: 'Skincare', category: 'Beauty' },
  { value: 'beauty_makeup', label: 'Makeup', category: 'Beauty' },
  {
    value: 'beauty_hair',
    label: 'Hair Care & Styling',
    category: 'Beauty',
  },
  { value: 'beauty_fragrance', label: 'Fragrance', category: 'Beauty' },
  { value: 'beauty_nails', label: 'Nails & Manicure', category: 'Beauty' },
  {
    value: 'beauty_tool',
    label: 'Beauty Tool & Appliance',
    category: 'Beauty',
  },
  { value: 'beauty_hygiene', label: 'Personal Hygiene', category: 'Beauty' },
  // Home
  { value: 'home_kitchen', label: 'Kitchen & Dining', category: 'Home' },
  {
    value: 'home_cookware',
    label: 'Cookware & Bakeware',
    category: 'Home',
  },
  { value: 'home_decor', label: 'Home Decor', category: 'Home' },
  { value: 'home_furniture', label: 'Furniture', category: 'Home' },
  {
    value: 'home_bedding',
    label: 'Bedding & Textile',
    category: 'Home',
  },
  {
    value: 'home_storage',
    label: 'Storage & Organisation',
    category: 'Home',
  },
  {
    value: 'home_cleaning',
    label: 'Cleaning & Household',
    category: 'Home',
  },
  {
    value: 'home_small_appliance',
    label: 'Small Home Appliance',
    category: 'Home',
  },
  { value: 'home_lighting', label: 'Lighting', category: 'Home' },
  { value: 'home_bath', label: 'Bath & Bathroom Accessories', category: 'Home' },
  { value: 'home_garden', label: 'Garden & Outdoor', category: 'Home' },
];

// Mirror of server getSizesForType sizeKind contracts (apparel/shoes/storage).
// Apparel matches server/models/Size.js enum: xs..6xl + one_size (includes
// 6xl, which constants/productTypes.js STANDARD_SIZES.APPAREL still lacks).
export const SIZE_GROUPS = {
  apparel: {
    category: 'Apparel',
    values: ['xs', 's', 'm', 'l', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', 'one_size'],
  },
  shoes: {
    category: 'Shoes',
    values: [
      'eu-35', 'eu-36', 'eu-37', 'eu-38', 'eu-39', 'eu-40', 'eu-41',
      'eu-42', 'eu-43', 'eu-44', 'eu-45', 'eu-46', 'eu-47',
      'us-m-6', 'us-m-7', 'us-m-8', 'us-m-8.5', 'us-m-9', 'us-m-10',
      'us-m-11', 'us-m-12', 'us-m-13',
      'us-w-4', 'us-w-5', 'us-w-6', 'us-w-7', 'us-w-8', 'us-w-9',
      'us-w-10', 'us-w-11', 'us-w-12',
    ],
  },
  storage: {
    category: 'Device Storage',
    values: [
      'storage-16gb', 'storage-32gb', 'storage-64gb', 'storage-128gb',
      'storage-256gb', 'storage-512gb', 'storage-1tb', 'storage-2tb',
      'storage-4tb',
    ],
  },
  // Electronics sizing systems (2026-11-03) — mirrors server
  // STANDARD_SIZES.{SCREEN_INCH,RAM,BATTERY}.
  screen: {
    category: 'Screen Size',
    values: ['screen-24', 'screen-32', 'screen-43', 'screen-50', 'screen-55', 'screen-65', 'screen-75', 'screen-85'],
  },
  portableScreen: {
    category: 'Portable Screen Size',
    values: [
      'screen-7', 'screen-8', 'screen-8.7', 'screen-9', 'screen-10.1', 'screen-10.9',
      'screen-11', 'screen-12.4', 'screen-12.5', 'screen-12.9', 'screen-13', 'screen-13.3',
      'screen-14', 'screen-15', 'screen-15.6', 'screen-16', 'screen-17.3', 'screen-18',
    ],
  },
  ram: {
    category: 'RAM',
    values: ['ram-4gb', 'ram-8gb', 'ram-16gb', 'ram-32gb', 'ram-64gb'],
  },
  battery: {
    category: 'Battery Capacity',
    values: ['battery-5000mah', 'battery-10000mah', 'battery-20000mah', 'battery-26800mah'],
  },
} as const;

/**
 * Filter the size-picker option list down to the server's per-type guidance
 * (industry-scoping round, 2026-11-03): a fashion product sees only its
 * apparel/numeric/waist/inseam/kids/shoe sizes; a beverage product keeps its
 * bottle/weight families; a null/absent guidance (unknown type, legacy
 * flow, fetch failure) returns the FULL list unchanged — the safe fallback.
 */
export function sizeOptionsForGuidance<T extends { value: string }>(
  options: readonly T[],
  guidance: readonly string[] | null | undefined,
): T[] {
  if (!guidance || guidance.length === 0) return [...options];
  const allowed = new Set(guidance);
  return options.filter((option) => allowed.has(option.value));
}
