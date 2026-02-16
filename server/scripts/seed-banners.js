// scripts/seed-banners.js

const mongoose = require('mongoose');
require('dotenv').config();

const Banner = require('../models/Banner');

const validPlaceholderImages = [
  'https://images.unsplash.com/photo-1514362545857-3bc16549766b?w=1200',
  'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=1200',
  'https://images.unsplash.com/photo-1544022613-e87ca75a784a?w=1200',
  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200',
  'https://images.unsplash.com/photo-1481018083511-e607c2b5a824?w=1200',
  'https://images.unsplash.com/photo-1572116469696-31de0f17cc34?w=1200',
  'https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=1200',
  'https://images.unsplash.com/photo-1607628159799-43200dbcf87b?w=1200',
  'https://images.unsplash.com/photo-1560508180-03f285bc6758?w=1200',
  'https://images.unsplash.com/photo-1559357960-3e041a6e103c?w=1200',
];

function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
}

const bannerData = [
  {
    title: 'Premium Whiskeys',
    slug: generateSlug('Premium Whiskeys'),
    subtitle: 'Discover our exclusive collection',
    description: 'Hand-selected premium whiskeys from around the world',
    image: { url: validPlaceholderImages[0], alt: 'Premium Whiskey Collection' },
    type: 'hero', placement: 'home_hero', status: 'active', isActive: true,
    isGlobal: true, visibleTo: 'all', linkType: 'category',
    ctaText: 'Shop Now', ctaLink: '/shop?category=whiskey',
    displayOrder: 1, priority: 'high', backgroundColor: '#1a1a2e', textColor: '#ffffff',
  },
  {
    title: 'Summer Wine Sale',
    slug: generateSlug('Summer Wine Sale'),
    subtitle: 'Up to 30% Off',
    description: 'Save on select wines this season',
    image: { url: validPlaceholderImages[1], alt: 'Summer Wine Sale' },
    type: 'promotional', placement: 'home_secondary', status: 'active', isActive: true,
    isGlobal: true, visibleTo: 'all', linkType: 'category',
    ctaText: 'View Deals', ctaLink: '/shop?sale=true&category=wine',
    displayOrder: 1, priority: 'high',
    discount: { type: 'percentage', value: 30, label: '30% OFF' },
    backgroundColor: '#722f37', textColor: '#ffffff',
  },
  {
    title: 'Craft Beers',
    slug: generateSlug('Craft Beers'),
    subtitle: 'Local & International Favorites',
    description: 'Explore our curated selection of craft beers',
    image: { url: validPlaceholderImages[2], alt: 'Craft Beer Selection' },
    type: 'category', placement: 'category_top', status: 'active', isActive: true,
    isGlobal: true, visibleTo: 'all', linkType: 'category',
    ctaText: 'Explore', ctaLink: '/shop?category=beer',
    displayOrder: 1, priority: 'medium', backgroundColor: '#f5a623', textColor: '#1a1a2e',
  },
  {
    title: 'Premium Vodka Collection',
    slug: generateSlug('Premium Vodka Collection'),
    subtitle: 'Smooth & Elegant',
    description: 'From classic to boutique brands',
    image: { url: validPlaceholderImages[3], alt: 'Premium Vodka' },
    type: 'category', placement: 'category_top', status: 'active', isActive: true,
    isGlobal: true, visibleTo: 'all', linkType: 'category',
    ctaText: 'Discover', ctaLink: '/shop?category=vodka',
    displayOrder: 2, priority: 'medium', backgroundColor: '#e8e8e8', textColor: '#1a1a2e',
  },
  {
    title: 'Gin & Tonic Essentials',
    slug: generateSlug('Gin & Tonic Essentials'),
    subtitle: 'Perfect Mixers Included',
    description: 'Everything you need for the perfect G&T',
    image: { url: validPlaceholderImages[4], alt: 'Gin Collection' },
    type: 'product', placement: 'product_page', status: 'active', isActive: true,
    isGlobal: true, visibleTo: 'all', linkType: 'product',
    ctaText: 'Shop Bundle', ctaLink: '/shop?tag=gin_bundle',
    displayOrder: 1, priority: 'medium', backgroundColor: '#2d5a27', textColor: '#ffffff',
  },
  {
    title: 'Free Delivery',
    slug: generateSlug('Free Delivery'),
    subtitle: 'Orders Over ₦50,000',
    description: 'On all alcoholic beverages',
    image: { url: validPlaceholderImages[5], alt: 'Free Delivery' },
    type: 'announcement', placement: 'header', status: 'active', isActive: true,
    isGlobal: true, visibleTo: 'all', linkType: 'internal',
    ctaText: '', ctaLink: '/shipping',
    displayOrder: 1, priority: 'low', backgroundColor: '#10b981', textColor: '#ffffff',
  },
  {
    title: 'New Arrivals',
    slug: generateSlug('New Arrivals'),
    subtitle: 'Fresh Picks This Week',
    description: 'Check out our latest additions',
    image: { url: validPlaceholderImages[6], alt: 'New Arrivals' },
    type: 'seasonal', placement: 'home_secondary', status: 'active', isActive: true,
    isGlobal: true, visibleTo: 'all', linkType: 'category',
    ctaText: 'See New', ctaLink: '/shop?tag=new-arrival',
    displayOrder: 2, priority: 'medium', backgroundColor: '#6366f1', textColor: '#ffffff',
  },
  {
    title: 'Gift Sets',
    slug: generateSlug('Gift Sets'),
    subtitle: 'Perfect for Any Occasion',
    description: 'Beautifully packaged gift sets',
    image: { url: validPlaceholderImages[7], alt: 'Gift Sets' },
    type: 'promotional', placement: 'footer', status: 'active', isActive: true,
    isGlobal: true, visibleTo: 'all', linkType: 'collection',
    ctaText: 'Browse Gifts', ctaLink: '/shop?collection=gifts',
    displayOrder: 1, priority: 'medium', backgroundColor: '#1a1a2e', textColor: '#ffffff',
  },
  {
    title: 'VIP Club',
    slug: generateSlug('VIP Club'),
    subtitle: 'Join & Save 15%',
    description: 'Exclusive member benefits',
    image: { url: validPlaceholderImages[8], alt: 'VIP Club' },
    type: 'custom', placement: 'sidebar', status: 'active', isActive: true,
    isGlobal: true, visibleTo: 'guests', linkType: 'page',
    ctaText: 'Join Now', ctaLink: '/vip-signup',
    displayOrder: 1, priority: 'medium', backgroundColor: '#f59e0b', textColor: '#1a1a2e',
  },
  {
    title: 'Age Verification',
    slug: generateSlug('Age Verification'),
    subtitle: 'Must be 18+ to purchase',
    description: 'Drink responsibly',
    image: { url: validPlaceholderImages[9], alt: 'Age Warning' },
    type: 'announcement', placement: 'popup', status: 'active', isActive: true,
    isGlobal: true, visibleTo: 'guests', linkType: 'page',
    ctaText: 'I am 18+', ctaLink: '/age-policy',
    displayOrder: 1, priority: 'urgent', backgroundColor: '#1a1a2e', textColor: '#ffffff',
  },
];

async function seedBanners() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    await Banner.deleteMany({});
    console.log('Cleared existing banners');

    const banners = await Banner.insertMany(bannerData);
    console.log(`Inserted ${banners.length} banners`);

    const byType = banners.reduce((acc, b) => { acc[b.type] = (acc[b.type] || 0) + 1; return acc; }, {});
    const byPlacement = banners.reduce((acc, b) => { acc[b.placement] = (acc[b.placement] || 0) + 1; return acc; }, {});

    console.log('\nBanners by type:', byType);
    console.log('Banners by placement:', byPlacement);
    console.log('\n Banner seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding banners:', error);
    process.exit(1);
  }
}

seedBanners();
