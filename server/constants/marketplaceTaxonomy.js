'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// Marketplace taxonomy registry (docs/audits/general-saas-evolution §9).
//
// PER-BUSINESS model (2026-11-03, user-corrected): every business vertical
// owns its own types, its own categories, and its own subcategories — the
// way the beverage business always has. A tenant sees ONLY the taxonomy of
// the vertical(s) its business type maps to; nothing is shared across
// businesses. Verticals are seeded/rolled back ONE BY ONE
// (scripts/seed-marketplace-taxonomy.js --only=<slug>).
//
// This registry is data only — no DB code. The seed script applies it
// idempotently; `industry` (vertical slug) lands on every created doc so the
// per-business visibility filters resolve; a MISSING industry on a legacy doc
// means "global/legacy, visible to every business" (existing capability is
// never lost). Categories are applied per vertical in operator order
// (electronics → fashion → beauty → home → food-service), each verified
// before the next.
// ─────────────────────────────────────────────────────────────────────────────

const slugify = (text) => String(text).toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const CATEGORY_HORIZONTALS = Object.freeze([
  // ── Electronics (seeded FIRST, 2026-11-03) ─────────────────────────────────
  {
    name: 'Electronics',
    slug: 'electronics',
    industry: 'electronics',
    verticalTypes: ['ELECTRONICS'],
    businessTypes: ['Electronics Retail'],
    categories: [
      { name: 'Phones & Tablets', subcategories: ['Smartphones', 'Feature Phones', 'Tablets', 'Phone & Tablet Accessories', 'E-readers'] },
      { name: 'Computers & Laptops', subcategories: ['Laptops', 'Desktops', 'Monitors', 'Printers & Scanners', 'Computer Peripherals', 'Computer Components', 'Data Storage', 'Keyboards & Mice'] },
      { name: 'Audio', subcategories: ['Headphones & Earbuds', 'Speakers', 'Soundbars & Home Audio', 'Microphones'] },
      { name: 'TV, Video & Displays', subcategories: ['Televisions', 'Projectors', 'Streaming Devices', 'AV Accessories'] },
      { name: 'Cameras & Photography', subcategories: ['Digital Cameras', 'Action Cameras', 'Lenses & Accessories', 'Drones & Aerial Cameras'] },
      { name: 'Gaming', subcategories: ['Consoles', 'Video Games', 'Gaming Accessories', 'Gaming PCs & Handhelds'] },
      { name: 'Wearables', subcategories: ['Smartwatches', 'Fitness Trackers'] },
      { name: 'Networking & Smart Home', subcategories: ['Routers & Modems', 'Smart Home Devices', 'Network Switches & Extenders', 'Security Cameras & Video Doorbells'] },
      { name: 'Power & Charging', subcategories: ['Power Banks', 'Chargers & Cables', 'Batteries', 'UPS & Surge Protectors'] },
    ],
  },
  // ── Fashion (tree finalised one-by-one when its turn is approved) ──────────
  {
    name: 'Fashion',
    slug: 'fashion',
    industry: 'fashion',
    verticalTypes: ['FASHION'],
    businessTypes: ['Fashion Retail'],
    categories: [
      { name: 'Women', subcategories: ['Tops & Blouses', 'Dresses', 'Trousers & Jeans', 'Skirts', 'Outerwear', 'Native & Traditional'] },
      { name: 'Men', subcategories: ['Shirts', 'T-Shirts & Polos', 'Trousers & Jeans', 'Native & Traditional', 'Outerwear'] },
      { name: 'Kids & Baby', subcategories: ['Girls', 'Boys', 'Baby (0-2 yrs)'] },
      { name: 'Shoes & Footwear', subcategories: ['Sneakers', 'Heels & Pumps', 'Sandals', 'Loafers & Office', 'Slides & Slippers'] },
      { name: 'Bags & Luggage', subcategories: ['Handbags', 'Backpacks', 'Luggage & Trolley'] },
      { name: 'Fashion Accessories', subcategories: ['Belts', 'Scarves & Wraps', 'Caps & Hats', 'Sunglasses'] },
      { name: 'Watches', subcategories: ['Men\'s Watches', 'Women\'s Watches', 'Smartwatch Straps & Accessories'] },
      { name: 'Jewellery', subcategories: ['Necklaces & Chains', 'Earrings', 'Rings', 'Bracelets & Anklets'] },
    ],
  },
  // ── Beauty & Personal Care ──────────────────────────────────────────────────
  {
    name: 'Beauty & Personal Care',
    slug: 'beauty',
    industry: 'beauty',
    verticalTypes: ['BEAUTY'],
    businessTypes: ['Beauty & Skincare'],
    categories: [
      { name: 'Skincare', subcategories: ['Cleansers & Toners', 'Moisturisers & Serums', 'Sun Care', 'Body Care'] },
      { name: 'Makeup', subcategories: ['Face', 'Eyes', 'Lips', 'Brow Makeup'] },
      { name: 'Hair Care & Styling', subcategories: ['Shampoo & Conditioner', 'Treatments & Oils', 'Styling Tools'] },
      { name: 'Fragrance', subcategories: ['Women\'s Fragrance', 'Men\'s Fragrance', 'Body Sprays & Mists'] },
      { name: 'Personal Hygiene', subcategories: ['Deodorants', 'Oral Care', 'Bath & Shower'] },
      { name: 'Nails & Manicure', subcategories: ['Nail Polish & Gel', 'Nail Polish Removers', 'Press-On Nails', 'Nail Care & Treatments', 'Manicure & Pedicure Kits'] },
      { name: 'Beauty Tools & Accessories', subcategories: ['Makeup Brushes & Sponges', 'Facial Tools & Devices', 'Tweezers & Lash Tools', 'Cosmetic Bags & Cases'] },
    ],
  },
  // ── Home & Living (ADOPTS the legacy `home-living` category — same "Home
  // & Living" concept already in the DB with kitchen-and-dining beneath it
  // under a unique-slug index; minting a near-duplicate would collide.
  // 2026-11-03 adoption, recorded for the seed/idempotency contract.) ────────
  {
    name: 'Home & Living',
    slug: 'home-living',
    industry: 'home',
    verticalTypes: ['HOME'],
    businessTypes: ['Home & Living'],
    categories: [
      { name: 'Kitchen & Dining', subcategories: ['Dinnerware & Serveware', 'Drinkware', 'Kitchen Utensils & Gadgets', 'Food Storage'] },
      { name: 'Cookware & Bakeware', subcategories: ['Pots & Pans', 'Bakeware', 'Kitchen Smallwares'] },
      { name: 'Home Decor', subcategories: ['Wall Art & Clocks', 'Vases & Ornaments', 'Candles & Home Fragrance', 'Rugs & Mats', 'Mirrors'] },
      { name: 'Furniture', subcategories: ['Living Room', 'Dining', 'Office & Study', 'Bedroom Furniture', 'Mattresses', 'Cabinets & Shelving'] },
      { name: 'Bedding & Textiles', subcategories: ['Bedsheets & Duvets', 'Pillows & Protectors', 'Towels', 'Curtains & Blinds'] },
      { name: 'Storage & Organisation', subcategories: ['Baskets & Bins', 'Wardrobe Organisers'] },
      { name: 'Cleaning & Household', subcategories: ['Cleaning Tools', 'Laundry', 'Waste Bins', 'Household Cleaners', 'Laundry Supplies', 'Bin Liners'] },
      { name: 'Small Appliances', subcategories: ['Blenders & Mixers', 'Kettles & Irons', 'Fans & Coolers', 'Air Fryers', 'Vacuums & Steam Cleaners', 'Appliance Accessories'] },
      { name: 'Lighting', subcategories: ['Table & Floor Lamps', 'Ceiling & Wall Lights', 'Light Bulbs & Accessories'] },
      { name: 'Bath & Bathroom Accessories', subcategories: ['Bath Mats', 'Shower Curtains & Liners', 'Soap Dispensers & Dishes', 'Bathroom Organisers'] },
      { name: 'Garden & Outdoor', subcategories: ['Planters & Pots', 'Garden Hand Tools', 'Outdoor Furniture', 'Watering & Irrigation', 'Outdoor Shade', 'Grills & Accessories'] },
    ],
  },
  // ── Food Service & Venue (restaurants / lounges / clubs — seeded LAST; the
  // venue machinery already covers menu service; this tree is the venue-side
  // PROCUREMENT + consumables vocabulary) ─────────────────────────────────────
  {
    name: 'Food Service & Venue',
    slug: 'food-service',
    industry: 'food-service',
    verticalTypes: ['FOODSERVICE', 'HOSPITALITY'],
    businessTypes: ['Restaurant', 'Hotel', 'Bar / Lounge', 'Nightclub / Club'],
    categories: [
      { name: 'Fresh Produce', subcategories: ['Fruits & Vegetables', 'Herbs'] },
      { name: 'Meat & Poultry', subcategories: ['Beef', 'Chicken', 'Other Meats'] },
      { name: 'Seafood', subcategories: ['Fish', 'Shellfish'] },
      { name: 'Dairy & Eggs', subcategories: ['Milk & Cream', 'Cheese & Butter', 'Eggs', 'Yoghurt'] },
      { name: 'Bakery & Bread', subcategories: ['Breads', 'Pastries'] },
      { name: 'Dry Goods & Staples', subcategories: ['Grains & Flour', 'Oils & Fats', 'Sugar & Sweeteners', 'Beans & Pulses', 'Pasta & Noodles', 'Canned & Preserved Foods'] },
      { name: 'Frozen Foods', subcategories: ['Frozen Vegetables', 'Frozen Proteins', 'Frozen Fruit', 'Frozen Ready-to-Cook Items', 'Frozen Bakery', 'Ice Cream & Frozen Desserts'] },
      { name: 'Condiments & Spices', subcategories: ['Spices & Seasonings', 'Sauces & Condiments', 'Stocks & Bouillon'] },
      { name: 'Disposables & Packaging', subcategories: ['Takeaway Packs', 'Napkins & Wraps', 'Disposable Cups & Lids', 'Disposable Cutlery & Straws', 'Food Handling Gloves'] },
      { name: 'Cleaning Chemicals & Sanitisers', subcategories: ['Surface Cleaners', 'Dishwashing', 'Kitchen Degreasers', 'Food Surface Sanitisers'] },
      { name: 'Commercial Kitchen Smallwares', subcategories: ['Prep Tools & Utensils', 'Commercial Cookware', 'Food Storage & Labelling'] },
      { name: 'Tabletop & Bar Service', subcategories: ['Commercial Tableware & Cutlery', 'Bar Service Tools', 'Commercial Serving Trays', 'Bottle Service Accessories'] },
      { name: 'Janitorial Supplies', subcategories: ['Paper Towels & Hand Soap', 'Commercial Bin Liners', 'Mops & Brushes', 'Cleaning PPE'] },
      { name: 'Commercial Kitchen & Bar Equipment', subcategories: ['Commercial Refrigeration', 'Commercial Cooking Equipment', 'Commercial Ice Machines', 'Commercial Warewashing'] },
      { name: 'Shisha & Hookah', industry: 'hospitality', subcategories: ['Shisha Pipes & Kits', 'Shisha Flavours (Molasses)', 'Charcoal & Foils', 'Shisha Bowls & Heads', 'Shisha Hoses & Adapters', 'Shisha Mouthpieces & Tips'] },
      { name: 'Cigars & Tobacco', industry: 'hospitality', subcategories: ['Cigar Packs & Singles', 'Smoking Accessories', 'Venue Cigar Cutters', 'Venue Cigar Lighters', 'Humidors & Cigar Cases'] },
      { name: 'Venue Merchandise', industry: 'hospitality', subcategories: ['Venue Apparel', 'Branded Drinkware', 'Venue Gift Packs'] },
    ],
  },
]);

// Flat list: one entry per SubCategory with its resolved industry (vertical
// slug) — the seed + per-business visibility filters consume this.
// SLUG SCHEME (2026-11-03): a subcategory's slug is slugify(name), EXCEPT
// when the same subcategory NAME appears under more than one category
// anywhere in the registry (e.g. "Trousers & Jeans" in both Women and Men)
// — those get a category-prefixed slug (slugify("Women Trousers & Jeans") →
// womens-trousers-and-jeans) because the subcategories collection enforces a
// GLOBAL unique slug index. Deterministic: preview/apply/rollback agree.
const subcategories = (() => {
  const baseSlugCounts = new Map();
  for (const vertical of CATEGORY_HORIZONTALS) {
    for (const category of vertical.categories) {
      for (const name of category.subcategories) {
        const base = slugify(name);
        baseSlugCounts.set(base, (baseSlugCounts.get(base) || 0) + 1);
      }
    }
  }
  return CATEGORY_HORIZONTALS.flatMap((vertical) =>
    vertical.categories.flatMap((category) => {
      const parentSlug = slugify(category.name);
      return category.subcategories.map((name) => {
        const base = slugify(name);
        const slug = baseSlugCounts.get(base) > 1 ? slugify(`${category.name} ${name}`) : base;
        return {
          parentSlug,
          parentName: category.name,
          verticalSlug: vertical.slug,
          industry: category.industry ?? vertical.industry,
          name,
          slug,
        };
      });
    }));
})();

// Flat vertical categories: one entry per top-level Category of a business.
const flatCategories = CATEGORY_HORIZONTALS.flatMap((vertical) =>
  vertical.categories.map((category) => ({
    verticalSlug: vertical.slug,
    industry: category.industry ?? vertical.industry,
    name: category.name,
    slug: slugify(category.name),
    subcategories: category.subcategories,
  })));

module.exports = Object.freeze({
  CATEGORY_HORIZONTALS,
  categories: flatCategories,
  subcategories,
  slugify,
});
