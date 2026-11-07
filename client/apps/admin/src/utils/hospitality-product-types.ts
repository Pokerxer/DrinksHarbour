// Keep in sync with server/constants/generalProductTypes.js hospitalityTypes
// (hospitality/foodservice supply round, 2026-11-02). Supply category is
// 'hospitality' server-side; every value here is a non-beverage type
// (beverage=false), exactly like the retail verticals above them.
// Values mirror the server registry exactly; labels are the server display
// names; `category` mirrors the server TYPE_CATEGORIES group names the same
// way generalProductTypeOptions/retailProductTypeOptions mirror server groups.
// NEVER rename a value: marketCategories/catalogKind map them server-side.
export type HospitalityGroup = 'Foodservice' | 'Hospitality';

export const hospitalityProductTypeValues = [
  // Foodservice — kitchen & pantry supply for tenant ERM (14 types)
  'foodservice_produce',
  'foodservice_meat',
  'foodservice_seafood',
  'foodservice_dairy',
  'foodservice_bakery',
  'foodservice_staples',
  'foodservice_frozen',
  'foodservice_condiment',
  'foodservice_disposables',
  'foodservice_cleaning',
  'foodservice_kitchen_smallware',
  'foodservice_tabletop_bar',
  'foodservice_janitorial',
  'foodservice_equipment',
  // Hospitality — clubs & lounges retail
  'hospitality_shisha_kit',
  'hospitality_shisha_flavour',
  'hospitality_charcoal',
  'hospitality_cigar',
  'hospitality_shisha_accessory',
  'hospitality_cigar_accessory',
  'hospitality_cigar_storage',
  'hospitality_venue_apparel',
  'hospitality_venue_drinkware',
  'hospitality_venue_gift_pack',
] as const;

export const hospitalityProductTypeOptions: ReadonlyArray<{
  value: string;
  label: string;
  category: HospitalityGroup;
}> = [
  // Foodservice (kitchen / pantry / venue fit-out supplies)
  { value: 'foodservice_produce', label: 'Fresh Produce', category: 'Foodservice' },
  { value: 'foodservice_meat', label: 'Meat & Poultry', category: 'Foodservice' },
  { value: 'foodservice_seafood', label: 'Seafood', category: 'Foodservice' },
  { value: 'foodservice_dairy', label: 'Dairy & Eggs', category: 'Foodservice' },
  { value: 'foodservice_bakery', label: 'Bakery & Bread', category: 'Foodservice' },
  { value: 'foodservice_staples', label: 'Dry Goods & Staples', category: 'Foodservice' },
  { value: 'foodservice_frozen', label: 'Frozen Foods', category: 'Foodservice' },
  { value: 'foodservice_condiment', label: 'Condiments & Spices', category: 'Foodservice' },
  { value: 'foodservice_disposables', label: 'Disposables & Packaging', category: 'Foodservice' },
  { value: 'foodservice_cleaning', label: 'Cleaning Chemicals & Sanitisers', category: 'Foodservice' },
  { value: 'foodservice_kitchen_smallware', label: 'Commercial Kitchen Smallwares', category: 'Foodservice' },
  { value: 'foodservice_tabletop_bar', label: 'Tabletop & Bar Service', category: 'Foodservice' },
  { value: 'foodservice_janitorial', label: 'Janitorial Supplies', category: 'Foodservice' },
  { value: 'foodservice_equipment', label: 'Commercial Kitchen & Bar Equipment', category: 'Foodservice' },
  // Hospitality (shisha, tobacco, accessories and venue merchandise)
  { value: 'hospitality_shisha_kit', label: 'Shisha & Hookah', category: 'Hospitality' },
  { value: 'hospitality_shisha_flavour', label: 'Shisha Flavour (Molasses)', category: 'Hospitality' },
  { value: 'hospitality_charcoal', label: 'Charcoal & Heating', category: 'Hospitality' },
  { value: 'hospitality_cigar', label: 'Cigars & Tobacco', category: 'Hospitality' },
  { value: 'hospitality_shisha_accessory', label: 'Shisha Parts & Accessories', category: 'Hospitality' },
  { value: 'hospitality_cigar_accessory', label: 'Cigar Cutters & Lighters', category: 'Hospitality' },
  { value: 'hospitality_cigar_storage', label: 'Humidors & Cigar Cases', category: 'Hospitality' },
  { value: 'hospitality_venue_apparel', label: 'Venue Apparel', category: 'Hospitality' },
  { value: 'hospitality_venue_drinkware', label: 'Branded Drinkware', category: 'Hospitality' },
  { value: 'hospitality_venue_gift_pack', label: 'Venue Gift Packs', category: 'Hospitality' },
];

// Age-restricted subset (server truth, enforced server-side). 'vape' was
// already age-restricted before the hospitality round; the three shisha/
// tobacco types join it. This is display intent only — the form's existing
// "Age Verification" flag (requiresAgeVerification, Settings section) is how
// the intent surfaces; no new client-side gate is introduced.
export const AGE_RESTRICTED_HOSPITALITY_TYPES = [
  'hospitality_shisha_kit',
  'hospitality_shisha_flavour',
  'hospitality_cigar',
] as const;
