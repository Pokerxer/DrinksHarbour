'use strict';

const ERM_PLANS = {
  free_trial: {
    label: 'Free Trial',
    priceMonthly: 0,
    skuLimit: 50,
    staffLimit: 1,
    commissionRate: 0.13,
    paystackPlanCode: null,
    features: ['inventory', 'orders', 'pos_single'],
    addOnsAllowed: false,
  },
  starter: {
    label: 'Starter',
    priceMonthly: 15000,
    skuLimit: 100,
    staffLimit: 1,
    commissionRate: 0.13,
    paystackPlanCode: process.env.PAYSTACK_PLAN_STARTER,
    features: ['inventory', 'orders', 'pos_single', 'sales_invoicing'],
    addOnsAllowed: false,
  },
  growth: {
    label: 'Growth',
    priceMonthly: 35000,
    skuLimit: 500,
    staffLimit: 3,
    commissionRate: 0.11,
    paystackPlanCode: process.env.PAYSTACK_PLAN_GROWTH,
    features: ['inventory', 'orders', 'pos_single', 'sales_invoicing', 'crm_basic', 'purchase_orders'],
    addOnsAllowed: false,
  },
  pro: {
    label: 'Pro',
    priceMonthly: 65000,
    skuLimit: 2000,
    staffLimit: 10,
    commissionRate: 0.10,
    paystackPlanCode: process.env.PAYSTACK_PLAN_PRO,
    features: ['inventory', 'orders', 'pos_multi', 'sales_invoicing', 'crm_basic', 'purchase_orders', 'multi_location', 'advanced_reports', 'api_access'],
    addOnsAllowed: true,
  },
  enterprise: {
    label: 'Enterprise',
    priceMonthly: 85000,
    skuLimit: Infinity,
    staffLimit: Infinity,
    commissionRate: 0.09,
    paystackPlanCode: process.env.PAYSTACK_PLAN_ENTERPRISE,
    features: ['inventory', 'orders', 'pos_multi', 'sales_invoicing', 'crm_advanced', 'purchase_orders', 'multi_location', 'advanced_reports', 'api_access', 'custom_integrations', 'priority_support'],
    addOnsAllowed: true,
  },
  venue: {
    label: 'Venue',
    priceMonthly: 150000,
    skuLimit: Infinity,
    staffLimit: Infinity,
    commissionRate: 0.09,
    paystackPlanCode: process.env.PAYSTACK_PLAN_VENUE,
    features: ['inventory', 'orders', 'pos_realtime', 'sales_invoicing', 'crm_advanced', 'purchase_orders', 'multi_location', 'advanced_reports', 'api_access', 'table_management', 'guest_crm', 'event_booking', 'bar_inventory'],
    addOnsAllowed: true,
  },
};

const PLAN_ORDER = ['free_trial', 'starter', 'growth', 'pro', 'enterprise', 'venue'];

const ADD_ON_PRICES = {
  extra_shop: 12000,
  extra_warehouse: 20000,
};

function getPlanConfig(planKey) {
  return ERM_PLANS[planKey] ?? ERM_PLANS.free_trial;
}

function getCommissionRate(planKey) {
  return getPlanConfig(planKey).commissionRate;
}

function isPlanAtLeast(tenantPlan, minPlan) {
  return PLAN_ORDER.indexOf(tenantPlan) >= PLAN_ORDER.indexOf(minPlan);
}

module.exports = { ERM_PLANS, PLAN_ORDER, ADD_ON_PRICES, getPlanConfig, getCommissionRate, isPlanAtLeast };
