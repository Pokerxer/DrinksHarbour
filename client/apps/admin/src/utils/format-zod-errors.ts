import { ZodIssue, ZodError } from 'zod';

export interface FieldError {
  field: string;
  message: string;
  code: string;
  path: (string | number)[];
}

export interface FormattedError {
  errors: FieldError[];
  errorMap: Map<string, string>;
  summary: string;
  hasErrors: boolean;
  errorCount: number;
}

const humanReadablePath = (path: (string | number)[]): string => {
  return path
    .map((segment, index) => {
      if (typeof segment === 'number') {
        return `[${segment}]`;
      }
      if (index === 0) {
        return segment;
      }
      return `.${segment}`;
    })
    .join('');
};

const pathToDisplayName = (path: (string | number)[]): string => {
  if (path.length === 0) return 'Field';

  const displayNames: Record<string, string> = {
    name: 'Product Name',
    slug: 'Slug',
    sku: 'SKU',
    barcode: 'Barcode',
    gtin: 'GTIN',
    upc: 'UPC',
    type: 'Product Type',
    subType: 'Sub-Type',
    isAlcoholic: 'Alcoholic',
    abv: 'ABV',
    proof: 'Proof',
    volumeMl: 'Volume (ml)',
    standardSizes: 'Standard Sizes',
    servingSize: 'Serving Size',
    servingsPerContainer: 'Servings Per Container',
    originCountry: 'Origin Country',
    region: 'Region',
    appellation: 'Appellation',
    producer: 'Producer',
    brand: 'Brand',
    vintage: 'Vintage',
    age: 'Age',
    ageStatement: 'Age Statement',
    distilleryName: 'Distillery Name',
    breweryName: 'Brewery Name',
    wineryName: 'Winery Name',
    productionMethod: 'Production Method',
    caskType: 'Cask Type',
    finish: 'Finish',
    category: 'Category',
    subCategory: 'Sub-Category',
    tags: 'Tags',
    flavors: 'Flavors',
    flavorProfile: 'Flavor Profile',
    style: 'Style',
    shortDescription: 'Short Description',
    description: 'Description',
    tagline: 'Tagline',
    tastingNotes: 'Tasting Notes',
    nose: 'Nose',
    aroma: 'Aroma',
    palate: 'Palate',
    taste: 'Taste',
    mouthfeel: 'Mouthfeel',
    appearance: 'Appearance',
    color: 'Color',
    foodPairings: 'Food Pairings',
    servingSuggestions: 'Serving Suggestions',
    temperature: 'Temperature',
    glassware: 'Glassware',
    garnish: 'Garnish',
    mixers: 'Mixers',
    isDietary: 'Dietary',
    vegan: 'Vegan',
    vegetarian: 'Vegetarian',
    glutenFree: 'Gluten Free',
    dairyFree: 'Dairy Free',
    organic: 'Organic',
    kosher: 'Kosher',
    halal: 'Halal',
    sugarFree: 'Sugar Free',
    lowCalorie: 'Low Calorie',
    lowCarb: 'Low Carb',
    allergens: 'Allergens',
    ingredients: 'Ingredients',
    calories: 'Calories',
    carbohydrates: 'Carbohydrates',
    sugar: 'Sugar',
    protein: 'Protein',
    fat: 'Fat',
    sodium: 'Sodium',
    caffeine: 'Caffeine',
    certifications: 'Certifications',
    awards: 'Awards',
    ratings: 'Ratings',
    averageRating: 'Average Rating',
    reviewCount: 'Review Count',
    images: 'Images',
    productImages: 'Product Images',
    uploadedImages: 'Uploaded Images',
    videos: 'Videos',
    relatedProducts: 'Related Products',
    externalLinks: 'External Links',
    metaTitle: 'Meta Title',
    metaDescription: 'Meta Description',
    metaKeywords: 'Meta Keywords',
    canonicalUrl: 'Canonical URL',
    isFeatured: 'Featured',
    allowReviews: 'Allow Reviews',
    requiresAgeVerification: 'Age Verification',
    isPublished: 'Published',
    publishedAt: 'Published At',
    discontinuedAt: 'Discontinued At',
    subProductData: 'Sub-Product Data',
    newProductData: 'New Product Data',
    product: 'Product',
    tenant: 'Tenant',
    createNewProduct: 'Create New Product',
    baseSellingPrice: 'Selling Price',
    costPrice: 'Cost Price',
    currency: 'Currency',
    taxRate: 'Tax Rate',
    marginPercentage: 'Margin %',
    markupPercentage: 'Markup %',
    roundUp: 'Round Up',
    saleDiscountPercentage: 'Sale Discount %',
    salePrice: 'Sale Price',
    saleStartDate: 'Sale Start Date',
    saleEndDate: 'Sale End Date',
    saleType: 'Sale Type',
    saleDiscountValue: 'Sale Discount Value',
    saleBanner: 'Sale Banner',
    isOnSale: 'On Sale',
    shortDescriptionOverride: 'Short Description Override',
    descriptionOverride: 'Description Override',
    imagesOverride: 'Images Override',
    customKeywords: 'Custom Keywords',
    tenantNotes: 'Tenant Notes',
    sizes: 'Sizes',
    sellWithoutSizeVariants: 'Sell Without Size Variants',
    defaultSize: 'Default Size',
    stockStatus: 'Stock Status',
    totalStock: 'Total Stock',
    reservedStock: 'Reserved Stock',
    availableStock: 'Available Stock',
    lowStockThreshold: 'Low Stock Threshold',
    reorderPoint: 'Reorder Point',
    reorderQuantity: 'Reorder Quantity',
    lastRestockDate: 'Last Restock Date',
    nextRestockDate: 'Next Restock Date',
    vendor: 'Vendor',
    supplierSKU: 'Supplier SKU',
    supplierPrice: 'Supplier Price',
    leadTimeDays: 'Lead Time Days',
    minimumOrderQuantity: 'Minimum Order Quantity',
    status: 'Status',
    isFeaturedByTenant: 'Featured by Tenant',
    isNewArrival: 'New Arrival',
    isBestSeller: 'Best Seller',
    visibleInPOS: 'Visible in POS',
    visibleInOnlineStore: 'Visible in Online Store',
    addedAt: 'Added At',
    activatedAt: 'Activated At',
    deactivatedAt: 'Deactivated At',
    discount: 'Discount',
    discountType: 'Discount Type',
    discountStart: 'Discount Start',
    discountEnd: 'Discount End',
    flashSale: 'Flash Sale',
    bundleDeals: 'Bundle Deals',
    shipping: 'Shipping',
    weight: 'Weight',
    length: 'Length',
    width: 'Width',
    height: 'Height',
    fragile: 'Fragile',
    hazmat: 'Hazmat',
    shippingClass: 'Shipping Class',
    warehouse: 'Warehouse',
    location: 'Location',
    zone: 'Zone',
    aisle: 'Aisle',
    shelf: 'Shelf',
    bin: 'Bin',
    size: 'Size',
    displayName: 'Display Name',
    sizeCategory: 'Size Category',
    unitType: 'Unit Type',
    weightGrams: 'Weight (g)',
    servingsPerUnit: 'Servings Per Unit',
    unitsPerPack: 'Units Per Pack',
    basePrice: 'Base Price',
    compareAtPrice: 'Compare At Price',
    wholesalePrice: 'Wholesale Price',
    minPrice: 'Min Price',
    maxPrice: 'Max Price',
    competitorPrice: 'Competitor Price',
    pricingStrategy: 'Pricing Strategy',
    stock: 'Stock',
    packaging: 'Packaging',
    minOrderQuantity: 'Min Order Qty',
    maxOrderQuantity: 'Max Order Qty',
    orderIncrement: 'Order Increment',
    isDefault: 'Default',
    isOnSale: 'On Sale',
    isPopularSize: 'Popular Size',
    isLimitedEdition: 'Limited Edition',
    rank: 'Rank',
  };

  const pathStr = Array.isArray(path) ? path.join('.') : String(path);
  for (const [key, displayName] of Object.entries(displayNames)) {
    if (pathStr.endsWith(key) || pathStr.includes(`.${key}`)) {
      return displayName;
    }
  }

  const lastSegment = path[path.length - 1];
  if (typeof lastSegment === 'number') {
    return `Item ${lastSegment + 1}`;
  }
  if (typeof lastSegment === 'string') {
    return lastSegment
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  }
  return String(lastSegment);
};

const formatIssueMessage = (issue: ZodIssue): string => {
  switch (issue.code) {
    case 'invalid_type':
      if (issue.received === 'undefined' && issue.expected === 'string') {
        return 'This field is required';
      }
      if (issue.received === 'undefined' && issue.expected === 'number') {
        return 'A number is required';
      }
      if (issue.received === 'undefined' && issue.expected === 'boolean') {
        return 'This field is required';
      }
      return `Expected ${issue.expected}, received ${issue.received}`;

    case 'invalid_literal':
      return `Invalid value. Must be one of: ${(issue.options as string[]).join(', ')}`;

    case 'unrecognized_keys':
      return `Unrecognized key(s): ${issue.keys.join(', ')}`;

    case 'invalid_union':
      return 'Invalid value format';

    case 'invalid_union_discriminator':
      return `Invalid discriminator value: ${issue.discriminator}`;

    case 'invalid_enum_value':
      return `Invalid option. Must be one of: ${(issue.options as string[]).join(', ')}`;

    case 'invalid_arguments':
      return 'Invalid function arguments';

    case 'invalid_return_type':
      return 'Invalid return type';

    case 'invalid_date':
      return 'Invalid date format';

    case 'custom':
      return issue.message || 'Invalid value';

    case 'invalid_string':
      if (issue.validation === 'email') {
        return 'Please enter a valid email address';
      }
      if (issue.validation === 'url') {
        return 'Please enter a valid URL';
      }
      if (issue.validation === 'uuid') {
        return 'Please enter a valid UUID';
      }
      if (issue.validation === 'regex') {
        return 'Invalid format';
      }
      return `Invalid ${issue.validation || 'format'}`;

    case 'too_small':
      if (issue.type === 'array') {
        return `Must have at least ${issue.minimum} item(s)`;
      }
      if (issue.type === 'string') {
        if (issue.minimum === 1) {
          return 'This field is required';
        }
        return `Must be at least ${issue.minimum} character(s)`;
      }
      if (issue.type === 'number') {
        return `Must be at least ${issue.minimum}`;
      }
      return `Must be at least ${issue.minimum}`;

    case 'too_big':
      if (issue.type === 'array') {
        return `Must have at most ${issue.maximum} item(s)`;
      }
      if (issue.type === 'string') {
        return `Must be at most ${issue.maximum} character(s)`;
      }
      if (issue.type === 'number') {
        return `Must be at most ${issue.maximum}`;
      }
      return `Must be at most ${issue.maximum}`;

    case 'not_multiple_of':
      return `Must be a multiple of ${issue.multipleOf}`;

    default:
      return issue.message || 'Invalid value';
  }
};

export const formatZodErrors = (error: ZodError | null): FormattedError => {
  if (!error) {
    return {
      errors: [],
      errorMap: new Map(),
      summary: '',
      hasErrors: false,
      errorCount: 0,
    };
  }

  const errors: FieldError[] = error.issues.map((issue) => ({
    field: humanReadablePath(issue.path),
    message: formatIssueMessage(issue),
    code: issue.code,
    path: issue.path,
  }));

  const errorMap = new Map<string, string>();
  error.issues.forEach((issue) => {
    const fieldKey = humanReadablePath(issue.path);
    const message = formatIssueMessage(issue);
    if (!errorMap.has(fieldKey)) {
      errorMap.set(fieldKey, message);
    }
  });

  const groupedBySection = errors.reduce((acc, err) => {
    const path = err.path;
    if (path.length === 0) return acc;

    let section = 'General';
    if (path[0] === 'subProductData') {
      section = 'Sub-Product';
      if (path.length > 1) {
        const subField = String(path[1]);
        if (['newProductData'].includes(subField)) {
          section = 'New Product';
        } else if (['sizes'].includes(subField)) {
          section = 'Sizes';
        } else if (['shipping'].includes(subField)) {
          section = 'Shipping';
        } else if (['warehouse'].includes(subField)) {
          section = 'Warehouse';
        } else if (['flashSale'].includes(subField)) {
          section = 'Flash Sale';
        } else if (['saleBanner'].includes(subField)) {
          section = 'Sale Banner';
        } else if (['bundleDeals'].includes(subField)) {
          section = 'Bundle Deals';
        }
      }
    } else if (path[0] === 'tastingNotes') {
      section = 'Tasting Notes';
    } else if (path[0] === 'servingSuggestions') {
      section = 'Serving Suggestions';
    } else if (path[0] === 'isDietary') {
      section = 'Dietary Info';
    } else if (path[0] === 'nutritionalInfo') {
      section = 'Nutritional Info';
    } else if (path[0] === 'certifications') {
      section = 'Certifications';
    } else if (path[0] === 'awards') {
      section = 'Awards';
    } else if (path[0] === 'ratings') {
      section = 'Ratings';
    } else if (['images', 'productImages', 'uploadedImages', 'videos'].includes(String(path[0]))) {
      section = 'Media';
    } else if (path[0] === 'externalLinks') {
      section = 'External Links';
    } else if (['metaTitle', 'metaDescription', 'metaKeywords', 'canonicalUrl'].includes(String(path[0]))) {
      section = 'SEO';
    } else if (['originCountry', 'region', 'appellation', 'producer', 'brand', 'vintage', 'age', 'ageStatement', 'distilleryName', 'breweryName', 'wineryName', 'productionMethod', 'caskType', 'finish'].includes(String(path[0]))) {
      section = 'Origin & Production';
    } else if (['category', 'subCategory', 'tags', 'flavors', 'style', 'flavorProfile'].includes(String(path[0]))) {
      section = 'Categorization';
    }

    if (!acc[section]) {
      acc[section] = [];
    }
    acc[section].push(err);
    return acc;
  }, {} as Record<string, FieldError[]>);

  const summaryParts: string[] = [];
  for (const [section, sectionErrors] of Object.entries(groupedBySection)) {
    const fieldNames = sectionErrors.map((e) => pathToDisplayName(e.path));
    summaryParts.push(`${section}: ${fieldNames.join(', ')}`);
  }

  return {
    errors,
    errorMap,
    summary: summaryParts.join(' | '),
    hasErrors: errors.length > 0,
    errorCount: errors.length,
  };
};

export const getFieldError = (
  formattedErrors: FormattedError,
  fieldPath: string
): string | undefined => {
  return formattedErrors.errorMap.get(fieldPath);
};

export const getNestedFieldError = (
  formattedErrors: FormattedError,
  ...segments: (string | number)[]
): string | undefined => {
  const pathStr = segments.join('.');
  for (const [key, value] of formattedErrors.errorMap.entries()) {
    if (key === pathStr || key.endsWith(`.${segments[segments.length - 1]}`)) {
      return value;
    }
  }
  return undefined;
};

export const formatErrorForToast = (error: ZodError | null): string => {
  if (!error || error.issues.length === 0) {
    return '';
  }

  const formatted = formatZodErrors(error);

  if (formatted.errorCount === 1) {
    const err = formatted.errors[0];
    return `${pathToDisplayName(err.path)}: ${err.message}`;
  }

  if (formatted.errorCount <= 3) {
    return formatted.errors
      .slice(0, 3)
      .map((e) => `${pathToDisplayName(e.path)}: ${e.message}`)
      .join('\n');
  }

  const sectionCount = Object.keys(
    formatted.errors.reduce((acc, err) => {
      const section = String(err.path[0] || 'General');
      acc[section] = true;
      return acc;
    }, {} as Record<string, boolean>)
  ).length;

  return `${formatted.errorCount} validation error(s) in ${sectionCount} section(s). Check the form for details.`;
};
