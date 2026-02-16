// scripts/BannerSeed.js

const mongoose = require('mongoose');
const Banner = require('../models/Banner');
const Product = require('../models/product');
const Category = require('../models/Category');
const Brand = require('../models/Brand');
const Tenant = require('../models/tenant');
const User = require('../models/User');
// Database connection
const db = require('../config/db');
require('dotenv').config();

// ============================================================
// BANNER DATA - REAL BEVERAGE INDUSTRY EXAMPLES
// ============================================================

const bannerTemplates = [
  // HERO BANNERS - HOME PAGE
  {
    title: 'Premium Spirits Collection - Elevate Your Celebrations',
    subtitle: 'Discover the finest whiskeys, cognacs, and champagnes',
    description: 'Indulge in our curated selection of premium spirits from world-renowned distilleries. Perfect for special occasions and connoisseurs.',
    type: 'hero',
    placement: 'home_hero',
    displayOrder: 1,
    priority: 'high',
    ctaText: 'Explore Premium Collection',
    linkType: 'category',
    backgroundColor: '#1A1A2E',
    textColor: '#FFFFFF',
    overlayOpacity: 0.4,
    textAlignment: 'left',
    contentPosition: 'center-left',
    isScheduled: false,
    isActive: true,
    status: 'active',
    isGlobal: true,
    visibleTo: 'all',
    deviceTargeting: { desktop: true, mobile: true, tablet: true },
    animation: { type: 'fade', duration: 1200, delay: 0 },
    autoplay: { enabled: true, interval: 5000 },
    tags: ['premium', 'spirits', 'luxury', 'celebration'],
    seoTitle: 'Premium Spirits & Whiskey Collection | DrinksHarbour',
    seoDescription: 'Shop our exclusive collection of premium spirits, whiskeys, cognacs, and champagne. Free delivery on orders over ₦50,000.',
    seoKeywords: ['premium spirits', 'whiskey collection', 'cognac', 'champagne', 'luxury drinks'],
    image: {
      url: 'https://images.unsplash.com/photo-1569529465841-dfecdab7503b',
      alt: 'Premium spirits collection display with whiskey bottles',
      width: 1920,
      height: 800,
    },
    mobileImage: {
      url: 'https://images.unsplash.com/photo-1569529465841-dfecdab7503b',
      alt: 'Premium spirits collection mobile',
      width: 768,
      height: 600,
    },
  },

  {
    title: 'Craft Beer Revolution - Fresh From Local Breweries',
    subtitle: 'Support Nigerian craft brewers with every sip',
    description: 'Explore bold IPAs, smooth lagers, and unique seasonal brews crafted with passion by local artisans.',
    type: 'hero',
    placement: 'home_hero',
    displayOrder: 2,
    priority: 'high',
    ctaText: 'Discover Craft Beers',
    linkType: 'category',
    backgroundColor: '#F4A460',
    textColor: '#FFFFFF',
    overlayOpacity: 0.3,
    textAlignment: 'center',
    contentPosition: 'center',
    isScheduled: false,
    isActive: true,
    status: 'active',
    isGlobal: true,
    visibleTo: 'all',
    deviceTargeting: { desktop: true, mobile: true, tablet: true },
    animation: { type: 'slide', duration: 1000, delay: 0 },
    autoplay: { enabled: true, interval: 5000 },
    tags: ['craft beer', 'local', 'brewery', 'artisan'],
    seoTitle: 'Craft Beer Collection | Support Local Breweries',
    seoDescription: 'Discover unique craft beers from Nigerian microbreweries. IPAs, stouts, lagers and more.',
    seoKeywords: ['craft beer Nigeria', 'microbrewery', 'IPA', 'local beer'],
    image: {
      url: 'https://images.unsplash.com/photo-1608270586620-248524c67de9',
      alt: 'Variety of craft beer bottles and glasses',
      width: 1920,
      height: 800,
    },
    mobileImage: {
      url: 'https://images.unsplash.com/photo-1608270586620-248524c67de9',
      alt: 'Craft beer collection mobile view',
      width: 768,
      height: 600,
    },
  },

  {
    title: 'Wine Lovers Paradise - From Vineyards to Your Table',
    subtitle: 'Red, White, Rosé & Sparkling Wines',
    description: 'Curated wines from renowned vineyards across France, Italy, South Africa, and California.',
    type: 'hero',
    placement: 'home_hero',
    displayOrder: 3,
    priority: 'high',
    ctaText: 'Browse Wine Collection',
    linkType: 'category',
    backgroundColor: '#722F37',
    textColor: '#FFFFFF',
    overlayOpacity: 0.5,
    textAlignment: 'right',
    contentPosition: 'center-right',
    isScheduled: false,
    isActive: true,
    status: 'active',
    isGlobal: true,
    visibleTo: 'all',
    deviceTargeting: { desktop: true, mobile: true, tablet: true },
    animation: { type: 'zoom', duration: 1500, delay: 0 },
    autoplay: { enabled: true, interval: 5000 },
    tags: ['wine', 'vineyard', 'imported', 'sommelier'],
    seoTitle: 'Premium Wine Collection | Red, White & Sparkling',
    seoDescription: 'Shop wines from top vineyards worldwide. Expert curation, competitive prices.',
    seoKeywords: ['wine collection', 'red wine', 'white wine', 'sparkling wine'],
    image: {
      url: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3',
      alt: 'Wine cellar with premium wine bottles',
      width: 1920,
      height: 800,
    },
    mobileImage: {
      url: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3',
      alt: 'Wine collection mobile',
      width: 768,
      height: 600,
    },
  },

  // PROMOTIONAL BANNERS
  {
    title: 'Flash Sale: 25% OFF All Imported Vodka',
    subtitle: 'Premium vodka from Russia, Sweden & Poland',
    description: 'Stock up on Absolut, Grey Goose, Belvedere and more. Limited time offer!',
    type: 'promotional',
    placement: 'home_secondary',
    displayOrder: 1,
    priority: 'urgent',
    ctaText: 'Shop Vodka Sale',
    linkType: 'category',
    ctaStyle: 'primary',
    backgroundColor: '#FF4444',
    textColor: '#FFFFFF',
    overlayOpacity: 0.2,
    textAlignment: 'center',
    contentPosition: 'center',
    isScheduled: true,
    startDate: new Date(),
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    isActive: true,
    status: 'active',
    isGlobal: true,
    visibleTo: 'all',
    deviceTargeting: { desktop: true, mobile: true, tablet: true },
    tags: ['sale', 'vodka', 'discount', 'limited-time'],
    seoTitle: '25% OFF Vodka Sale | Premium Imported Brands',
    seoDescription: 'Flash sale on premium vodka brands. Save 25% on Absolut, Grey Goose, and more.',
    image: {
      url: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b',
      alt: 'Premium vodka bottles on display',
      width: 1200,
      height: 400,
    },
    mobileImage: {
      url: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b',
      alt: 'Vodka sale mobile banner',
      width: 768,
      height: 400,
    },
  },

  {
    title: 'New Arrival: Hennessy VSOP Cognac',
    subtitle: 'The iconic French cognac is now in stock',
    description: 'Rich, smooth, and perfectly balanced. A timeless classic for special moments.',
    type: 'promotional',
    placement: 'home_secondary',
    displayOrder: 2,
    priority: 'high',
    ctaText: 'Order Now',
    linkType: 'product',
    ctaStyle: 'primary',
    backgroundColor: '#D4AF37',
    textColor: '#1A1A1A',
    overlayOpacity: 0.1,
    textAlignment: 'left',
    contentPosition: 'center-left',
    isScheduled: false,
    isActive: true,
    status: 'active',
    isGlobal: true,
    visibleTo: 'all',
    deviceTargeting: { desktop: true, mobile: true, tablet: true },
    tags: ['new-arrival', 'cognac', 'hennessy', 'premium'],
    seoTitle: 'Hennessy VSOP Cognac Now Available',
    seoDescription: 'Get the iconic Hennessy VSOP cognac delivered to your doorstep.',
    image: {
      url: 'https://images.unsplash.com/photo-1618885472179-5e474019f2a9',
      alt: 'Hennessy cognac bottle',
      width: 1200,
      height: 400,
    },
  },

  {
    title: 'Buy 2 Get 1 FREE - Guinness Stout',
    subtitle: 'The legendary Irish stout',
    description: 'Perfect for game nights and gatherings. Limited stock available!',
    type: 'promotional',
    placement: 'home_secondary',
    displayOrder: 3,
    priority: 'high',
    ctaText: 'Grab the Deal',
    linkType: 'product',
    ctaStyle: 'secondary',
    backgroundColor: '#000000',
    textColor: '#FFFFFF',
    overlayOpacity: 0.3,
    textAlignment: 'center',
    contentPosition: 'center',
    isScheduled: true,
    startDate: new Date(),
    endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
    isActive: true,
    status: 'active',
    isGlobal: true,
    visibleTo: 'all',
    deviceTargeting: { desktop: true, mobile: true, tablet: true },
    tags: ['bogo', 'guinness', 'beer', 'special-offer'],
    seoTitle: 'Buy 2 Get 1 Free Guinness Stout',
    seoDescription: 'Special offer on Guinness. Buy 2 bottles, get 1 free.',
    image: {
      url: 'https://images.unsplash.com/photo-1608879493122-e3876d490a0c',
      alt: 'Guinness beer bottles and glass',
      width: 1200,
      height: 400,
    },
  },

  // SEASONAL BANNERS
  {
    title: 'Holiday Season Specials - Celebrate in Style',
    subtitle: 'Champagne, Wine & Premium Spirits Gift Sets',
    description: 'Make this holiday unforgettable with our exclusive gift collections. Perfect for gifting and hosting.',
    type: 'seasonal',
    placement: 'home_secondary',
    displayOrder: 4,
    priority: 'high',
    ctaText: 'Shop Holiday Gifts',
    linkType: 'collection',
    ctaStyle: 'primary',
    backgroundColor: '#C41E3A',
    textColor: '#FFFFFF',
    overlayOpacity: 0.4,
    textAlignment: 'center',
    contentPosition: 'center',
    isScheduled: true,
    startDate: new Date('2026-12-01'),
    endDate: new Date('2027-01-05'),
    isActive: false,
    status: 'scheduled',
    isGlobal: true,
    visibleTo: 'all',
    deviceTargeting: { desktop: true, mobile: true, tablet: true },
    tags: ['holiday', 'christmas', 'gift-set', 'celebration'],
    seoTitle: 'Holiday Gift Sets | Champagne & Premium Spirits',
    seoDescription: 'Celebrate the holidays with our curated gift collections.',
    image: {
      url: 'https://images.unsplash.com/photo-1482575832494-771f74bf6857',
      alt: 'Holiday champagne and gift sets',
      width: 1200,
      height: 400,
    },
  },

  {
    title: 'Summer Refreshment - Cold Beers & Ciders',
    subtitle: 'Beat the heat with ice-cold favorites',
    description: 'Explore our selection of light lagers, fruity ciders, and refreshing wheat beers.',
    type: 'seasonal',
    placement: 'home_secondary',
    displayOrder: 5,
    priority: 'medium',
    ctaText: 'Explore Summer Drinks',
    linkType: 'category',
    ctaStyle: 'outline',
    backgroundColor: '#87CEEB',
    textColor: '#1A1A1A',
    overlayOpacity: 0.2,
    textAlignment: 'right',
    contentPosition: 'center-right',
    isScheduled: true,
    startDate: new Date('2026-06-01'),
    endDate: new Date('2026-08-31'),
    isActive: false,
    status: 'scheduled',
    isGlobal: true,
    visibleTo: 'all',
    deviceTargeting: { desktop: true, mobile: true, tablet: true },
    tags: ['summer', 'beer', 'cider', 'refreshing'],
    seoTitle: 'Summer Beer & Cider Collection',
    seoDescription: 'Stay cool this summer with our refreshing beer and cider selection.',
    image: {
      url: 'https://images.unsplash.com/photo-1562095241-8c6714fd4178',
      alt: 'Cold beers on ice for summer',
      width: 1200,
      height: 400,
    },
  },

  // CATEGORY BANNERS
  {
    title: 'Whiskey Connoisseur Collection',
    subtitle: 'Scotch, Bourbon, Irish & Japanese Whiskey',
    description: 'From smoky Islay malts to smooth Kentucky bourbon. Discover your perfect dram.',
    type: 'category',
    placement: 'category_top',
    displayOrder: 1,
    priority: 'high',
    ctaText: 'Browse Whiskey',
    linkType: 'category',
    ctaStyle: 'primary',
    backgroundColor: '#8B4513',
    textColor: '#FFFFFF',
    overlayOpacity: 0.5,
    textAlignment: 'left',
    contentPosition: 'center-left',
    isScheduled: false,
    isActive: true,
    status: 'active',
    isGlobal: true,
    visibleTo: 'all',
    deviceTargeting: { desktop: true, mobile: true, tablet: true },
    tags: ['whiskey', 'scotch', 'bourbon', 'premium'],
    seoTitle: 'Whiskey Collection | Scotch, Bourbon & Irish',
    seoDescription: 'Premium whiskey from Scotland, Ireland, USA and Japan.',
    image: {
      url: 'https://images.unsplash.com/photo-1527281400683-1aae777175f8',
      alt: 'Whiskey bottles and glass',
      width: 1400,
      height: 500,
    },
  },

  {
    title: 'Gin Garden - Craft & Classic Gins',
    subtitle: 'London Dry to Contemporary Botanicals',
    description: 'Elevate your cocktail game with artisanal gins from master distillers.',
    type: 'category',
    placement: 'category_top',
    displayOrder: 1,
    priority: 'high',
    ctaText: 'Explore Gin Selection',
    linkType: 'category',
    ctaStyle: 'secondary',
    backgroundColor: '#98D8C8',
    textColor: '#1A1A1A',
    overlayOpacity: 0.3,
    textAlignment: 'center',
    contentPosition: 'center',
    isScheduled: false,
    isActive: true,
    status: 'active',
    isGlobal: true,
    visibleTo: 'all',
    deviceTargeting: { desktop: true, mobile: true, tablet: true },
    tags: ['gin', 'botanical', 'craft', 'cocktails'],
    seoTitle: 'Premium Gin Collection | Craft & Classic',
    seoDescription: 'Discover artisanal and classic gins for the perfect G&T.',
    image: {
      url: 'https://images.unsplash.com/photo-1582106245687-cbb466974491',
      alt: 'Premium gin bottles with botanicals',
      width: 1400,
      height: 500,
    },
  },

  // BRAND BANNERS
  {
    title: 'Moët & Chandon - Champagne Excellence Since 1743',
    subtitle: 'Celebrate life\'s finest moments',
    description: 'The world\'s most loved champagne. From Imperial to Rosé, discover luxury in every bubble.',
    type: 'product',
    placement: 'product_page',
    displayOrder: 1,
    priority: 'high',
    ctaText: 'Shop Moët & Chandon',
    linkType: 'brand',
    ctaStyle: 'primary',
    backgroundColor: '#000000',
    textColor: '#D4AF37',
    overlayOpacity: 0.6,
    textAlignment: 'center',
    contentPosition: 'center',
    isScheduled: false,
    isActive: true,
    status: 'active',
    isGlobal: true,
    visibleTo: 'all',
    deviceTargeting: { desktop: true, mobile: true, tablet: true },
    tags: ['moet', 'champagne', 'luxury', 'celebration'],
    seoTitle: 'Moët & Chandon Champagne Collection',
    seoDescription: 'Shop authentic Moët & Chandon champagne. Imperial, Rosé, Grand Vintage.',
    image: {
      url: 'https://images.unsplash.com/photo-1547595628-c61a29f496f0',
      alt: 'Moët & Chandon champagne bottle and glasses',
      width: 1200,
      height: 600,
    },
  },

  {
    title: 'Jack Daniel\'s Tennessee Whiskey',
    subtitle: 'America\'s favorite whiskey since 1866',
    description: 'Smooth, charcoal-mellowed whiskey from Lynchburg, Tennessee. Old No. 7, Single Barrel, and more.',
    type: 'product',
    placement: 'product_page',
    displayOrder: 1,
    priority: 'high',
    ctaText: 'View Collection',
    linkType: 'brand',
    ctaStyle: 'outline',
    backgroundColor: '#1A1A1A',
    textColor: '#FFFFFF',
    overlayOpacity: 0.4,
    textAlignment: 'left',
    contentPosition: 'center-left',
    isScheduled: false,
    isActive: true,
    status: 'active',
    isGlobal: true,
    visibleTo: 'all',
    deviceTargeting: { desktop: true, mobile: true, tablet: true },
    tags: ['jack-daniels', 'whiskey', 'tennessee', 'american'],
    seoTitle: 'Jack Daniel\'s Tennessee Whiskey Collection',
    seoDescription: 'Authentic Jack Daniel\'s whiskey. Old No. 7, Gentleman Jack, Single Barrel.',
    image: {
      url: 'https://images.unsplash.com/photo-1569529465841-dfecdab7503b',
      alt: 'Jack Daniels whiskey bottle',
      width: 1200,
      height: 600,
    },
  },

  // ANNOUNCEMENT BANNERS
  {
    title: 'Free Delivery on Orders Over ₦50,000',
    subtitle: 'Fast & reliable shipping across Nigeria',
    description: 'Get your favorite drinks delivered to your doorstep. Same-day delivery available in Lagos.',
    type: 'announcement',
    placement: 'header',
    displayOrder: 1,
    priority: 'medium',
    ctaText: 'Learn More',
    linkType: 'page',
    ctaLink: '/shipping-info',
    ctaStyle: 'text',
    backgroundColor: '#4CAF50',
    textColor: '#FFFFFF',
    overlayOpacity: 0,
    textAlignment: 'center',
    contentPosition: 'center',
    isScheduled: false,
    isActive: true,
    status: 'active',
    isGlobal: true,
    visibleTo: 'all',
    deviceTargeting: { desktop: true, mobile: true, tablet: true },
    tags: ['delivery', 'shipping', 'free-delivery'],
    image: {
      url: 'https://images.unsplash.com/photo-1566576721346-d4a3b4eaeb55',
      alt: 'Delivery truck',
      width: 1920,
      height: 100,
    },
  },

  {
    title: 'Age Verification Required',
    subtitle: 'You must be 18+ to purchase alcoholic beverages',
    description: 'DrinksHarbour is committed to responsible drinking. Please have your ID ready.',
    type: 'announcement',
    placement: 'popup',
    displayOrder: 1,
    priority: 'urgent',
    ctaText: 'I am 18 or Older',
    linkType: 'internal',
    ctaLink: '#verify-age',
    ctaStyle: 'primary',
    backgroundColor: '#FFA500',
    textColor: '#1A1A1A',
    overlayOpacity: 0,
    textAlignment: 'center',
    contentPosition: 'center',
    isScheduled: false,
    isActive: true,
    status: 'active',
    isGlobal: true,
    visibleTo: 'guests',
    deviceTargeting: { desktop: true, mobile: true, tablet: true },
    tags: ['age-verification', 'compliance', 'legal'],
    image: {
      url: 'https://images.unsplash.com/photo-1569529465841-dfecdab7503b',
      alt: 'Age verification notice',
      width: 600,
      height: 400,
    },
  },

  // SIDEBAR BANNERS
  {
    title: 'Wine Pairing Guide',
    subtitle: 'Download our free guide',
    description: 'Learn which wines pair best with your favorite meals.',
    type: 'custom',
    placement: 'sidebar',
    displayOrder: 1,
    priority: 'low',
    ctaText: 'Get Free Guide',
    linkType: 'external',
    ctaLink: '/downloads/wine-pairing-guide.pdf',
    ctaStyle: 'primary',
    backgroundColor: '#722F37',
    textColor: '#FFFFFF',
    overlayOpacity: 0.3,
    textAlignment: 'center',
    contentPosition: 'center',
    isScheduled: false,
    isActive: true,
    status: 'active',
    isGlobal: true,
    visibleTo: 'all',
    deviceTargeting: { desktop: true, mobile: false, tablet: true },
    tags: ['wine', 'pairing', 'guide', 'download'],
    image: {
      url: 'https://images.unsplash.com/photo-1474722883778-792e7990302f',
      alt: 'Wine and food pairing',
      width: 400,
      height: 600,
    },
  },

  {
    title: 'Join Our VIP Club',
    subtitle: 'Exclusive deals & early access',
    description: 'Get 10% off your first order when you sign up.',
    type: 'custom',
    placement: 'sidebar',
    displayOrder: 2,
    priority: 'medium',
    ctaText: 'Sign Up Now',
    linkType: 'internal',
    ctaLink: '/vip-signup',
    ctaStyle: 'secondary',
    backgroundColor: '#D4AF37',
    textColor: '#1A1A1A',
    overlayOpacity: 0.2,
    textAlignment: 'center',
    contentPosition: 'center',
    isScheduled: false,
    isActive: true,
    status: 'active',
    isGlobal: true,
    visibleTo: 'guests',
    deviceTargeting: { desktop: true, mobile: false, tablet: true },
    tags: ['vip', 'membership', 'loyalty', 'discount'],
    image: {
      url: 'https://images.unsplash.com/photo-1560963689-ba63836c229a',
      alt: 'VIP membership card',
      width: 400,
      height: 600,
    },
  },

  // PRODUCT PAGE BANNERS
  {
    title: 'Mixologist\'s Choice',
    subtitle: 'Perfect ingredients for classic cocktails',
    description: 'Everything you need for Old Fashioned, Negroni, Manhattan and more.',
    type: 'product',
    placement: 'product_page',
    displayOrder: 2,
    priority: 'medium',
    ctaText: 'Shop Cocktail Ingredients',
    linkType: 'collection',
    ctaStyle: 'outline',
    backgroundColor: '#2C3E50',
    textColor: '#ECF0F1',
    overlayOpacity: 0.4,
    textAlignment: 'left',
    contentPosition: 'bottom-left',
    isScheduled: false,
    isActive: true,
    status: 'active',
    isGlobal: true,
    visibleTo: 'all',
    deviceTargeting: { desktop: true, mobile: true, tablet: true },
    tags: ['cocktails', 'mixology', 'bartender', 'ingredients'],
    image: {
      url: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b',
      alt: 'Cocktail ingredients and tools',
      width: 1200,
      height: 400,
    },
  },

  // CHECKOUT BANNERS
  {
    title: 'Add Gift Wrapping?',
    subtitle: 'Make it extra special',
    description: 'Premium gift packaging available for ₦2,500. Perfect for birthdays and celebrations.',
    type: 'custom',
    placement: 'checkout',
    displayOrder: 1,
    priority: 'low',
    ctaText: 'Add Gift Wrap',
    linkType: 'internal',
    ctaLink: '#add-gift-wrap',
    ctaStyle: 'outline',
    backgroundColor: '#FFF8DC',
    textColor: '#8B4513',
    overlayOpacity: 0,
    textAlignment: 'center',
    contentPosition: 'center',
    isScheduled: false,
    isActive: true,
    status: 'active',
    isGlobal: true,
    visibleTo: 'authenticated',
    deviceTargeting: { desktop: true, mobile: true, tablet: true },
    tags: ['gift-wrap', 'upsell', 'checkout'],
    image: {
      url: 'https://images.unsplash.com/photo-1513885535751-8b9238bd345a',
      alt: 'Gift wrapped wine bottle',
      width: 800,
      height: 300,
    },
  },

  // FOOTER BANNERS
  {
    title: 'Drink Responsibly',
    subtitle: 'Enjoy our products in moderation',
    description: 'DrinksHarbour supports responsible consumption of alcoholic beverages.',
    type: 'announcement',
    placement: 'footer',
    displayOrder: 1,
    priority: 'low',
    ctaText: 'Learn More',
    linkType: 'page',
    ctaLink: '/responsible-drinking',
    ctaStyle: 'text',
    backgroundColor: '#34495E',
    textColor: '#ECF0F1',
    overlayOpacity: 0,
    textAlignment: 'center',
    contentPosition: 'center',
    isScheduled: false,
    isActive: true,
    status: 'active',
    isGlobal: true,
    visibleTo: 'all',
    deviceTargeting: { desktop: true, mobile: true, tablet: true },
    tags: ['responsible-drinking', 'awareness', 'compliance'],
    image: {
      url: 'https://images.unsplash.com/photo-1569529465841-dfecdab7503b',
      alt: 'Responsible drinking message',
      width: 1920,
      height: 200,
    },
  },
];

// ============================================================
// SEED FUNCTION
// ============================================================

async function seedBanners() {
  try {
    console.log('🎨 Starting Banner Seeding...\n');
    console.log('═══════════════════════════════════════════════════════');

    // Connect to database
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is not set.');
    }

    console.log('📡 Connecting to MongoDB...');
    await db.connectDB();
    console.log('✓ Connected to database\n');

    // Clear existing banners if reset flag is present
    if (process.argv.includes('--reset')) {
      console.log('🗑️  Clearing existing banners...');
      await Banner.deleteMany({});
      console.log('✓ Existing banners cleared\n');
    }

    // Get references
    console.log('🔍 Fetching database references...');
    
    const [
      categories,
      brands,
      products,
      tenants,
      superAdmin,
    ] = await Promise.all([
      Category.find({}).limit(10).lean(),
      Brand.find({}).limit(10).lean(),
      Product.find({ status: 'approved' }).limit(20).lean(),
      Tenant.find({ status: 'approved' }).limit(5).lean(),
      User.findOne({ role: 'super_admin' }).lean(),
    ]);

    console.log(`✓ Found ${categories.length} categories`);
    console.log(`✓ Found ${brands.length} brands`);
    console.log(`✓ Found ${products.length} products`);
    console.log(`✓ Found ${tenants.length} tenants\n`);

    // Create banners
    console.log('🎨 Creating banners...\n');

    const createdBanners = [];
    let successCount = 0;
    let errorCount = 0;

    for (const template of bannerTemplates) {
      try {
        const bannerData = { ...template };

        // Set creator
        if (superAdmin) {
          bannerData.createdBy = superAdmin._id;
          bannerData.updatedBy = superAdmin._id;
        }

        // Assign references based on linkType
        if (template.linkType === 'category' && categories.length > 0) {
          // Match category by type
          const matchingCategory = categories.find(cat => 
            template.title.toLowerCase().includes(cat.name.toLowerCase()) ||
            template.title.toLowerCase().includes(cat.type?.toLowerCase())
          ) || categories[0];
          
          bannerData.targetCategory = matchingCategory._id;
        }

        if (template.linkType === 'brand' && brands.length > 0) {
          // Match brand by name in title
          const matchingBrand = brands.find(brand => 
            template.title.toLowerCase().includes(brand.name.toLowerCase())
          ) || brands[0];
          
          bannerData.targetBrand = matchingBrand._id;
        }

        if (template.linkType === 'product' && products.length > 0) {
          // Match product by name or type
          const matchingProduct = products.find(product => 
            template.title.toLowerCase().includes(product.name.toLowerCase()) ||
            template.title.toLowerCase().includes(product.type?.toLowerCase())
          ) || products[0];
          
          bannerData.targetProduct = matchingProduct._id;
        }

        // Assign tenant for tenant-specific banners
        if (!template.isGlobal && tenants.length > 0) {
          bannerData.tenant = tenants[Math.floor(Math.random() * tenants.length)]._id;
        }

        // Create banner
        const banner = await Banner.create(bannerData);
        createdBanners.push(banner);
        successCount++;

        console.log(`✓ Created: ${banner.title}`);
        console.log(`  Type: ${banner.type} | Placement: ${banner.placement} | Status: ${banner.status}`);

      } catch (error) {
        errorCount++;
        console.error(`✗ Failed to create: ${template.title}`);
        console.error(`  Error: ${error.message}\n`);
      }
    }

    // Summary
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('✅ BANNER SEEDING COMPLETED!\n');
    console.log('📊 Summary:');
    console.log(`   • Total Templates: ${bannerTemplates.length}`);
    console.log(`   • Successfully Created: ${successCount}`);
    console.log(`   • Errors: ${errorCount}`);
    console.log(`   • Active Banners: ${createdBanners.filter(b => b.status === 'active').length}`);
    console.log(`   • Scheduled Banners: ${createdBanners.filter(b => b.status === 'scheduled').length}`);
    console.log(`   • Draft Banners: ${createdBanners.filter(b => b.status === 'draft').length}`);

    // Breakdown by placement
    console.log('\n📍 Breakdown by Placement:');
    const placementGroups = createdBanners.reduce((acc, banner) => {
      acc[banner.placement] = (acc[banner.placement] || 0) + 1;
      return acc;
    }, {});

    Object.entries(placementGroups).forEach(([placement, count]) => {
      console.log(`   • ${placement}: ${count}`);
    });

    // Breakdown by type
    console.log('\n🎯 Breakdown by Type:');
    const typeGroups = createdBanners.reduce((acc, banner) => {
      acc[banner.type] = (acc[banner.type] || 0) + 1;
      return acc;
    }, {});

    Object.entries(typeGroups).forEach(([type, count]) => {
      console.log(`   • ${type}: ${count}`);
    });

    console.log('\n💡 Usage Tips:');
    console.log('   • Use GET /api/banners/placement/:placement to fetch banners for specific areas');
    console.log('   • Track impressions: POST /api/banners/:id/impression');
    console.log('   • Track clicks: POST /api/banners/:id/click');
    console.log('   • Manage banners: GET /api/banners (Admin only)');
    console.log('═══════════════════════════════════════════════════════\n');

    await db.disconnectDB();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Banner seeding failed:', error.message);
    console.error('\nStack trace:', error.stack);
    
    try {
      if (mongoose.connection.readyState === 1) {
        await db.disconnectDB();
      }
    } catch (disconnectError) {
      // Ignore
    }
    
    process.exit(1);
  }
}

// Run seeder
if (require.main === module) {
  seedBanners();
}

module.exports = seedBanners;