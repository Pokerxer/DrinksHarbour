// seed-sale-products.js
// Run with: node scripts/seed-sale-products.js
// Adds sale pricing to existing products in the database

require('dotenv').config();
const mongoose = require('mongoose');

// Database connection
const db = require('../config/db');

// Models - Using lowercase as per the seed.js file
const Product = require('../models/Product');
const SubProduct = require('../models/SubProduct');
const Size = require('../models/Size');

async function seedSaleProducts() {
  try {
    await db.connectDB();
    console.log('Connected to MongoDB\n');

    // Get existing products to add sale pricing
    console.log('🔍 Finding products to add sale pricing...\n');

    // Find products by name or type
    const products = await Product.find({
      $or: [
        { name: { $regex: /hennessy|greys|goose|moet|guinness|absolut|jack|jameson|veuve|budweiser|chivas/i } },
        { type: { $in: ['cognac', 'vodka', 'champagne', 'stout', 'lager', 'whiskey', 'bourbon'] } }
      ],
      status: 'approved'
    }).limit(20);

    console.log(`Found ${products.length} products to add sale pricing\n`);

    if (products.length === 0) {
      console.log('⚠️  No products found. Please run the main seed.js first.');
      return;
    }

    // Get a tenant for the subproducts
    const Tenant = require('../models/Tenant');
    const tenants = await Tenant.find({}).limit(1);
    const tenant = tenants[0];

    if (!tenant) {
      console.log('⚠️  No tenants found. Creating a default tenant...');
      const newTenant = await Tenant.create({
        name: 'DrinksHarbour',
        slug: 'drinksharbour',
        email: 'admin@drinksharbour.com',
        phone: '+2341234567890',
        status: 'active',
        isActive: true,
        revenueModel: 'markup',
        markupPercentage: 30,
        defaultCurrency: 'NGN',
        address: {
          street: '123 Lagos',
          city: 'Lagos',
          state: 'Lagos',
          country: 'Nigeria'
        }
      });
      console.log(`✓ Created tenant: ${newTenant.name}\n`);
    }

    const defaultTenant = tenants[0] || newTenant;

    // Sale products data with proper structure
    const saleProductsData = [
      {
        name: 'Hennessy VSOP',
        type: 'cognac',
        tagline: 'Premium French Cognac',
        description: 'The reference in cognac. A subtle balance of power and smoothness.',
        alcoholByVolume: 40,
        volumeMl: 700,
        sizes: [
          { size: '70cl', displayName: '700ml Bottle', multiplier: 1 },
          { size: '1L', displayName: '1L Bottle', multiplier: 1.4 },
        ],
        basePrice: 18500,
        saleDiscount: 20,
        images: ['https://images.unsplash.com/photo-1618885472179-5e474019f2a9?w=500']
      },
      {
        name: 'Grey Goose Vodka',
        type: 'vodka',
        tagline: 'World\'s Best Tasting Vodka',
        description: 'The vodka from France. Exceptionally smooth and refined.',
        alcoholByVolume: 40,
        volumeMl: 700,
        sizes: [
          { size: '70cl', displayName: '700ml Bottle', multiplier: 1 },
          { size: '1L', displayName: '1L Bottle', multiplier: 1.4 },
        ],
        basePrice: 15200,
        saleDiscount: 20,
        images: ['https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=500']
      },
      {
        name: 'Moet & Chandon Imperial',
        type: 'champagne',
        tagline: 'The Most Generous Champagne',
        description: 'Lively, fruity, and elegant. The perfect expression of Moet & Chandon style.',
        alcoholByVolume: 12,
        volumeMl: 750,
        sizes: [
          { size: '75cl', displayName: '750ml Bottle', multiplier: 1 },
          { size: '1.5L', displayName: '1.5L Magnum', multiplier: 2 },
        ],
        basePrice: 12500,
        saleDiscount: 25,
        images: ['https://images.unsplash.com/photo-1582663521331-b9052d3861b8?w=500']
      },
      {
        name: 'Guinness Draught',
        type: 'stout',
        tagline: 'Surprisingly Smooth',
        description: 'The iconic Irish stout. Rich, creamy, and perfect for any occasion.',
        alcoholByVolume: 4.2,
        volumeMl: 440,
        sizes: [
          { size: 'can-440ml', displayName: '440ml Can (6 Pack)', multiplier: 6, packSize: 6 },
          { size: 'bottle-330ml', displayName: '330ml Bottle (6 Pack)', multiplier: 6, packSize: 6 },
        ],
        basePrice: 3600,
        saleDiscount: 25,
        images: ['https://images.unsplash.com/photo-1608879493122-e3876d490a0c?w=500']
      },
      {
        name: 'Absolut Vodka',
        type: 'vodka',
        tagline: 'Pure & Clean',
        description: 'One of the world\'s finest vodkas. Crystal clear with a pure taste.',
        alcoholByVolume: 40,
        volumeMl: 700,
        sizes: [
          { size: '70cl', displayName: '700ml Bottle', multiplier: 1 },
          { size: '1L', displayName: '1L Bottle', multiplier: 1.4 },
        ],
        basePrice: 8900,
        saleDiscount: 25,
        images: ['https://images.unsplash.com/photo-1514218953589-2d7d37efd9dc?w=500']
      },
      {
        name: 'Jack Daniel\'s Old No.7',
        type: 'whiskey',
        tagline: 'Jack Daniel\'s Old No.7',
        description: 'Tennessee whiskey. Smooth, rich, and iconic.',
        alcoholByVolume: 40,
        volumeMl: 700,
        sizes: [
          { size: '70cl', displayName: '700ml Bottle', multiplier: 1 },
          { size: '1L', displayName: '1L Bottle', multiplier: 1.4 },
        ],
        basePrice: 14200,
        saleDiscount: 25,
        images: ['https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=500']
      },
      {
        name: 'Jameson Irish Whiskey',
        type: 'irish_whiskey',
        tagline: 'Smooth & Versatile',
        description: 'Triple distilled for exceptional smoothness. Ireland\'s favorite whiskey.',
        alcoholByVolume: 40,
        volumeMl: 700,
        sizes: [
          { size: '70cl', displayName: '700ml Bottle', multiplier: 1 },
          { size: '1L', displayName: '1L Bottle', multiplier: 1.4 },
        ],
        basePrice: 11800,
        saleDiscount: 25,
        images: ['https://images.unsplash.com/photo-1603422848262-da9732642a2d?w=500']
      },
      {
        name: 'Veuve Clicquot Yellow Label',
        type: 'champagne',
        tagline: 'The Golden Quality',
        description: 'The signature champagne. Bold, generous, and luxurious.',
        alcoholByVolume: 12,
        volumeMl: 750,
        sizes: [
          { size: '75cl', displayName: '750ml Bottle', multiplier: 1 },
          { size: '1.5L', displayName: '1.5L Magnum', multiplier: 2 },
        ],
        basePrice: 18500,
        saleDiscount: 20,
        images: ['https://images.unsplash.com/photo-1572570666838-3c0c6d32d9c5?w=500']
      },
      {
        name: 'Budweiser Lager',
        type: 'lager',
        tagline: 'King of Beers',
        description: 'Premium American lager. Crisp, refreshing, and classic.',
        alcoholByVolume: 5,
        volumeMl: 500,
        sizes: [
          { size: 'can-500ml', displayName: '500ml Can (6 Pack)', multiplier: 6, packSize: 6 },
        ],
        basePrice: 4200,
        saleDiscount: 25,
        images: ['https://images.unsplash.com/photo-1608270586620-248524c67de9?w=500']
      },
      {
        name: 'Chivas Regal 12 Year',
        type: 'whiskey',
        tagline: 'Chivas 12 Year Old',
        description: 'Blended Scotch whisky. Rich, fruity, and exceptionally smooth.',
        alcoholByVolume: 40,
        volumeMl: 700,
        sizes: [
          { size: '70cl', displayName: '700ml Bottle', multiplier: 1 },
          { size: '1L', displayName: '1L Bottle', multiplier: 1.4 },
        ],
        basePrice: 16500,
        saleDiscount: 25,
        images: ['https://images.unsplash.com/photo-1527282873589-54557961d813?w=500']
      }
    ];

    let productsCreated = 0;
    let subproductsCreated = 0;
    let sizesCreated = 0;
    let productsUpdated = 0;

    const now = new Date();
    const saleEndDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days

    for (const saleData of saleProductsData) {
      // Check if product already exists
      let product = await Product.findOne({ 
        name: { $regex: new RegExp(`^${saleData.name}$`, 'i') }
      });

      if (product) {
        console.log(`📦 Product exists: ${saleData.name}`);
        productsUpdated++;
      } else {
        // Create new product
        const slug = saleData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        
        product = await Product.create({
          name: saleData.name,
          slug,
          type: saleData.type,
          tagline: saleData.tagline,
          description: saleData.description,
          alcoholByVolume: saleData.alcoholByVolume,
          volumeMl: saleData.volumeMl,
          status: 'approved',
          isActive: true,
          isAlcoholic: true,
          ageRestriction: 18,
          requiresAgeVerification: true,
          images: saleData.images.map((url, index) => ({
            url,
            alt: saleData.name,
            isPrimary: index === 0,
            order: index
          })),
          vendor: defaultTenant._id,
        });
        console.log(`✓ Created product: ${saleData.name}`);
        productsCreated++;
      }

      // Create subproduct for this tenant
      const tenantPrefix = defaultTenant.slug.substring(0, 3).toUpperCase();
      const productPrefix = product.slug.substring(0, 5).toUpperCase();
      const randomSuffix = Math.floor(Math.random() * 900 + 100);
      const sku = `${tenantPrefix}-${productPrefix}-${randomSuffix}`;

      // Calculate prices
      const costPrice = Math.round(saleData.basePrice * 0.65); // 35% cost
      const saleDiscount = saleData.saleDiscount;
      const salePrice = Math.round(saleData.basePrice * (1 - saleDiscount / 100));

      // Check if subproduct exists
      let subProduct = await SubProduct.findOne({ 
        product: product._id,
        tenant: defaultTenant._id 
      });

      if (subProduct) {
        // Update existing subproduct with sale pricing
        subProduct.salePrice = salePrice;
        subProduct.saleStartDate = now;
        subProduct.saleEndDate = saleEndDate;
        subProduct.saleType = 'percentage';
        subProduct.saleDiscountValue = saleDiscount;
        subProduct.isOnSale = true;
        await subProduct.save();
        console.log(`  ✓ Updated subproduct with sale pricing (${saleDiscount}% OFF)`);
      } else {
        // Create new subproduct
        subProduct = await SubProduct.create({
          product: product._id,
          tenant: defaultTenant._id,
          sku,
          baseSellingPrice: saleData.basePrice,
          costPrice,
          currency: 'NGN',
          status: 'active',
          totalStock: 100,
          availableStock: 100,
          stockStatus: 'in_stock',
          
          // Sale pricing
          salePrice,
          saleStartDate: now,
          saleEndDate: saleEndDate,
          saleType: 'percentage',
          saleDiscountValue: saleDiscount,
          isOnSale: true,
        });
        console.log(`  ✓ Created subproduct with sale pricing (${saleDiscount}% OFF)`);
        subproductsCreated++;
      }

      // Create sizes for this subproduct
      for (let i = 0; i < saleData.sizes.length; i++) {
        const sizeData = saleData.sizes[i];
        
        const sizeSlug = sizeData.size.replace(/[^a-z0-9]/g, '');
        const sizeSku = `${subProduct.sku}-${sizeSlug.toUpperCase()}`;
        
        // Calculate size-specific prices
        const sizePrice = Math.round(saleData.basePrice * sizeData.multiplier);
        const sizeCostPrice = Math.round(costPrice * sizeData.multiplier);
        const compareAtPrice = Math.round(saleData.basePrice * sizeData.multiplier * 1.3); // 30% higher for comparison
        
        // Calculate volume in ml
        let volumeMl = saleData.volumeMl;
        if (sizeData.size.includes('cl')) {
          volumeMl = parseInt(sizeData.size) * 10;
        } else if (sizeData.size.includes('ml')) {
          const match = sizeData.size.match(/\d+/);
          volumeMl = match ? parseInt(match[0]) : volumeMl;
        }

        // Check if size exists
        let size = await Size.findOne({
          subproduct: subProduct._id,
          size: sizeData.size
        });

        if (size) {
          // Update existing size with sale pricing
          size.salePrice = sizePrice;
          size.compareAtPrice = compareAtPrice;
          size.saleStartDate = now;
          size.saleEndDate = saleEndDate;
          size.saleDiscount = saleDiscount;
          size.isOnSale = true;
          await size.save();
          console.log(`    ✓ Updated size: ${sizeData.size}`);
        } else {
          // Create new size
          size = await Size.create({
            subproduct: subProduct._id,
            size: sizeData.size,
            displayName: sizeData.displayName,
            sizeCategory: volumeMl < 100 ? 'miniature' :
                         volumeMl < 500 ? 'single_serve' :
                         volumeMl < 1000 ? 'standard' : 'large',
            unitType: 'volume_ml',
            volumeMl,
            sellingPrice: sizePrice,
            costPrice: sizeCostPrice,
            compareAtPrice,
            currency: 'NGN',
            stock: 50,
            availableStock: 50,
            lowStockThreshold: 10,
            availability: 'available',
            sku: sizeSku,
            isDefault: i === 0,
            status: 'active',
            requiresAgeVerification: true,
            
            // Sale pricing
            salePrice,
            saleStartDate: now,
            saleEndDate: saleEndDate,
            saleDiscount,
            isOnSale: true,
          });
          console.log(`    ✓ Created size: ${sizeData.size}`);
          sizesCreated++;
        }
        
        // Add size ID to subproduct's sizes array if not already there
        if (size && !subProduct.sizes.includes(size._id)) {
          subProduct.sizes.push(size._id);
          await subProduct.save();
        }
      }
      
      // Save subproduct to ensure sizes are linked
      if (subProduct && subProduct.sizes.length > 0) {
        await subProduct.save();
      }
    }
    
    // Update product references
    await Product.updateMany(
      { _id: { $in: await Product.find({}).select('_id') } },
      { $push: { subProducts: { $each: [] } } }
    );

    console.log('\n' + '='.repeat(50));
    console.log('✅ Sale Products Seed Complete!');
    console.log('='.repeat(50));
    console.log(`\n📊 Summary:`);
    console.log(`   New Products: ${productsCreated}`);
    console.log(`   Products Updated: ${productsUpdated}`);
    console.log(`   New SubProducts: ${subproductsCreated}`);
    console.log(`   New Sizes: ${sizesCreated}`);

    // Show products on sale
    const onSaleProducts = await SubProduct.find({ isOnSale: true })
      .populate('product', 'name type')
      .limit(10);

    console.log(`\n🛒 Products on Sale (${onSaleProducts.length}):`);
    console.log('─'.repeat(50));
    onSaleProducts.forEach(sp => {
      const discount = sp.saleDiscountValue || 0;
      const savings = sp.baseSellingPrice - (sp.salePrice || 0);
      console.log(`• ${sp.product?.name || 'Unknown'}`);
      console.log(`  ${discount}% OFF | Was ₦${sp.baseSellingPrice?.toLocaleString()} | Sale: ₦${sp.salePrice?.toLocaleString()}`);
    });

  } catch (error) {
    console.error('\n❌ Error seeding sale products:', error);
  } finally {
    await db.disconnectDB();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the seed
seedSaleProducts();
