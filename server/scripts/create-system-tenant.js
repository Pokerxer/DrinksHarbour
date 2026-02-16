// scripts/create-system-tenant.js

/**
 * Create System Tenant for Super Admin
 * 
 * This script creates a "Drinks Harbour" system tenant that the super admin
 * can use to create subproducts and sizes (which require a tenant ID).
 * 
 * Run: node scripts/create-system-tenant.js
 */

require('dotenv').config();

const mongoose = require('mongoose');

const User = require('../models/User');
const Tenant = require('../models/Tenant');

const SYSTEM_TENANT_DATA = {
  name: 'Drinks Harbour',
  slug: 'drinksharbour',
  isSystemTenant: true,
  status: 'approved',
  plan: 'enterprise',
  subscriptionStatus: 'active',
  defaultCurrency: 'NGN',
  supportedCurrencies: ['NGN', 'USD', 'EUR', 'GBP'],
  country: 'Nigeria',
  city: 'Lagos',
  state: 'Lagos',
  revenueModel: 'markup',
  markupPercentage: 0, // No markup - platform's own store
  commissionPercentage: 0,
  platformMarkupPercentage: 0,
  enforceAgeVerification: true,
  approvedAt: new Date(),
  onboardedAt: new Date(),
  notes: 'System tenant for DrinksHarbour platform - used by super admin for creating products and subproducts',
};

async function createSystemTenant() {
  console.log('\n🏪 Creating Drinks Harbour System Tenant...\n');

  try {
    // Connect to database
    const db = require('../config/db');
    await db.connectDB();
    console.log('✅ Connected to database\n');

    // Find super_admin user
    let superAdmin = await User.findOne({ role: 'super_admin' }).lean();
    
    if (!superAdmin) {
      console.log('❌ No super_admin user found. Please run the seed script first.');
      console.log('   Run: node scripts/seed.js');
      process.exit(1);
    }
    
    console.log(`📧 Found super_admin: ${superAdmin.email}`);

    // Check if system tenant already exists
    let systemTenant = await Tenant.findOne({ 
      $or: [
        { slug: 'drinksharbour' },
        { isSystemTenant: true }
      ]
    }).lean();

    if (systemTenant) {
      console.log(`\n⚠️  System tenant already exists:`);
      console.log(`   Name: ${systemTenant.name}`);
      console.log(`   Slug: ${systemTenant.slug}`);
      console.log(`   ID: ${systemTenant._id}`);
      
      // Update super_admin to link to this tenant if not already linked
      if (superAdmin.tenant?.toString() !== systemTenant._id.toString()) {
        await User.findByIdAndUpdate(superAdmin._id, {
          tenant: systemTenant._id,
          role: 'tenant_owner'
        });
        console.log(`\n✅ Updated super_admin to link to system tenant`);
      }
      
      console.log('\n✅ System tenant is ready!\n');
      process.exit(0);
    }

    // Create the system tenant
    console.log('📦 Creating system tenant...');
    
    systemTenant = await Tenant.create({
      ...SYSTEM_TENANT_DATA,
    });
    
    console.log(`\n✅ Created system tenant:`);
    console.log(`   Name: ${systemTenant.name}`);
    console.log(`   Slug: ${systemTenant.slug}`);
    console.log(`   ID: ${systemTenant._id}`);
    console.log(`   Plan: ${systemTenant.plan}`);
    console.log(`   Currency: ${systemTenant.defaultCurrency}`);

    // Update super_admin to link to this tenant
    await User.findByIdAndUpdate(superAdmin._id, {
      tenant: systemTenant._id,
      role: 'tenant_owner'
    });
    
    console.log(`\n✅ Linked super_admin to system tenant`);
    console.log(`   Super admin email: ${superAdmin.email}`);
    console.log(`   Role updated to: tenant_owner`);

    // Display summary
    console.log('\n' + '='.repeat(50));
    console.log('🎉 SYSTEM TENANT CREATION COMPLETE!');
    console.log('='.repeat(50));
    console.log('\n📋 Summary:');
    console.log(`   Tenant ID: ${systemTenant._id}`);
    console.log(`   Tenant Name: ${systemTenant.name}`);
    console.log(`   Tenant Slug: ${systemTenant.slug}`);
    console.log(`   Default Currency: ${systemTenant.defaultCurrency}`);
    console.log(`   Revenue Model: ${systemTenant.revenueModel} (${systemTenant.markupPercentage}% markup)`);
    console.log(`\n💡 The super admin can now create subproducts and sizes`);
    console.log(`   using this tenant ID.\n`);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error creating system tenant:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
createSystemTenant();
