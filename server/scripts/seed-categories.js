require('dotenv').config();
const mongoose = require('mongoose');
const db = require('../config/db');

const Category = require('../models/Category');

const categoriesData = [
  {
    name: 'Whiskey',
    slug: 'whiskey',
    type: 'whiskey',
    description: 'Single malt and blended whiskeys from around the world, including Scotch, Bourbon, and Irish whiskey.',
    shortDescription: 'Premium World Whiskeys',
    tagline: 'Sip & Savor',
    alcoholCategory: 'alcoholic',
    color: '#92400e',
    icon: '🥃',
    featuredImage: {
      url: 'https://images.unsplash.com/photo-1527281400683-1a436ad75c27?w=800&h=600&fit=crop',
      alt: 'Premium Whiskey Collection',
    },
    bannerImage: {
      url: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=1200&h=400&fit=crop',
      alt: 'Whiskey Banner',
    },
    isFeatured: true,
    order: 1,
    status: 'published',
  },
  {
    name: 'Vodka',
    slug: 'vodka',
    type: 'vodka',
    description: 'Premium vodkas from Russia, Sweden, France, and other renowned distilling regions.',
    shortDescription: 'Premium Vodkas',
    tagline: 'Pure & Clean',
    alcoholCategory: 'alcoholic',
    color: '#0ea5e9',
    icon: '🥃',
    featuredImage: {
      url: 'https://images.unsplash.com/photo-1605218457336-98db6b9b7601?w=800&h=600&fit=crop',
      alt: 'Premium Vodka Collection',
    },
    bannerImage: {
      url: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=1200&h=400&fit=crop',
      alt: 'Vodka Banner',
    },
    isFeatured: true,
    order: 2,
    status: 'published',
  },
  {
    name: 'Champagne',
    slug: 'champagne',
    type: 'champagne',
    description: 'Authentic French Champagne from the Champagne region, plus premium sparkling wines.',
    shortDescription: 'Fine Champagnes',
    tagline: 'Luxury in Every Bubble',
    alcoholCategory: 'alcoholic',
    color: '#fbbf24',
    icon: '🍾',
    featuredImage: {
      url: 'https://images.unsplash.com/photo-1572575626618-6a0b5d6fb858?w=800&h=600&fit=crop',
      alt: 'Premium Champagne Collection',
    },
    bannerImage: {
      url: 'https://images.unsplash.com/photo-1551534258-0a9c0817686a?w=1200&h=400&fit=crop',
      alt: 'Champagne Banner',
    },
    isFeatured: true,
    order: 3,
    status: 'published',
  },
  {
    name: 'Beer',
    slug: 'beer',
    type: 'beer',
    description: 'Craft beers, lagers, ales, stouts, and IPAs from top breweries worldwide.',
    shortDescription: 'Craft & Premium Beers',
    tagline: 'Discover Your Perfect Brew',
    alcoholCategory: 'alcoholic',
    color: '#f97316',
    icon: '🍺',
    featuredImage: {
      url: 'https://images.unsplash.com/photo-1608270586620-248524c67de9?w=800&h=600&fit=crop',
      alt: 'Premium Beer Collection',
    },
    bannerImage: {
      url: 'https://images.unsplash.com/photo-1608909063917-2a5b3b417dc3?w=1200&h=400&fit=crop',
      alt: 'Beer Banner',
    },
    isFeatured: true,
    order: 4,
    status: 'published',
  },
  {
    name: 'Wine',
    slug: 'wine',
    type: 'wine',
    description: 'Red, white, and rosé wines from renowned vineyards across the globe.',
    shortDescription: 'Fine Wines',
    tagline: 'From Vineyard to Glass',
    alcoholCategory: 'alcoholic',
    color: '#b91c1c',
    icon: '🍷',
    featuredImage: {
      url: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=800&h=600&fit=crop',
      alt: 'Premium Wine Collection',
    },
    bannerImage: {
      url: 'https://images.unsplash.com/photo-1506377247377-2a5b3b417dc3?w=1200&h=400&fit=crop',
      alt: 'Wine Banner',
    },
    isFeatured: true,
    order: 5,
    status: 'published',
  },
  {
    name: 'Gin',
    slug: 'gin',
    type: 'gin',
    description: 'London dry gins, botanical gins, and premium gins with unique flavor profiles.',
    shortDescription: 'Artisan Gins',
    tagline: 'Botanical Bliss',
    alcoholCategory: 'alcoholic',
    color: '#10b981',
    icon: '🍸',
    featuredImage: {
      url: 'https://images.unsplash.com/photo-1514218953589-2d7d37efd9dc?w=800&h=600&fit=crop',
      alt: 'Premium Gin Collection',
    },
    bannerImage: {
      url: 'https://images.unsplash.com/photo-1605218457336-98db6b9b7601?w=1200&h=400&fit=crop',
      alt: 'Gin Banner',
    },
    isFeatured: true,
    order: 6,
    status: 'published',
  },
  {
    name: 'Rum',
    slug: 'rum',
    type: 'rum',
    description: 'Aged rums, spiced rums, and white rums from the Caribbean and beyond.',
    shortDescription: 'Caribbean Rums',
    tagline: 'Tropical Vibes',
    alcoholCategory: 'alcoholic',
    color: '#d97706',
    icon: '🥃',
    featuredImage: {
      url: 'https://images.unsplash.com/photo-1559357960-3e041a6e103c?w=800&h=600&fit=crop',
      alt: 'Premium Rum Collection',
    },
    bannerImage: {
      url: 'https://images.unsplash.com/photo-1514218953589-2d7d37efd9dc?w=1200&h=400&fit=crop',
      alt: 'Rum Banner',
    },
    isFeatured: true,
    order: 7,
    status: 'published',
  },
  {
    name: 'Brandy & Cognac',
    slug: 'brandy',
    type: 'brandy',
    description: 'Fine French Cognac, Armenian Brandy, and premium brandies for sipping.',
    shortDescription: 'Fine Brandies',
    tagline: 'Elegant & Refined',
    alcoholCategory: 'alcoholic',
    color: '#c2410c',
    icon: '🥃',
    featuredImage: {
      url: 'https://images.unsplash.com/photo-1618885472179-5e474019f2a9?w=800&h=600&fit=crop',
      alt: 'Premium Cognac Collection',
    },
    bannerImage: {
      url: 'https://images.unsplash.com/photo-1527281400683-1a436ad75c27?w=1200&h=400&fit=crop',
      alt: 'Cognac Banner',
    },
    isFeatured: true,
    order: 8,
    status: 'published',
  },
  {
    name: 'Tequila',
    slug: 'tequila',
    type: 'tequila',
    description: '100% agave tequilas from Mexico, including Blanco, Reposado, and Añejo.',
    shortDescription: 'Premium Tequilas',
    tagline: 'Mexican Spirit',
    alcoholCategory: 'alcoholic',
    color: '#ca8a04',
    icon: '🥃',
    featuredImage: {
      url: 'https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=800&h=600&fit=crop',
      alt: 'Premium Tequila Collection',
    },
    bannerImage: {
      url: 'https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=1200&h=400&fit=crop',
      alt: 'Tequila Banner',
    },
    isFeatured: false,
    order: 9,
    status: 'published',
  },
  {
    name: 'Liqueurs',
    slug: 'liqueur',
    type: 'liqueur',
    description: 'Sweet liqueurs, cream liqueurs, and aromatic bitters for cocktails.',
    shortDescription: 'Fine Liqueurs',
    tagline: 'Sweet Sophistication',
    alcoholCategory: 'alcoholic',
    color: '#9333ea',
    icon: '🍸',
    featuredImage: {
      url: 'https://images.unsplash.com/photo-1575023782549-62ca0d244b39?w=800&h=600&fit=crop',
      alt: 'Premium Liqueur Collection',
    },
    bannerImage: {
      url: 'https://images.unsplash.com/photo-1575023782549-62ca0d244b39?w=1200&h=400&fit=crop',
      alt: 'Liqueur Banner',
    },
    isFeatured: false,
    order: 10,
    status: 'published',
  },
  {
    name: 'Red Wine',
    slug: 'red-wine',
    type: 'red_wine',
    description: 'Full-bodied red wines including Cabernet Sauvignon, Merlot, Pinot Noir, and Shiraz.',
    shortDescription: 'Rich Red Wines',
    tagline: 'Bold & Beautiful',
    alcoholCategory: 'alcoholic',
    color: '#7f1d1d',
    icon: '🍷',
    featuredImage: {
      url: 'https://images.unsplash.com/photo-1547595628-c61a29f496f0?w=800&h=600&fit=crop',
      alt: 'Red Wine Collection',
    },
    bannerImage: {
      url: 'https://images.unsplash.com/photo-1547595628-c61a29f496f0?w=1200&h=400&fit=crop',
      alt: 'Red Wine Banner',
    },
    isFeatured: false,
    order: 11,
    status: 'published',
  },
  {
    name: 'White Wine',
    slug: 'white-wine',
    type: 'white_wine',
    description: 'Crisp and refreshing white wines including Chardonnay, Sauvignon Blanc, and Riesling.',
    shortDescription: 'Crisp White Wines',
    tagline: 'Light & Elegant',
    alcoholCategory: 'alcoholic',
    color: '#fde047',
    icon: '🥂',
    featuredImage: {
      url: 'https://images.unsplash.com/photo-1586370434639-0fe43b2d32d6?w=800&h=600&fit=crop',
      alt: 'White Wine Collection',
    },
    bannerImage: {
      url: 'https://images.unsplash.com/photo-1586370434639-0fe43b2d32d6?w=1200&h=400&fit=crop',
      alt: 'White Wine Banner',
    },
    isFeatured: false,
    order: 12,
    status: 'published',
  },
  {
    name: 'Rosé Wine',
    slug: 'rose-wine',
    type: 'rose_wine',
    description: 'Beautiful dry rosé wines perfect for warm days and celebrations.',
    shortDescription: 'Perfect Rosé Wines',
    tagline: 'Pretty in Pink',
    alcoholCategory: 'alcoholic',
    color: '#fb7185',
    icon: '🍷',
    featuredImage: {
      url: 'https://images.unsplash.com/photo-1584916201218-f4242ceb4809?w=800&h=600&fit=crop',
      alt: 'Rosé Wine Collection',
    },
    bannerImage: {
      url: 'https://images.unsplash.com/photo-1584916201218-f4242ceb4809?w=1200&h=400&fit=crop',
      alt: 'Rosé Wine Banner',
    },
    isFeatured: false,
    order: 13,
    status: 'published',
  },
  {
    name: 'Sparkling Wine',
    slug: 'sparkling-wine',
    type: 'sparkling_wine',
    description: 'Bubbly delights including Prosecco, Cava, and other sparkling wines.',
    shortDescription: 'Sparkling Wines',
    tagline: 'Pop the Celebration',
    alcoholCategory: 'alcoholic',
    color: '#fde68a',
    icon: '🥂',
    featuredImage: {
      url: 'https://images.unsplash.com/photo-1598473445208-91323cf87d8c?w=800&h=600&fit=crop',
      alt: 'Sparkling Wine Collection',
    },
    bannerImage: {
      url: 'https://images.unsplash.com/photo-1598473445208-91323cf87d8c?w=1200&h=400&fit=crop',
      alt: 'Sparkling Wine Banner',
    },
    isFeatured: false,
    order: 14,
    status: 'published',
  },
  {
    name: 'Scotch',
    slug: 'scotch',
    type: 'scotch',
    description: 'Single malt and blended Scotch whiskies from Scotland\'s legendary distilleries.',
    shortDescription: 'Authentic Scotch',
    tagline: 'Scottish Heritage',
    alcoholCategory: 'alcoholic',
    color: '#78350f',
    icon: '🥃',
    featuredImage: {
      url: 'https://images.unsplash.com/photo-1527281400683-1a436ad75c27?w=800&h=600&fit=crop',
      alt: 'Scotch Collection',
    },
    bannerImage: {
      url: 'https://images.unsplash.com/photo-1527281400683-1a436ad75c27?w=1200&h=400&fit=crop',
      alt: 'Scotch Banner',
    },
    isFeatured: false,
    order: 15,
    status: 'published',
  },
  {
    name: 'Bourbon',
    slug: 'bourbon',
    type: 'bourbon',
    description: 'Premium American bourbon whiskey aged in new charred oak barrels.',
    shortDescription: 'American Bourbon',
    tagline: 'American Spirit',
    alcoholCategory: 'alcoholic',
    color: '#92400e',
    icon: '🥃',
    featuredImage: {
      url: 'https://images.unsplash.com/photo-1514218953589-2d7d37efd9dc?w=800&h=600&fit=crop',
      alt: 'Bourbon Collection',
    },
    bannerImage: {
      url: 'https://images.unsplash.com/photo-1514218953589-2d7d37efd9dc?w=1200&h=400&fit=crop',
      alt: 'Bourbon Banner',
    },
    isFeatured: false,
    order: 16,
    status: 'published',
  },
  {
    name: 'Coffee',
    slug: 'coffee',
    type: 'coffee',
    description: 'Premium coffee beans, ground coffee, and specialty brews from around the world.',
    shortDescription: 'Artisan Coffee',
    tagline: 'Awaken Your Senses',
    alcoholCategory: 'non_alcoholic',
    color: '#78350f',
    icon: '☕',
    featuredImage: {
      url: 'https://images.unsplash.com/photo-1497935586351-b67a49e012bf?w=800&h=600&fit=crop',
      alt: 'Premium Coffee Collection',
    },
    bannerImage: {
      url: 'https://images.unsplash.com/photo-1497935586351-b67a49e012bf?w=1200&h=400&fit=crop',
      alt: 'Coffee Banner',
    },
    isFeatured: true,
    order: 17,
    status: 'published',
  },
  {
    name: 'Tea',
    slug: 'tea',
    type: 'tea',
    description: 'Fine teas from around the world including black, green, herbal, and specialty blends.',
    shortDescription: 'Premium Teas',
    tagline: 'Steeped in Tradition',
    alcoholCategory: 'non_alcoholic',
    color: '#10b981',
    icon: '🍵',
    featuredImage: {
      url: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=800&h=600&fit=crop',
      alt: 'Premium Tea Collection',
    },
    bannerImage: {
      url: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=1200&h=400&fit=crop',
      alt: 'Tea Banner',
    },
    isFeatured: true,
    order: 18,
    status: 'published',
  },
  {
    name: 'Juice',
    slug: 'juice',
    type: 'juice',
    description: 'Fresh fruit and vegetable juices, smoothies, and nectar.',
    shortDescription: 'Fresh Juices',
    tagline: 'Nature\'s Nectar',
    alcoholCategory: 'non_alcoholic',
    color: '#10b981',
    icon: '🧃',
    featuredImage: {
      url: 'https://images.unsplash.com/photo-1610970881699-44a5587cabec?w=800&h=600&fit=crop',
      alt: 'Fresh Juice Collection',
    },
    bannerImage: {
      url: 'https://images.unsplash.com/photo-1610970881699-44a5587cabec?w=1200&h=400&fit=crop',
      alt: 'Juice Banner',
    },
    isFeatured: false,
    order: 19,
    status: 'published',
  },
  {
    name: 'Water',
    slug: 'water',
    type: 'water',
    description: 'Still, sparkling, and mineral waters from pristine sources.',
    shortDescription: 'Pure Waters',
    tagline: 'Pure & Simple',
    alcoholCategory: 'non_alcoholic',
    color: '#0ea5e9',
    icon: '💧',
    featuredImage: {
      url: 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=800&h=600&fit=crop',
      alt: 'Premium Water Collection',
    },
    bannerImage: {
      url: 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=1200&h=400&fit=crop',
      alt: 'Water Banner',
    },
    isFeatured: false,
    order: 20,
    status: 'published',
  },
  {
    name: 'Soft Drinks',
    slug: 'soft-drinks',
    type: 'soft_drink',
    description: 'Sodas, colas, and carbonated soft drinks from top brands.',
    shortDescription: 'Soft Drinks',
    tagline: 'Refresh Yourself',
    alcoholCategory: 'non_alcoholic',
    color: '#ef4444',
    icon: '🥤',
    featuredImage: {
      url: 'https://images.unsplash.com/photo-1581006852262-e4307cf6283a?w=800&h=600&fit=crop',
      alt: 'Soft Drinks Collection',
    },
    bannerImage: {
      url: 'https://images.unsplash.com/photo-1581006852262-e4307cf6283a?w=1200&h=400&fit=crop',
      alt: 'Soft Drinks Banner',
    },
    isFeatured: false,
    order: 21,
    status: 'published',
  },
];

async function seedCategories() {
  try {
    await db.connectDB();
    console.log('Connected to MongoDB\n');

    // Clear existing categories
    await Category.deleteMany({});
    console.log('Cleared existing categories\n');

    // Insert categories
    const inserted = await Category.insertMany(categoriesData);
    console.log(`✅ Inserted ${inserted.length} categories:\n`);

    inserted.forEach((cat) => {
      console.log(`  • ${cat.name} (${cat.slug})`);
    });

    console.log('\n' + '='.repeat(50));
    console.log('✅ Categories Seed Complete!');
    console.log('='.repeat(50));

  } catch (error) {
    console.error('\n❌ Error seeding categories:', error);
  } finally {
    await db.disconnectDB();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

seedCategories();
