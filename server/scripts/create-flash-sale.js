// create-flash-sale.js
// Run with: node scripts/create-flash-sale.js

require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/drinksharbour';

const saleSchema = new mongoose.Schema({
  name: String,
  description: String,
  type: String,
  discountType: String,
  discountValue: Number,
  maximumDiscount: Number,
  minimumOrderValue: Number,
  startDate: Date,
  endDate: Date,
  status: String,
  isActive: Boolean,
  products: [mongoose.Schema.Types.ObjectId],
  categories: [mongoose.Schema.Types.ObjectId],
  bannerImage: {
    url: String,
    alt: String,
  },
  displaySettings: {
    showOnHomepage: Boolean,
    homepagePosition: Number,
    cardStyle: String,
  },
  currentUsageCount: Number,
  viewCount: Number,
  conversionCount: Number,
  totalRevenue: Number,
  isGlobal: Boolean,
}, { timestamps: true });

const Sale = mongoose.model('Sale', saleSchema);

(async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get products to include in the sale
    const Product = mongoose.model('Product', new mongoose.Schema({ name: String }));
    const products = await Product.find({}).limit(5);
    const productIds = products.map(p => p._id);

    const now = new Date();
    const endDate = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // 3 days

    // Create a flash sale
    const flashSale = new Sale({
      name: 'Flash Sale - Premium Spirits',
      description: 'Limited time offer on premium spirits and wines. Up to 30% OFF!',
      type: 'flash_sale',
      discountType: 'percentage',
      discountValue: 30,
      maximumDiscount: 5000,
      minimumOrderValue: 5000,
      startDate: now,
      endDate: endDate,
      status: 'active',
      isActive: true,
      products: productIds,
      categories: [],
      bannerImage: {
        url: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=1200',
        alt: 'Flash Sale on Premium Drinks',
      },
      displaySettings: {
        showOnHomepage: true,
        homepagePosition: 1,
        cardStyle: 'featured',
      },
      currentUsageCount: 0,
      viewCount: 0,
      conversionCount: 0,
      totalRevenue: 0,
      isGlobal: true,
    });

    await flashSale.save();

    console.log('\n✅ Flash Sale created successfully!');
    console.log(`\n📅 Sale Details:`);
    console.log(`   Name: ${flashSale.name}`);
    console.log(`   Discount: ${flashSale.discountValue}% OFF`);
    console.log(`   Starts: ${now.toLocaleDateString()}`);
    console.log(`   Ends: ${endDate.toLocaleDateString()}`);
    console.log(`   Products included: ${productIds.length}`);

    // Show all active sales
    const activeSales = await Sale.find({ isActive: true, status: 'active' });
    console.log(`\n📢 Active Sales (${activeSales.length}):`);
    activeSales.forEach(sale => {
      console.log(`   • ${sale.name} - ${sale.discountValue}% OFF (${sale.type})`);
    });

  } catch (error) {
    console.error('Error creating flash sale:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
})();
