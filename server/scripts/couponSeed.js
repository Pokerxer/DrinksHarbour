// scripts/CouponSeed.js

const mongoose = require('mongoose');
const Coupon = require('../models/Coupon');
const Product = require('../models/product');
const Category = require('../models/Category');
const Brand = require('../models/Brand');
const Tenant = require('../models/tenant');
const User = require('../models/User');
const db = require('../config/db');
require('dotenv').config();

// ============================================================
// COUPON DATA - REAL BEVERAGE INDUSTRY EXAMPLES
// ============================================================

const couponTemplates = [
  // ============================================================
  // PERCENTAGE DISCOUNT COUPONS
  // ============================================================
  {
    code: 'WELCOME10',
    name: 'Welcome Discount - 10% Off First Order',
    description: 'Get 10% off your first purchase of alcoholic beverages. New customers only!',
    discountType: 'percentage',
    discountValue: 10,
    maxDiscountAmount: 5000,
    currency: 'NGN',
    minimumPurchaseAmount: 10000,
    usageLimit: 1000,
    usageLimitPerUser: 1,
    startDate: new Date(),
    endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
    status: 'active',
    isActive: true,
    applicableTo: 'all',
    isGlobal: true,
    firstPurchaseOnly: true,
    canCombineWithOtherCoupons: false,
    canCombineWithSales: true,
    autoApply: false,
    tags: ['new-customer', 'welcome', 'discount'],
    internalNotes: 'New customer acquisition campaign',
  },

  {
    code: 'SAVE15',
    name: '15% Off All Premium Spirits',
    description: 'Save 15% on whiskey, cognac, vodka, and other premium spirits. Limited time offer!',
    discountType: 'percentage',
    discountValue: 15,
    maxDiscountAmount: 10000,
    currency: 'NGN',
    minimumPurchaseAmount: 20000,
    usageLimit: 500,
    usageLimitPerUser: 2,
    startDate: new Date(),
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    status: 'active',
    isActive: true,
    applicableTo: 'specific_categories',
    isGlobal: true,
    canCombineWithOtherCoupons: false,
    canCombineWithSales: false,
    autoApply: false,
    priority: 5,
    tags: ['spirits', 'premium', 'limited-time'],
    internalNotes: 'Premium spirits promotion - Q1 2026',
  },

  {
    code: 'WEEKEND20',
    name: 'Weekend Special - 20% Off',
    description: 'Enjoy 20% off all beverages on weekends. Friday to Sunday only!',
    discountType: 'percentage',
    discountValue: 20,
    maxDiscountAmount: 8000,
    currency: 'NGN',
    minimumPurchaseAmount: 15000,
    usageLimit: null, // Unlimited
    usageLimitPerUser: 5,
    startDate: new Date(),
    endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
    status: 'active',
    isActive: true,
    applicableTo: 'all',
    isGlobal: true,
    canCombineWithOtherCoupons: false,
    canCombineWithSales: true,
    autoApply: false,
    tags: ['weekend', 'flash-sale', 'discount'],
    internalNotes: 'Weekend traffic driver',
  },

  {
    code: 'WINE25',
    name: '25% Off All Wines',
    description: 'Premium wines at 25% discount. Red, white, rosé, and sparkling wines included.',
    discountType: 'percentage',
    discountValue: 25,
    maxDiscountAmount: 15000,
    currency: 'NGN',
    minimumPurchaseAmount: 25000,
    usageLimit: 300,
    usageLimitPerUser: 1,
    startDate: new Date(),
    endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
    status: 'active',
    isActive: true,
    applicableTo: 'specific_categories',
    isGlobal: true,
    canCombineWithOtherCoupons: false,
    canCombineWithSales: false,
    autoApply: false,
    priority: 7,
    tags: ['wine', 'promotion', 'limited-offer'],
    internalNotes: 'Wine appreciation week promotion',
  },

  // ============================================================
  // FIXED AMOUNT DISCOUNT COUPONS
  // ============================================================
  {
    code: 'SAVE5000',
    name: '₦5,000 Off Your Order',
    description: 'Get ₦5,000 off when you spend ₦50,000 or more on premium beverages.',
    discountType: 'fixed_amount',
    discountValue: 5000,
    currency: 'NGN',
    minimumPurchaseAmount: 50000,
    usageLimit: 200,
    usageLimitPerUser: 1,
    startDate: new Date(),
    endDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000), // 45 days
    status: 'active',
    isActive: true,
    applicableTo: 'all',
    isGlobal: true,
    canCombineWithOtherCoupons: false,
    canCombineWithSales: true,
    autoApply: false,
    tags: ['fixed-discount', 'big-order'],
    internalNotes: 'Encourage larger basket sizes',
  },

  {
    code: 'FLAT3000',
    name: 'Flat ₦3,000 Discount',
    description: 'Enjoy a flat ₦3,000 discount on orders above ₦30,000. All beverages included!',
    discountType: 'fixed_amount',
    discountValue: 3000,
    currency: 'NGN',
    minimumPurchaseAmount: 30000,
    usageLimit: 400,
    usageLimitPerUser: 2,
    startDate: new Date(),
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    status: 'active',
    isActive: true,
    applicableTo: 'all',
    isGlobal: true,
    canCombineWithOtherCoupons: false,
    canCombineWithSales: true,
    autoApply: false,
    tags: ['fixed-discount', 'general'],
    internalNotes: 'General promotion for mid-range orders',
  },

  {
    code: 'CRAFTBEER2000',
    name: '₦2,000 Off Craft Beer Orders',
    description: 'Save ₦2,000 on craft beer purchases. Support local breweries!',
    discountType: 'fixed_amount',
    discountValue: 2000,
    currency: 'NGN',
    minimumPurchaseAmount: 15000,
    usageLimit: 150,
    usageLimitPerUser: 3,
    startDate: new Date(),
    endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
    status: 'active',
    isActive: true,
    applicableTo: 'specific_categories',
    isGlobal: true,
    canCombineWithOtherCoupons: false,
    canCombineWithSales: true,
    autoApply: false,
    tags: ['craft-beer', 'local'],
    internalNotes: 'Craft beer promotion',
  },

  // ============================================================
  // FREE SHIPPING COUPONS
  // ============================================================
  {
    code: 'FREESHIP',
    name: 'Free Shipping on All Orders',
    description: 'Get free shipping on orders over ₦20,000. No delivery fees!',
    discountType: 'free_shipping',
    currency: 'NGN',
    minimumPurchaseAmount: 20000,
    usageLimit: null, // Unlimited
    usageLimitPerUser: 10,
    startDate: new Date(),
    endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
    status: 'active',
    isActive: true,
    applicableTo: 'all',
    isGlobal: true,
    canCombineWithOtherCoupons: true,
    canCombineWithSales: true,
    autoApply: false,
    tags: ['free-shipping', 'logistics'],
    internalNotes: 'Free shipping promotion to increase conversions',
  },

  {
    code: 'SHIPFREE30',
    name: 'Free Delivery Above ₦30,000',
    description: 'No delivery charges on premium orders. Spend ₦30,000 and get free shipping!',
    discountType: 'free_shipping',
    currency: 'NGN',
    minimumPurchaseAmount: 30000,
    usageLimit: null,
    usageLimitPerUser: 5,
    startDate: new Date(),
    endDate: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000), // 120 days
    status: 'active',
    isActive: true,
    applicableTo: 'all',
    isGlobal: true,
    canCombineWithOtherCoupons: true,
    canCombineWithSales: true,
    autoApply: true,
    priority: 3,
    tags: ['free-shipping', 'auto-apply'],
    internalNotes: 'Auto-applied free shipping for premium orders',
  },

  // ============================================================
  // SEASONAL & HOLIDAY COUPONS
  // ============================================================
  {
    code: 'NEWYEAR2026',
    name: 'New Year Celebration - 30% Off',
    description: 'Ring in 2026 with 30% off champagne and sparkling wines. Celebrate in style!',
    discountType: 'percentage',
    discountValue: 30,
    maxDiscountAmount: 20000,
    currency: 'NGN',
    minimumPurchaseAmount: 30000,
    usageLimit: 100,
    usageLimitPerUser: 1,
    startDate: new Date('2026-12-26'),
    endDate: new Date('2027-01-05'),
    status: 'scheduled',
    isActive: true,
    applicableTo: 'specific_categories',
    isGlobal: true,
    canCombineWithOtherCoupons: false,
    canCombineWithSales: false,
    autoApply: false,
    priority: 10,
    tags: ['holiday', 'new-year', 'champagne', 'seasonal'],
    internalNotes: 'New Year 2026 promotion',
  },

  {
    code: 'VALENTINE20',
    name: "Valentine's Day Special - 20% Off Wine",
    description: 'Perfect wines for a romantic evening. 20% off all wines for Valentine\'s Day.',
    discountType: 'percentage',
    discountValue: 20,
    maxDiscountAmount: 12000,
    currency: 'NGN',
    minimumPurchaseAmount: 20000,
    usageLimit: 200,
    usageLimitPerUser: 1,
    startDate: new Date('2026-02-10'),
    endDate: new Date('2026-02-16'),
    status: 'scheduled',
    isActive: true,
    applicableTo: 'specific_categories',
    isGlobal: true,
    canCombineWithOtherCoupons: false,
    canCombineWithSales: false,
    autoApply: false,
    tags: ['valentine', 'wine', 'seasonal', 'romantic'],
    internalNotes: 'Valentine\'s Day 2026 campaign',
  },

  {
    code: 'BLACKFRIDAY50',
    name: 'Black Friday Mega Sale - 50% Off',
    description: 'Biggest sale of the year! 50% off on selected beverages. Don\'t miss out!',
    discountType: 'percentage',
    discountValue: 50,
    maxDiscountAmount: 30000,
    currency: 'NGN',
    minimumPurchaseAmount: 50000,
    usageLimit: 50,
    usageLimitPerUser: 1,
    startDate: new Date('2026-11-27'),
    endDate: new Date('2026-11-30'),
    status: 'scheduled',
    isActive: true,
    applicableTo: 'all',
    isGlobal: true,
    canCombineWithOtherCoupons: false,
    canCombineWithSales: false,
    autoApply: false,
    priority: 10,
    tags: ['black-friday', 'mega-sale', 'seasonal'],
    internalNotes: 'Black Friday 2026 - Limited quantity',
  },

  // ============================================================
  // BRAND-SPECIFIC COUPONS
  // ============================================================
  {
    code: 'HENNESSY15',
    name: '15% Off Hennessy Cognac',
    description: 'Premium Hennessy cognac at 15% discount. VSOP, XO, and more!',
    discountType: 'percentage',
    discountValue: 15,
    maxDiscountAmount: 12000,
    currency: 'NGN',
    minimumPurchaseAmount: 25000,
    usageLimit: 100,
    usageLimitPerUser: 2,
    startDate: new Date(),
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    status: 'active',
    isActive: true,
    applicableTo: 'specific_brands',
    isGlobal: true,
    canCombineWithOtherCoupons: false,
    canCombineWithSales: false,
    autoApply: false,
    tags: ['hennessy', 'cognac', 'brand-specific'],
    internalNotes: 'Hennessy brand promotion',
  },

  {
    code: 'GUINNESS10',
    name: '10% Off Guinness Products',
    description: 'The legendary Irish stout at a discount. 10% off all Guinness products.',
    discountType: 'percentage',
    discountValue: 10,
    maxDiscountAmount: 4000,
    currency: 'NGN',
    minimumPurchaseAmount: 10000,
    usageLimit: 300,
    usageLimitPerUser: 3,
    startDate: new Date(),
    endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
    status: 'active',
    isActive: true,
    applicableTo: 'specific_brands',
    isGlobal: true,
    canCombineWithOtherCoupons: false,
    canCombineWithSales: true,
    autoApply: false,
    tags: ['guinness', 'beer', 'brand-specific'],
    internalNotes: 'Guinness partnership promotion',
  },

  // ============================================================
  // VIP & LOYALTY COUPONS
  // ============================================================
  {
    code: 'VIP25',
    name: 'VIP Exclusive - 25% Off',
    description: 'Exclusive discount for our VIP members. 25% off all premium beverages.',
    discountType: 'percentage',
    discountValue: 25,
    maxDiscountAmount: 20000,
    currency: 'NGN',
    minimumPurchaseAmount: 40000,
    usageLimit: null,
    usageLimitPerUser: 5,
    startDate: new Date(),
    endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
    status: 'active',
    isActive: true,
    applicableTo: 'all',
    isGlobal: true,
    allowedUserRoles: ['vip'],
    canCombineWithOtherCoupons: false,
    canCombineWithSales: false,
    autoApply: true,
    priority: 8,
    tags: ['vip', 'loyalty', 'exclusive'],
    internalNotes: 'VIP customer retention program',
  },

  {
    code: 'LOYAL5000',
    name: 'Loyalty Reward - ₦5,000 Off',
    description: 'Thank you for being a loyal customer! Enjoy ₦5,000 off your next order.',
    discountType: 'fixed_amount',
    discountValue: 5000,
    currency: 'NGN',
    minimumPurchaseAmount: 35000,
    usageLimit: null,
    usageLimitPerUser: 1,
    minimumAccountAge: 90, // Account must be 90+ days old
    startDate: new Date(),
    endDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
    status: 'active',
    isActive: true,
    applicableTo: 'all',
    isGlobal: true,
    canCombineWithOtherCoupons: false,
    canCombineWithSales: true,
    autoApply: false,
    tags: ['loyalty', 'reward', 'retention'],
    internalNotes: 'Loyalty reward for customers 90+ days old',
  },

  // ============================================================
  // BUNDLE & CATEGORY-SPECIFIC COUPONS
  // ============================================================
  {
    code: 'PARTY20',
    name: 'Party Pack Discount - 20% Off',
    description: 'Planning a party? Get 20% off when you buy 12 or more bottles!',
    discountType: 'percentage',
    discountValue: 20,
    maxDiscountAmount: 15000,
    currency: 'NGN',
    minimumPurchaseAmount: 40000,
    minimumItems: 12,
    usageLimit: 150,
    usageLimitPerUser: 2,
    startDate: new Date(),
    endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
    status: 'active',
    isActive: true,
    applicableTo: 'all',
    isGlobal: true,
    canCombineWithOtherCoupons: false,
    canCombineWithSales: true,
    autoApply: false,
    tags: ['party', 'bulk', 'bundle'],
    internalNotes: 'Bulk purchase incentive',
  },

  {
    code: 'SPIRITS30',
    name: 'Premium Spirits Bundle - 30% Off',
    description: 'Mix and match premium spirits and save 30%. Minimum 3 bottles required.',
    discountType: 'percentage',
    discountValue: 30,
    maxDiscountAmount: 18000,
    currency: 'NGN',
    minimumPurchaseAmount: 45000,
    minimumItems: 3,
    usageLimit: 80,
    usageLimitPerUser: 1,
    startDate: new Date(),
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    status: 'active',
    isActive: true,
    applicableTo: 'specific_categories',
    isGlobal: true,
    canCombineWithOtherCoupons: false,
    canCombineWithSales: false,
    autoApply: false,
    tags: ['spirits', 'bundle', 'premium'],
    internalNotes: 'Premium spirits bundle promotion',
  },

  // ============================================================
  // FLASH & LIMITED TIME COUPONS
  // ============================================================
  {
    code: 'FLASH40',
    name: 'Flash Sale - 40% Off (24 Hours Only)',
    description: 'Lightning deal! 40% off for the next 24 hours. Hurry while stocks last!',
    discountType: 'percentage',
    discountValue: 40,
    maxDiscountAmount: 25000,
    currency: 'NGN',
    minimumPurchaseAmount: 35000,
    usageLimit: 50,
    usageLimitPerUser: 1,
    startDate: new Date(),
    endDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // 24 hours
    status: 'active',
    isActive: true,
    applicableTo: 'all',
    isGlobal: true,
    canCombineWithOtherCoupons: false,
    canCombineWithSales: false,
    autoApply: false,
    priority: 9,
    tags: ['flash-sale', 'limited-time', 'urgent'],
    internalNotes: 'Flash sale - 24 hours only',
  },

  {
    code: 'EARLYBIRD',
    name: 'Early Bird Special - 35% Off',
    description: 'Shop early and save! 35% off orders placed before 12 PM.',
    discountType: 'percentage',
    discountValue: 35,
    maxDiscountAmount: 15000,
    currency: 'NGN',
    minimumPurchaseAmount: 25000,
    usageLimit: 100,
    usageLimitPerUser: 3,
    startDate: new Date(),
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    status: 'active',
    isActive: true,
    applicableTo: 'all',
    isGlobal: true,
    canCombineWithOtherCoupons: false,
    canCombineWithSales: true,
    autoApply: false,
    tags: ['early-bird', 'time-based'],
    internalNotes: 'Early morning shopping incentive',
  },

  // ============================================================
  // REFERRAL COUPONS
  // ============================================================
  {
    code: 'REFER5000',
    name: 'Referral Bonus - ₦5,000 Off',
    description: 'Referred by a friend? Enjoy ₦5,000 off your first order!',
    discountType: 'fixed_amount',
    discountValue: 5000,
    currency: 'NGN',
    minimumPurchaseAmount: 30000,
    usageLimit: null,
    usageLimitPerUser: 1,
    startDate: new Date(),
    endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    status: 'active',
    isActive: true,
    applicableTo: 'all',
    isGlobal: true,
    firstPurchaseOnly: true,
    isReferralCoupon: true,
    referralReward: 2500, // Referrer gets ₦2,500
    canCombineWithOtherCoupons: false,
    canCombineWithSales: true,
    autoApply: false,
    tags: ['referral', 'acquisition'],
    internalNotes: 'Referral program - both parties benefit',
  },
];

// ============================================================
// SEED FUNCTION
// ============================================================

async function seedCoupons() {
  try {
    console.log('🎟️  Starting Coupon Seeding...\n');
    console.log('═══════════════════════════════════════════════════════');

    // Connect to database
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is not set.');
    }

    console.log('📡 Connecting to MongoDB...');
    await db.connectDB();
    console.log('✓ Connected to database\n');

    // Clear existing coupons if reset flag is present
    if (process.argv.includes('--reset')) {
      console.log('🗑️  Clearing existing coupons...');
      await Coupon.deleteMany({});
      console.log('✓ Existing coupons cleared\n');
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
      Category.find({}).limit(20).lean(),
      Brand.find({}).limit(20).lean(),
      Product.find({ status: 'approved' }).limit(50).lean(),
      Tenant.find({ status: 'approved' }).limit(5).lean(),
      User.findOne({ role: 'super_admin' }).lean(),
    ]);

    console.log(`✓ Found ${categories.length} categories`);
    console.log(`✓ Found ${brands.length} brands`);
    console.log(`✓ Found ${products.length} products`);
    console.log(`✓ Found ${tenants.length} tenants\n`);

    // Create coupons
    console.log('🎟️  Creating coupons...\n');

    const createdCoupons = [];
    let successCount = 0;
    let errorCount = 0;

    for (const template of couponTemplates) {
      try {
        const couponData = { ...template };

        // Set creator
        if (superAdmin) {
          couponData.createdBy = superAdmin._id;
          couponData.updatedBy = superAdmin._id;
        }

        // Assign category references for category-specific coupons
        if (template.applicableTo === 'specific_categories') {
          // Match categories based on coupon intent
          if (template.name.toLowerCase().includes('wine')) {
            const wineCategories = categories.filter(cat => 
              cat.name.toLowerCase().includes('wine')
            );
            if (wineCategories.length > 0) {
              couponData.includedCategories = wineCategories.map(c => c._id);
            }
          } else if (template.name.toLowerCase().includes('spirit') || 
                     template.name.toLowerCase().includes('whiskey') ||
                     template.name.toLowerCase().includes('cognac') ||
                     template.name.toLowerCase().includes('vodka')) {
            const spiritCategories = categories.filter(cat => 
              cat.type === 'alcoholic' && 
              !cat.name.toLowerCase().includes('wine') &&
              !cat.name.toLowerCase().includes('beer')
            );
            if (spiritCategories.length > 0) {
              couponData.includedCategories = spiritCategories.map(c => c._id);
            }
          } else if (template.name.toLowerCase().includes('beer') || 
                     template.name.toLowerCase().includes('craft')) {
            const beerCategories = categories.filter(cat => 
              cat.name.toLowerCase().includes('beer')
            );
            if (beerCategories.length > 0) {
              couponData.includedCategories = beerCategories.map(c => c._id);
            }
          } else if (template.name.toLowerCase().includes('champagne')) {
            const champagneCategories = categories.filter(cat => 
              cat.name.toLowerCase().includes('champagne') ||
              cat.name.toLowerCase().includes('sparkling')
            );
            if (champagneCategories.length > 0) {
              couponData.includedCategories = champagneCategories.map(c => c._id);
            }
          }
        }

        // Assign brand references for brand-specific coupons
        if (template.applicableTo === 'specific_brands') {
          if (template.name.toLowerCase().includes('hennessy')) {
            const hennessyBrand = brands.find(b => 
              b.name.toLowerCase().includes('hennessy')
            );
            if (hennessyBrand) {
              couponData.includedBrands = [hennessyBrand._id];
            }
          } else if (template.name.toLowerCase().includes('guinness')) {
            const guinnessBrand = brands.find(b => 
              b.name.toLowerCase().includes('guinness')
            );
            if (guinnessBrand) {
              couponData.includedBrands = [guinnessBrand._id];
            }
          }
        }

        // Assign random tenant for some tenant-specific coupons (10% chance)
        if (Math.random() < 0.1 && tenants.length > 0) {
          couponData.tenant = tenants[Math.floor(Math.random() * tenants.length)]._id;
          couponData.isGlobal = false;
        }

        // Create coupon
        const coupon = await Coupon.create(couponData);
        createdCoupons.push(coupon);
        successCount++;

        const expiryDays = Math.ceil((new Date(coupon.endDate) - new Date()) / (1000 * 60 * 60 * 24));
        console.log(`✓ Created: ${coupon.code}`);
        console.log(`  Name: ${coupon.name}`);
        console.log(`  Type: ${coupon.discountType} | Value: ${coupon.discountValue}${coupon.discountType === 'percentage' ? '%' : ''}`);
        console.log(`  Status: ${coupon.status} | Expires in: ${expiryDays} days`);
        console.log('');

      } catch (error) {
        errorCount++;
        console.error(`✗ Failed to create: ${template.code}`);
        console.error(`  Error: ${error.message}\n`);
      }
    }

    // Summary
    console.log('═══════════════════════════════════════════════════════');
    console.log('✅ COUPON SEEDING COMPLETED!\n');
    console.log('📊 Summary:');
    console.log(`   • Total Templates: ${couponTemplates.length}`);
    console.log(`   • Successfully Created: ${successCount}`);
    console.log(`   • Errors: ${errorCount}`);
    console.log(`   • Active Coupons: ${createdCoupons.filter(c => c.status === 'active').length}`);
    console.log(`   • Scheduled Coupons: ${createdCoupons.filter(c => c.status === 'scheduled').length}`);

    // Breakdown by type
    console.log('\n💰 Breakdown by Discount Type:');
    const typeGroups = createdCoupons.reduce((acc, coupon) => {
      acc[coupon.discountType] = (acc[coupon.discountType] || 0) + 1;
      return acc;
    }, {});

    Object.entries(typeGroups).forEach(([type, count]) => {
      console.log(`   • ${type}: ${count}`);
    });

    // Breakdown by applicability
    console.log('\n🎯 Breakdown by Applicability:');
    const applicabilityGroups = createdCoupons.reduce((acc, coupon) => {
      acc[coupon.applicableTo] = (acc[coupon.applicableTo] || 0) + 1;
      return acc;
    }, {});

    Object.entries(applicabilityGroups).forEach(([type, count]) => {
      console.log(`   • ${type}: ${count}`);
    });

    // Most generous coupons
    console.log('\n🎁 Most Generous Coupons:');
    const percentageCoupons = createdCoupons
      .filter(c => c.discountType === 'percentage')
      .sort((a, b) => b.discountValue - a.discountValue)
      .slice(0, 3);

    percentageCoupons.forEach((coupon, index) => {
      console.log(`   ${index + 1}. ${coupon.code} - ${coupon.discountValue}% off (${coupon.name})`);
    });

    // Expiring soon
    console.log('\n⏰ Expiring Soon (Next 7 Days):');
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    const expiringSoon = createdCoupons.filter(c => 
      c.endDate >= now && c.endDate <= sevenDaysFromNow
    );

    if (expiringSoon.length > 0) {
      expiringSoon.forEach(coupon => {
        const daysLeft = Math.ceil((coupon.endDate - now) / (1000 * 60 * 60 * 24));
        console.log(`   • ${coupon.code} - ${daysLeft} day${daysLeft > 1 ? 's' : ''} left`);
      });
    } else {
      console.log('   • None');
    }

    console.log('\n💡 Usage Tips:');
    console.log('   • Validate coupon: POST /api/coupons/validate');
    console.log('   • Apply coupon: POST /api/coupons/apply');
    console.log('   • Get active coupons: GET /api/coupons/customer/active');
    console.log('   • Check eligibility: GET /api/coupons/:code/can-use');
    console.log('   • Admin panel: GET /api/coupons');

    console.log('\n🔐 Sample Coupon Codes to Try:');
    console.log('   • WELCOME10 - 10% off first order');
    console.log('   • SAVE15 - 15% off premium spirits');
    console.log('   • FREESHIP - Free shipping over ₦20,000');
    console.log('   • PARTY20 - 20% off bulk orders (12+ items)');
    console.log('   • VIP25 - 25% off for VIP members');
    console.log('═══════════════════════════════════════════════════════\n');

    await db.disconnectDB();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Coupon seeding failed:', error.message);
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
  seedCoupons();
}

module.exports = seedCoupons;