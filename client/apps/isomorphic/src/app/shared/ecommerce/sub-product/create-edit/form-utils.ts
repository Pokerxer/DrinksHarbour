import { CreateProductInput } from '@/validators/create-product.schema';
import isEmpty from 'lodash/isEmpty';

// Empty objects and arrays
export const emptyTastingNotes = {
  nose: [],
  aroma: [],
  palate: [],
  taste: [],
  finish: [],
  mouthfeel: [],
  appearance: '',
  color: '',
};

export const emptyServingSuggestions = {
  temperature: '',
  glassware: '',
  garnish: [],
  mixers: [],
};

export const emptyIsDietary = {
  vegan: false,
  vegetarian: false,
  glutenFree: false,
  dairyFree: false,
  organic: false,
  kosher: false,
  halal: false,
  sugarFree: false,
  lowCalorie: false,
  lowCarb: false,
};

export const emptyNutritionalInfo = {
  calories: undefined,
  carbohydrates: undefined,
  sugar: undefined,
  protein: undefined,
  fat: undefined,
  sodium: undefined,
  caffeine: undefined,
};

export const emptyRatings = {
  wineSpectator: undefined,
  robertParker: undefined,
  jamesSuckling: undefined,
  decanter: undefined,
  whiskyAdvocate: undefined,
  jimMurray: undefined,
  untappd: undefined,
};

export const emptyCertifications = [];

export const emptyAwards = [];

export const emptyExternalLinks = [];

export const emptySubProductData = {
  // Core Relationships
  product: '',
  tenant: '',
  createNewProduct: false,
  newProductData: null,
  
  // Commercial Data
  sku: '',
  baseSellingPrice: undefined,
  costPrice: undefined,
  currency: 'NGN',
  taxRate: 0,
  marginPercentage: undefined,
  markupPercentage: 25,
  roundUp: 'none',
  saleDiscountPercentage: 0,
  
  // Sale / Discount Pricing
  salePrice: undefined,
  saleStartDate: undefined,
  saleEndDate: undefined,
  saleType: undefined,
  saleDiscountValue: undefined,
  saleBanner: {
    url: '',
    alt: '',
  },
  isOnSale: false,
  
  // Tenant Overrides
  shortDescriptionOverride: '',
  descriptionOverride: '',
  imagesOverride: [],
  customKeywords: [],
  embeddingOverride: [],
  tenantNotes: '',
  
  // Sizes
  sizes: [],
  sellWithoutSizeVariants: false,
  defaultSize: undefined,
  
  // Inventory Management
  stockStatus: 'in_stock',
  totalStock: 0,
  reservedStock: 0,
  availableStock: 0,
  lowStockThreshold: 10,
  reorderPoint: 5,
  reorderQuantity: 50,
  lastRestockDate: undefined,
  nextRestockDate: undefined,
  
  // Vendor & Sourcing
  vendor: '',
  supplierSKU: '',
  supplierPrice: undefined,
  leadTimeDays: undefined,
  minimumOrderQuantity: undefined,
  
  // Status fields
  status: 'draft',
  isFeaturedByTenant: false,
  isNewArrival: false,
  isBestSeller: false,
  addedAt: undefined,
  activatedAt: undefined,
  deactivatedAt: undefined,
  discontinuedAt: undefined,
  
  // Promotions & Discounts
  discount: 0,
  discountType: undefined,
  discountStart: undefined,
  discountEnd: undefined,
  flashSale: {
    isActive: false,
    startDate: undefined,
    endDate: undefined,
    discountPercentage: undefined,
    remainingQuantity: undefined,
  },
  bundleDeals: [],
  
  // Analytics (read-only)
  totalSold: 0,
  totalRevenue: 0,
  totalProfit: 0,
  lastSoldDate: undefined,
  viewCount: 0,
  addToCartCount: 0,
  purchaseCount: 0,
  
  // Shipping & Logistics
  shipping: {
    weight: undefined,
    length: undefined,
    width: undefined,
    height: undefined,
    fragile: true,
    requiresAgeVerification: true,
    hazmat: false,
    shippingClass: '',
  },
  warehouse: {
    location: '',
    zone: '',
    aisle: '',
    shelf: '',
    bin: '',
  },
};

export function defaultValues(product?: CreateProductInput): CreateProductInput {
  return {
    // Identification
    name: product?.name ?? '',
    slug: product?.slug ?? '',
    sku: product?.sku ?? '',
    barcode: product?.barcode ?? '',
    gtin: product?.gtin ?? '',
    upc: product?.upc ?? '',

    // Beverage-specific
    type: product?.type ?? '',
    subType: product?.subType ?? '',
    isAlcoholic: product?.isAlcoholic ?? false,
    abv: product?.abv ?? undefined,
    proof: product?.proof ?? undefined,
    volumeMl: product?.volumeMl ?? undefined,
    standardSizes: product?.standardSizes ?? [],
    servingSize: product?.servingSize ?? '',
    servingsPerContainer: product?.servingsPerContainer ?? undefined,

    // Origin & Production
    originCountry: product?.originCountry ?? '',
    region: product?.region ?? '',
    appellation: product?.appellation ?? '',
    producer: product?.producer ?? '',
    brand: product?.brand ?? '',
    vintage: product?.vintage ?? undefined,
    age: product?.age ?? undefined,
    ageStatement: product?.ageStatement ?? '',
    distilleryName: product?.distilleryName ?? '',
    breweryName: product?.breweryName ?? '',
    wineryName: product?.wineryName ?? '',
    productionMethod: product?.productionMethod ?? '',
    caskType: product?.caskType ?? '',
    finish: product?.finish ?? '',

    // Categorization
    category: product?.category ?? '',
    subCategory: product?.subCategory ?? '',
    tags: product?.tags ?? [],
    flavors: product?.flavors ?? [],
    style: product?.style ?? '',

    // Descriptive Content
    shortDescription: product?.shortDescription ?? '',
    description: product?.description ?? '',
    tastingNotes: product?.tastingNotes ?? emptyTastingNotes,
    flavorProfile: product?.flavorProfile ?? [],
    foodPairings: product?.foodPairings ?? [],
    servingSuggestions: product?.servingSuggestions ?? emptyServingSuggestions,

    // Dietary & Allergen
    isDietary: product?.isDietary ?? emptyIsDietary,
    allergens: product?.allergens ?? [],
    ingredients: product?.ingredients ?? [],
    nutritionalInfo: product?.nutritionalInfo ?? emptyNutritionalInfo,

    // Certifications & Awards
    certifications: product?.certifications ?? emptyCertifications,
    awards: product?.awards ?? emptyAwards,

    // Ratings
    ratings: product?.ratings ?? emptyRatings,
    averageRating: product?.averageRating ?? 0,
    reviewCount: product?.reviewCount ?? 0,

    // Media
    images: product?.images ?? [],
    productImages: product?.productImages ?? undefined,
    uploadedImages: product?.uploadedImages ?? [],
    videos: product?.videos ?? [],

    // Related Products & External Links
    relatedProducts: product?.relatedProducts ?? [],
    externalLinks: product?.externalLinks ?? emptyExternalLinks,

    // SEO
    metaTitle: product?.metaTitle ?? '',
    metaDescription: product?.metaDescription ?? '',
    metaKeywords: product?.metaKeywords ?? [],
    canonicalUrl: product?.canonicalUrl ?? '',

    // Settings
    isFeatured: product?.isFeatured ?? false,
    allowReviews: product?.allowReviews ?? true,
    requiresAgeVerification: product?.requiresAgeVerification ?? undefined,
    isPublished: product?.isPublished ?? false,
    publishedAt: product?.publishedAt ?? undefined,
    discontinuedAt: product?.discontinuedAt ?? undefined,

    // Analytics (read-only)
    averageSellingPrice: product?.averageSellingPrice ?? undefined,
    totalStockAvailable: product?.totalStockAvailable ?? undefined,
    totalSold: product?.totalSold ?? 0,
    totalRevenue: product?.totalRevenue ?? 0,
    viewCount: product?.viewCount ?? 0,
    wishlistCount: product?.wishlistCount ?? 0,

    // SubProduct Data
    subProductData: {
      ...emptySubProductData,
      ...product?.subProductData,
      // Ensure proper defaults
      status: product?.subProductData?.status ?? 'draft',
      activatedAt: product?.subProductData?.activatedAt ?? undefined,
      discontinuedAt: product?.subProductData?.discontinuedAt ?? undefined,
      isOnSale: product?.subProductData?.isOnSale ?? false,
      isFeaturedByTenant: product?.subProductData?.isFeaturedByTenant ?? false,
      isNewArrival: product?.subProductData?.isNewArrival ?? false,
      isBestSeller: product?.subProductData?.isBestSeller ?? false,
      sellWithoutSizeVariants: product?.subProductData?.sellWithoutSizeVariants ?? false,
      stockStatus: product?.subProductData?.stockStatus ?? 'in_stock',
      shipping: {
        ...emptySubProductData.shipping,
        ...product?.subProductData?.shipping,
        fragile: product?.subProductData?.shipping?.fragile ?? true,
        requiresAgeVerification: product?.subProductData?.shipping?.requiresAgeVerification ?? true,
        hazmat: product?.subProductData?.shipping?.hazmat ?? false,
      },
      warehouse: product?.subProductData?.warehouse ?? emptySubProductData.warehouse,
      flashSale: product?.subProductData?.flashSale ?? emptySubProductData.flashSale,
    },
  };
}

// Product types options
export const productTypes = [
  // Alcoholic Beverages
  { value: 'beer', label: 'Beer', category: 'Alcoholic' },
  { value: 'wine', label: 'Wine', category: 'Alcoholic' },
  { value: 'sparkling_wine', label: 'Sparkling Wine', category: 'Alcoholic' },
  { value: 'fortified_wine', label: 'Fortified Wine', category: 'Alcoholic' },
  { value: 'spirit', label: 'Spirit', category: 'Alcoholic' },
  { value: 'liqueur', label: 'Liqueur', category: 'Alcoholic' },
  { value: 'cocktail_ready_to_drink', label: 'Ready-to-Drink Cocktail', category: 'Alcoholic' },
  
  // Non-Alcoholic
  { value: 'non_alcoholic', label: 'Non-Alcoholic', category: 'Non-Alcoholic' },
  { value: 'juice', label: 'Juice', category: 'Non-Alcoholic' },
  { value: 'tea', label: 'Tea', category: 'Non-Alcoholic' },
  { value: 'coffee', label: 'Coffee', category: 'Non-Alcoholic' },
  { value: 'energy_drink', label: 'Energy Drink', category: 'Non-Alcoholic' },
  { value: 'water', label: 'Water', category: 'Non-Alcoholic' },
  { value: 'mixer', label: 'Mixer', category: 'Non-Alcoholic' },
  
  // Others
  { value: 'snack', label: 'Snack', category: 'Other' },
  { value: 'accessory', label: 'Accessory', category: 'Other' },
  { value: 'gift', label: 'Gift', category: 'Other' },
  { value: 'other', label: 'Other', category: 'Other' },
];

// Standard sizes options
export const standardSizes = [
  // Wine & Champagne
  { value: '75cl', label: '75cl (Standard Bottle)', volume: 750 },
  { value: '37.5cl', label: '37.5cl (Half Bottle)', volume: 375 },
  { value: '150cl', label: '150cl (Magnum)', volume: 1500 },
  { value: '18.7cl', label: '18.7cl (Split)', volume: 187 },
  
  // Spirits
  { value: '70cl', label: '70cl (Standard)', volume: 700 },
  { value: '1L', label: '1 Liter', volume: 1000 },
  { value: '50cl', label: '50cl', volume: 500 },
  { value: '35cl', label: '35cl', volume: 350 },
  { value: '20cl', label: '20cl (Flask)', volume: 200 },
  { value: '5cl', label: '5cl (Miniature)', volume: 50 },
  
  // Beer & Cider
  { value: '33cl', label: '33cl Bottle', volume: 330 },
  { value: '50cl-beer', label: '50cl Bottle', volume: 500 },
  { value: 'can-330ml', label: '330ml Can', volume: 330 },
  { value: 'can-440ml', label: '440ml Can', volume: 440 },
  { value: 'can-500ml', label: '500ml Can', volume: 500 },
  
  // Soft Drinks & Water
  { value: '330ml', label: '330ml', volume: 330 },
  { value: '500ml', label: '500ml', volume: 500 },
  { value: '1.5L', label: '1.5 Liter', volume: 1500 },
  { value: '2L', label: '2 Liter', volume: 2000 },
  
  // Multi-packs
  { value: 'pack-6', label: '6-Pack', volume: 0 },
  { value: 'pack-12', label: '12-Pack', volume: 0 },
  { value: 'case-24', label: 'Case of 24', volume: 0 },
  
  // Coffee & Tea
  { value: '250g', label: '250g', volume: 0 },
  { value: '500g', label: '500g', volume: 0 },
  { value: '1kg', label: '1kg', volume: 0 },
];

// Countries
export const countries = [
  { value: 'Nigeria', label: 'Nigeria' },
  { value: 'South Africa', label: 'South Africa' },
  { value: 'Ghana', label: 'Ghana' },
  { value: 'Kenya', label: 'Kenya' },
  { value: 'France', label: 'France' },
  { value: 'Italy', label: 'Italy' },
  { value: 'Spain', label: 'Spain' },
  { value: 'Germany', label: 'Germany' },
  { value: 'United Kingdom', label: 'United Kingdom' },
  { value: 'United States', label: 'United States' },
  { value: 'Scotland', label: 'Scotland' },
  { value: 'Ireland', label: 'Ireland' },
  { value: 'Japan', label: 'Japan' },
  { value: 'Australia', label: 'Australia' },
  { value: 'Argentina', label: 'Argentina' },
  { value: 'Chile', label: 'Chile' },
  { value: 'Mexico', label: 'Mexico' },
  { value: 'Jamaica', label: 'Jamaica' },
  { value: 'Canada', label: 'Canada' },
  { value: 'Russia', label: 'Russia' },
  { value: 'Poland', label: 'Poland' },
  { value: 'Netherlands', label: 'Netherlands' },
  { value: 'Belgium', label: 'Belgium' },
  { value: 'Portugal', label: 'Portugal' },
  { value: 'Greece', label: 'Greece' },
  { value: 'Hungary', label: 'Hungary' },
  { value: 'Austria', label: 'Austria' },
  { value: 'Czech Republic', label: 'Czech Republic' },
  { value: 'New Zealand', label: 'New Zealand' },
  { value: 'China', label: 'China' },
  { value: 'India', label: 'India' },
  { value: 'Brazil', label: 'Brazil' },
  { value: 'Peru', label: 'Peru' },
  { value: 'Turkey', label: 'Turkey' },
  { value: 'Egypt', label: 'Egypt' },
  { value: 'Morocco', label: 'Morocco' },
  { value: 'Lebanon', label: 'Lebanon' },
  { value: 'Israel', label: 'Israel' },
  { value: 'Taiwan', label: 'Taiwan' },
  { value: 'Singapore', label: 'Singapore' },
  { value: 'Thailand', label: 'Thailand' },
  { value: 'Vietnam', label: 'Vietnam' },
  { value: 'Indonesia', label: 'Indonesia' },
  { value: 'Malaysia', label: 'Malaysia' },
  { value: 'Philippines', label: 'Philippines' },
  { value: 'Other', label: 'Other' },
];

// Style options
export const styles = [
  // Beer Styles
  { value: 'pale_ale', label: 'Pale Ale', category: 'Beer' },
  { value: 'brown_ale', label: 'Brown Ale', category: 'Beer' },
  { value: 'amber_ale', label: 'Amber Ale', category: 'Beer' },
  { value: 'blonde_ale', label: 'Blonde Ale', category: 'Beer' },
  { value: 'imperial_stout', label: 'Imperial Stout', category: 'Beer' },
  { value: 'milk_stout', label: 'Milk Stout', category: 'Beer' },
  { value: 'oatmeal_stout', label: 'Oatmeal Stout', category: 'Beer' },
  { value: 'american_ipa', label: 'American IPA', category: 'Beer' },
  { value: 'english_ipa', label: 'English IPA', category: 'Beer' },
  { value: 'double_ipa', label: 'Double IPA', category: 'Beer' },
  { value: 'session_ipa', label: 'Session IPA', category: 'Beer' },
  { value: 'belgian_wit', label: 'Belgian Wit', category: 'Beer' },
  { value: 'hefeweizen', label: 'Hefeweizen', category: 'Beer' },
  { value: 'dunkelweizen', label: 'Dunkelweizen', category: 'Beer' },
  { value: 'gose', label: 'Gose', category: 'Beer' },
  { value: 'berliner_weisse', label: 'Berliner Weisse', category: 'Beer' },
  { value: 'lambic', label: 'Lambic', category: 'Beer' },
  { value: 'gueuze', label: 'Gueuze', category: 'Beer' },
  
  // Wine Styles - Sweetness
  { value: 'dry', label: 'Dry', category: 'Wine - Sweetness' },
  { value: 'off_dry', label: 'Off-Dry', category: 'Wine - Sweetness' },
  { value: 'semi_dry', label: 'Semi-Dry', category: 'Wine - Sweetness' },
  { value: 'semi_sweet', label: 'Semi-Sweet', category: 'Wine - Sweetness' },
  { value: 'sweet', label: 'Sweet', category: 'Wine - Sweetness' },
  
  // Wine Styles - Body
  { value: 'light_bodied', label: 'Light Bodied', category: 'Wine - Body' },
  { value: 'medium_bodied', label: 'Medium Bodied', category: 'Wine - Body' },
  { value: 'full_bodied', label: 'Full Bodied', category: 'Wine - Body' },
  
  // Wine Styles - Character
  { value: 'crisp', label: 'Crisp', category: 'Wine - Character' },
  { value: 'creamy', label: 'Creamy', category: 'Wine - Character' },
  { value: 'oaked', label: 'Oaked', category: 'Wine - Character' },
  { value: 'unoaked', label: 'Unoaked', category: 'Wine - Character' },
  
  // Spirit Styles
  { value: 'smooth', label: 'Smooth', category: 'Spirits' },
  { value: 'bold', label: 'Bold', category: 'Spirits' },
  { value: 'complex', label: 'Complex', category: 'Spirits' },
  { value: 'mellow', label: 'Mellow', category: 'Spirits' },
  { value: 'peated', label: 'Peated', category: 'Spirits' },
  { value: 'non_peated', label: 'Non-Peated', category: 'Spirits' },
  { value: 'smoky', label: 'Smoky', category: 'Spirits' },
  { value: 'non_smoky', label: 'Non-Smoky', category: 'Spirits' },
  
  // General
  { value: 'classic', label: 'Classic', category: 'General' },
  { value: 'modern', label: 'Modern', category: 'General' },
  { value: 'traditional', label: 'Traditional', category: 'General' },
  { value: 'innovative', label: 'Innovative', category: 'General' },
  { value: 'artisanal', label: 'Artisanal', category: 'General' },
  { value: 'premium', label: 'Premium', category: 'General' },
  { value: 'luxury', label: 'Luxury', category: 'General' },
  { value: 'budget_friendly', label: 'Budget Friendly', category: 'General' },
];

// Tasting notes options
export const tastingNotesOptions = {
  nose: [
    'Fruity', 'Citrus', 'Tropical', 'Berry', 'Stone Fruit', 'Apple', 'Pear', 'Peach', 'Cherry', 'Plum',
    'Vanilla', 'Caramel', 'Chocolate', 'Coffee', 'Toasted', 'Nutty', 'Almond', 'Hazelnut',
    'Floral', 'Rose', 'Lavender', 'Honey', 'Herbaceous', 'Mint', 'Eucalyptus',
    'Oak', 'Woody', 'Tobacco', 'Leather', 'Earthy', 'Mineral', 'Wet Stone',
    'Smoky', 'Peaty', 'Medicinal', 'Tar', 'Sea Salt', 'Brine',
    'Spicy', 'Cinnamon', 'Ginger', 'Black Pepper', 'Cloves', 'Nutmeg',
    'Creamy', 'Buttery', 'Yeasty', 'Bready', 'Dough',
    'Fresh', 'Clean', 'Zesty', 'Bright', 'Subtle', 'Pungent'
  ],
  palate: [
    'Fruity', 'Citrus', 'Tropical', 'Berry', 'Stone Fruit', 'Apple', 'Pear', 'Peach', 'Cherry', 'Plum',
    'Sweet', 'Honey', 'Vanilla', 'Caramel', 'Chocolate', 'Toffee', 'Butterscotch',
    'Spicy', 'Peppery', 'Cinnamon', 'Ginger', 'Cloves', 'Nutmeg',
    'Oak', 'Woody', 'Tannic', 'Velvety', 'Silky', 'Round',
    'Crisp', 'Fresh', 'Bright', 'Zesty', 'Lively',
    'Rich', 'Full', 'Complex', 'Layered', 'Balanced',
    'Dry', 'Medium', 'Sweet', 'Off-Dry',
    'Mineral', 'Earthy', 'Herbal', 'Minty',
    'Smoky', 'Peaty', 'Tar', 'Medicinal'
  ],
  finish: [
    'Long', 'Medium', 'Short', 'Lingering', 'Quick',
    'Smooth', 'Warm', 'Warming', 'Hot',
    'Dry', 'Sweet', 'Bitter', 'Tannic',
    'Fruity', 'Spicy', 'Oaky', 'Smoky',
    'Clean', 'Crisp', 'Refreshing',
    'Complex', 'Elegant', 'Bold', 'Delicate'
  ],
  mouthfeel: [
    'Light', 'Medium', 'Full', 'Rich', 'Heavy',
    'Silky', 'Velvety', 'Creamy', 'Buttery', 'Lush',
    'Crisp', 'CLean', 'Fresh', 'Bright',
    'Tannic', 'Grippy', 'Astringent', 'Round',
    'Effervescent', 'Petillant', 'Still',
    'Oily', 'Thick', 'Thin', 'Watery'
  ],
  color: [
    'Pale Straw', 'Straw', 'Deep Straw', 'Gold', 'Deep Gold',
    'Pale Yellow', 'Light Yellow', 'Medium Yellow', 'Deep Yellow',
    'Pale Green', 'Greenish', 'Yellow-Green',
    'Pale Pink', 'Salmon', 'Rose', 'Deep Pink',
    'Pale Ruby', 'Ruby', 'Deep Ruby', 'Garnet',
    'Pale Amber', 'Amber', 'Deep Amber', 'Copper', 'Deep Copper',
    'Brown', 'Mahogany', 'Deep Brown', 'Dark Brown', 'Black',
    'Pale Gold', 'Deep Gold', 'Old Gold'
  ],
};

// Glassware options
export const glasswareOptions = [
  { value: 'wine_glass', label: 'Wine Glass (Universal)' },
  { value: 'red_wine_glass', label: 'Red Wine Glass (Large Bowl)' },
  { value: 'white_wine_glass', label: 'White Wine Glass (Medium Bowl)' },
  { value: 'sparkling_flute', label: 'Champagne Flute' },
  { value: 'sparkling_tulip', label: 'Champagne Tulip' },
  { value: 'port_glass', label: 'Port Glass (Small)' },
  { value: 'sherry_glass', label: 'Sherry Glass' },
  { value: 'copita', label: 'Copita / Snifter' },
  { value: 'tumbler', label: 'Tumbler Glass' },
  { value: 'highball', label: 'Highball Glass' },
  { value: 'rocks_glass', label: 'Rocks / Old Fashioned Glass' },
  { value: 'martini_glass', label: 'Martini Glass' },
  { value: 'cosmopolitan_glass', label: 'Coupe Glass' },
  { value: 'beer_pilsner', label: 'Pilsner Glass' },
  { value: 'beer_weizen', label: 'Weizen Glass' },
  { value: 'beer_stout', label: 'Stout Glass' },
  { value: 'beer_nonic', label: 'Nonic Pint Glass' },
  { value: 'beer_imperial', label: 'Imperial Pint Glass' },
  { value: 'shot_glass', label: 'Shot Glass' },
  { value: 'digestif_glass', label: 'Digestif / Brandy Glass' },
  { value: 'water_glass', label: 'Water Glass' },
  { value: 'universal', label: 'Universal / All-Purpose' },
];

// Serving temperature options
export const servingTemperatures = [
  { value: 'ice_cold', label: 'Ice Cold (0-4°C)' },
  { value: 'very_cold', label: 'Very Cold (4-6°C)' },
  { value: 'cold', label: 'Cold (6-8°C)' },
  { value: 'cool', label: 'Cool (8-10°C)' },
  { value: 'cellar', label: 'Cellar Temperature (10-13°C)' },
  { value: 'room_temp', label: 'Room Temperature (18-20°C)' },
  { value: 'warm', label: 'Warm (20-25°C)' },
  { value: 'hot', label: 'Hot (60-70°C)' },
];

// Medal options for awards
export const medalOptions = [
  { value: 'platinum', label: 'Platinum' },
  { value: 'double_gold', label: 'Double Gold' },
  { value: 'gold', label: 'Gold' },
  { value: 'silver', label: 'Silver' },
  { value: 'bronze', label: 'Bronze' },
];

// External link types
export const externalLinkTypes = [
  { value: 'producer', label: 'Producer Website' },
  { value: 'review', label: 'Review' },
  { value: 'press', label: 'Press Article' },
  { value: 'social', label: 'Social Media' },
  { value: 'other', label: 'Other' },
];

// Certification options
export const certificationOptions = [
  { value: 'organic', label: 'Organic' },
  { value: 'biodynamic', label: 'Biodynamic' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'kosher', label: 'Kosher' },
  { value: 'halal', label: 'Halal' },
  { value: 'fair_trade', label: 'Fair Trade' },
  { value: 'sustainable', label: 'Sustainable' },
  { value: 'rainforest_alliance', label: 'Rainforest Alliance' },
  { value: 'utz_certified', label: 'UTZ Certified' },
  { value: 'demeter', label: 'Demeter (Biodynamic)' },
  { value: 'slow_food', label: 'Slow Food' },
  { value: 'protected_designation', label: 'Protected Designation of Origin (PDO)' },
  { value: 'protected_geographical', label: 'Protected Geographical Indication (PGI)' },
  { value: 'traditional_specialty', label: 'Traditional Specialty Guaranteed (TSG)' },
];

// Flavor profiles
export const flavorProfiles = [
  // Fruity
  'fruity', 'citrus', 'tropical', 'berry', 'apple', 'pear', 'peach', 'cherry', 'plum', 'stone_fruit',
  'dried_fruit', 'raisins', 'prunes', 'figs', 'blackberry', 'raspberry', 'strawberry', 'blueberry',
  'cranberry', 'redcurrant', 'white_peach', 'nectarine', 'apricot', 'melon', 'watermelon', 'guava',
  'passion_fruit', 'lychee', 'mango', 'pineapple', 'banana', 'orange', 'lemon', 'lime', 'grapefruit',
  'date', 'cassis', 'dark_cherry', 'red_berry',
  
  // Sweet
  'vanilla', 'caramel', 'chocolate', 'honey', 'sweet', 'butterscotch', 'toffee', 'maple',
  'dark_chocolate', 'cocoa', 'molasses', 'sugary', 'candy',
  
  // Spicy
  'spicy', 'cinnamon', 'ginger', 'herbal', 'mint', 'pepper', 'cloves', 'nutmeg', 'cardamom',
  'peppery', 'clove', 'anise', 'licorice', 'basil', 'thyme', 'rosemary', 'sage',
  
  // Floral
  'floral', 'rose', 'lavender', 'blossom', 'perfumed', 'jasmine', 'elderflower',
  'honeysuckle', 'violet', 'hibiscus', 'chamomile',
  
  // Woody
  'oak', 'woody', 'tobacco', 'leather', 'cedar', 'sandalwood', 'oaky', 'pine',
  
  // Nutty
  'nutty', 'almond', 'hazelnut', 'walnut', 'pecan', 'peanuts',
  
  // Earthy
  'earthy', 'mineral', 'wet_stone', 'mushroom', 'forest_floor', 'moss', 'slate', 'chalk', 'petrol', 'truffle',
  
  // Smoky
  'smoky', 'peaty', 'fire', 'charcoal', 'tar', 'medicinal', 'charred', 'burnt', 'ash', 'campfire', 'bacon', 'bbq',
  
  // Creamy
  'creamy', 'buttery', 'dairy', 'custard', 'cream', 'milky', 'yogurt', 'cheese',
  
  // Other
  'dry', 'bitter', 'sour', 'crisp', 'fresh', 'rich', 'full', 'complex', 'balanced', 'smooth',
  'elegant', 'delicate', 'bold', 'intense', 'subtle', 'zesty', 'lively', 'refreshing', 'soft',
  'round', 'velvety', 'tannic', 'astringent', 'bright', 'deep', 'light', 'medium', 'roasted', 'tart',
  'acidic', 'salty', 'savory', 'umami', 'clean', 'malty', 'grainy', 'biscuit', 'bread', 'toast',
  'coffee', 'espresso',
];

// Food pairing suggestions
export const foodPairings = [
  // Meats
  'Beef', 'Lamb', 'Pork', 'Duck', 'Chicken', 'Turkey', 'Venison', 'Rabbit',
  'Bacon', 'Ham', 'Sausage', 'Steak', 'Roast Beef', 'Grilled Meats',
  
  // Seafood
  'Fish', 'Salmon', 'Tuna', 'Shrimp', 'Crab', 'Lobster', 'Oysters', 'Mussels',
  'Clams', 'Scallops', 'Sushi', 'Smoked Fish',
  
  // Cheese
  'Cheddar', 'Brie', 'Camembert', 'Gouda', 'Parmesan', 'Blue Cheese', 'Goat Cheese',
  'Feta', 'Mozzarella', 'Ricotta', 'Aged Cheese', 'Soft Cheese', 'Hard Cheese',
  
  // Desserts
  'Chocolate', 'Dark Chocolate', 'White Chocolate', 'Ice Cream', 'Fruit Tart', 'Cake',
  'Tiramisu', 'Crème Brûlée', 'Cheesecake', 'Pudding', 'Berries', 'Fresh Fruit',
  
  // Vegetables
  'Mushrooms', 'Truffles', 'Asparagus', 'Roasted Vegetables', 'Salad', 'Leafy Greens',
  
  // Nuts
  'Almonds', 'Walnuts', 'Pecans', 'Hazelnuts', 'Cashews', 'Mixed Nuts',
  
  // Spices
  'Curry', 'Spicy Foods', 'Mexican', 'Indian', 'Asian', 'Mediterranean',
  
  // Other
  'Bread', 'Crackers', 'Olives', 'Antipasti', 'Charcuterie', 'Appetizers',
];

// Common garnish options
export const garnishOptions = [
  'Lemon Twist', 'Orange Peel', 'Lime Wedge', 'Lemon Wedge', 'Orange Slice',
  'Cherry', 'Olive', 'Mint Leaves', 'Rosemary', 'Thyme', 'Basil',
  'Cinnamon Stick', 'Star Anise', 'Nutmeg', 'Ginger Slice',
  'Sea Salt', 'Black Pepper', 'Chili Flakes', 'Sugar Rim', 'Salt Rim',
  'Egg White', 'Coffee Beans', 'Chocolate Shavings', 'Whipped Cream',
  'Cucumber', 'Grapefruit Peel', 'Pear Slice', 'Apple Slice',
];

// Common mixer options
export const mixerOptions = [
  'Tonic Water', 'Soda Water', 'Ginger Beer', 'Ginger Ale', 'Cola',
  'Lemonade', 'Orange Juice', 'Cranberry Juice', 'Grapefruit Juice',
  'Pineapple Juice', 'Tomato Juice', 'Clamato',
  'Simple Syrup', 'Honey Syrup', 'Agave Syrup', 'Maple Syrup',
  'Tabasco', 'Worcestershire Sauce', 'Soy Sauce',
  'Milk', 'Cream', 'Egg White', 'Espresso',
  'Coconut Water', 'Iced Tea', 'Green Tea',
];

export const formParts = {
  basicInfo: 'basic-info',
  pricing: 'pricing',
  salesDiscounts: 'sales-discounts',
  inventory: 'inventory',
  sizes: 'sizes',
  vendor: 'vendor',
  statusVisibility: 'status-visibility',
  promotions: 'promotions',
  shipping: 'shipping',
  tenantOverrides: 'tenant-overrides',
} as const;

// Allergens list
export const allergensList = [
  { value: 'Milk', label: 'Milk' },
  { value: 'Eggs', label: 'Eggs' },
  { value: 'Fish', label: 'Fish' },
  { value: 'Shellfish', label: 'Shellfish' },
  { value: 'Tree Nuts', label: 'Tree Nuts' },
  { value: 'Peanuts', label: 'Peanuts' },
  { value: 'Wheat', label: 'Wheat' },
  { value: 'Soybeans', label: 'Soybeans' },
  { value: 'Sesame', label: 'Sesame' },
  { value: 'Sulfites', label: 'Sulfites' },
  { value: 'Mustard', label: 'Mustard' },
  { value: 'Celery', label: 'Celery' },
  { value: 'Lupin', label: 'Lupin' },
  { value: 'Mollusks', label: 'Mollusks' },
];
