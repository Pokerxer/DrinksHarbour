// scripts/seed-brands.js
/**
 * Seed script to populate sample brands
 * Run with: node scripts/seed-brands.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Brand = require('../models/Brand');

const sampleBrands = [
  {
    name: 'Moët & Chandon',
    slug: 'moet-chandon',
    description: 'French luxury brand of champagne known for its high-quality sparkling wines.',
    shortDescription: 'Premium French champagne house',
    brandType: 'champagne_house',
    primaryCategory: 'champagne',
    countryOfOrigin: 'France',
    region: 'Champagne',
    founded: 1743,
    isFeatured: true,
    isPremium: true,
    verified: true,
    status: 'active',
    productCount: 12
  },
  {
    name: 'Dom Pérignon',
    slug: 'dom-perignon',
    description: 'Prestigious vintage champagne produced by the Champagne house Moët & Chandon.',
    shortDescription: 'Luxury vintage champagne',
    brandType: 'champagne_house',
    primaryCategory: 'champagne',
    countryOfOrigin: 'France',
    region: 'Champagne',
    founded: 1668,
    isFeatured: true,
    isPremium: true,
    verified: true,
    status: 'active',
    productCount: 8
  },
  {
    name: 'Hennessy',
    slug: 'hennessy',
    description: 'World-renowned cognac house founded in 1765, known for exceptional quality.',
    shortDescription: 'World-famous cognac producer',
    brandType: 'distillery',
    primaryCategory: 'spirits',
    countryOfOrigin: 'France',
    region: 'Cognac',
    founded: 1765,
    isFeatured: true,
    isPremium: true,
    verified: true,
    status: 'active',
    productCount: 15
  },
  {
    name: 'Johnnie Walker',
    slug: 'johnnie-walker',
    description: 'Iconic Scotch whisky brand offering a range of blended whiskies.',
    shortDescription: 'Iconic Scotch whisky brand',
    brandType: 'distillery',
    primaryCategory: 'spirits',
    countryOfOrigin: 'United Kingdom',
    region: 'Scotland',
    founded: 1820,
    isFeatured: true,
    verified: true,
    status: 'active',
    productCount: 20
  },
  {
    name: 'Rémy Martin',
    slug: 'remy-martin',
    description: 'Fine Champagne Cognac producer since 1724, specializing in premium spirits.',
    shortDescription: 'Fine Champagne Cognac',
    brandType: 'distillery',
    primaryCategory: 'spirits',
    countryOfOrigin: 'France',
    region: 'Cognac',
    founded: 1724,
    isFeatured: true,
    isPremium: true,
    verified: true,
    status: 'active',
    productCount: 10
  },
  {
    name: 'Glenfiddich',
    slug: 'glenfiddich',
    description: 'World\'s most awarded single malt Scotch whisky from Scotland.',
    shortDescription: 'Award-winning single malt whisky',
    brandType: 'distillery',
    primaryCategory: 'spirits',
    countryOfOrigin: 'United Kingdom',
    region: 'Speyside',
    founded: 1887,
    isFeatured: true,
    verified: true,
    status: 'active',
    productCount: 14
  },
  {
    name: 'Chivas Regal',
    slug: 'chivas-regal',
    description: 'Blended Scotch whisky known for its smooth, rich, and generous character.',
    shortDescription: 'Premium blended Scotch whisky',
    brandType: 'distillery',
    primaryCategory: 'spirits',
    countryOfOrigin: 'United Kingdom',
    region: 'Scotland',
    founded: 1801,
    isFeatured: true,
    verified: true,
    status: 'active',
    productCount: 11
  },
  {
    name: 'Martell',
    slug: 'martell',
    description: 'One of the oldest cognac houses in France, founded in 1715.',
    shortDescription: 'Historic French cognac house',
    brandType: 'distillery',
    primaryCategory: 'spirits',
    countryOfOrigin: 'France',
    region: 'Cognac',
    founded: 1715,
    isFeatured: true,
    isPremium: true,
    verified: true,
    status: 'active',
    productCount: 9
  },
  {
    name: 'Absolut Vodka',
    slug: 'absolut-vodka',
    description: 'Swedish vodka brand known for its purity and iconic bottle design.',
    shortDescription: 'Premium Swedish vodka',
    brandType: 'distillery',
    primaryCategory: 'spirits',
    countryOfOrigin: 'Sweden',
    founded: 1879,
    isFeatured: false,
    verified: true,
    status: 'active',
    productCount: 7
  },
  {
    name: 'Baileys',
    slug: 'baileys',
    description: 'Irish cream liqueur blending Irish whiskey and fresh dairy cream.',
    shortDescription: 'Irish cream liqueur',
    brandType: 'distillery',
    primaryCategory: 'liqueurs',
    countryOfOrigin: 'Ireland',
    founded: 1974,
    isFeatured: false,
    verified: true,
    status: 'active',
    productCount: 6
  },
  {
    name: 'Jack Daniel\'s',
    slug: 'jack-daniels',
    description: 'Tennessee whiskey known for its smooth, charcoal-mellowed character.',
    shortDescription: 'Iconic Tennessee whiskey',
    brandType: 'distillery',
    primaryCategory: 'spirits',
    countryOfOrigin: 'United States',
    region: 'Tennessee',
    founded: 1866,
    isFeatured: true,
    verified: true,
    status: 'active',
    productCount: 18
  },
  {
    name: 'Grey Goose',
    slug: 'grey-goose',
    description: 'Premium French vodka crafted with the finest ingredients.',
    shortDescription: 'Luxury French vodka',
    brandType: 'distillery',
    primaryCategory: 'spirits',
    countryOfOrigin: 'France',
    founded: 1997,
    isFeatured: false,
    isPremium: true,
    verified: true,
    status: 'active',
    productCount: 5
  }
];

async function seedBrands() {
  try {
    // Connect to database
    const { connectDB } = require('../config/db');
    await connectDB();
    
    console.log('Connected to database. Seeding brands...');
    
    // Clear existing brands
    await Brand.deleteMany({});
    console.log('Cleared existing brands');
    
    // Insert sample brands
    const brands = await Brand.insertMany(sampleBrands);
    console.log(`✅ Successfully seeded ${brands.length} brands`);
    
    // Log the featured brands
    const featuredBrands = brands.filter(b => b.isFeatured);
    console.log('\n📌 Featured Brands:');
    featuredBrands.forEach((brand, i) => {
      console.log(`  ${i + 1}. ${brand.name} (${brand.productCount} products)`);
    });
    
    console.log('\n✨ Brand seeding completed!');
    
  } catch (error) {
    console.error('❌ Error seeding brands:', error);
    process.exit(1);
  } finally {
    // Disconnect from database
    const { disconnectDB } = require('../config/db');
    await disconnectDB();
    process.exit(0);
  }
}

// Run the seed function
seedBrands();
