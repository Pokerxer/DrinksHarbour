import { routes } from '@/config/routes';
import {
  PiAddressBookDuotone,
  PiArrowsDownUpDuotone,
  PiArrowUUpLeftDuotone,
  PiBuildingsDuotone,
  PiCashRegisterDuotone,
  PiChartBarDuotone,
  PiChartLineUpDuotone,
  PiChatCircleDotsDuotone,
  PiClipboardTextDuotone,
  PiFilesDuotone,
  PiFileTextDuotone,
  PiGearDuotone,
  PiImageDuotone,
  PiInvoiceDuotone,
  PiListBulletsDuotone,
  PiNewspaperClippingDuotone,
  PiPackageDuotone,
  PiReceiptDuotone,
  PiScalesDuotone,
  PiShieldCheckDuotone,
  PiShoppingCartDuotone,
  PiSlidersDuotone,
  PiStarDuotone,
  PiStorefrontDuotone,
  PiTagDuotone,
  PiTruckDuotone,
  PiUserGearDuotone,
  PiUsersThreeDuotone,
  PiWarehouseDuotone,
} from 'react-icons/pi';

// Platform (super admin) sidebar.
//
// ── Scope, and why the order matters ────────────────────────────────────────
// Two different kinds of data live in this menu and they are NOT interchangeable:
//
//   Catalog / Storefront / Administration — platform-wide. Products, categories,
//     brands and tenants are shared across every tenant on the platform.
//
//   "Your Store" — tenant-owned. Point of sale, sales, purchases, inventory and
//     warehouses belong to exactly one tenant, and the server pins them to the
//     caller's own tenant (requireOwnTenant). A platform admin who owns a tenant
//     — admin@drinksharbour.com owns Wyn City — sees *their* store here, never
//     another tenant's. That is why those five sit contiguously under one label
//     instead of being scattered: the label is the only thing telling an admin
//     that "Inventory" means their own stock, not platform-wide stock.
//
// ── Conventions ─────────────────────────────────────────────────────────────
// Sections are entries with a `name` and no `href`; never give a section an href.
// `platformOnly: true` hides an entry from non-platform-admin users who still
// land on this sidebar, on both top-level entries and dropdown children.
//
// Every href points at a route that exists. A few use literal paths on purpose
// because the matching `routes` entry points somewhere else (noted inline).
export const menuItems = [
  // ─── Overview ───────────────────────────────────────────────
  {
    name: 'Overview',
  },
  {
    name: 'Dashboard',
    href: routes.eCommerce.dashboard,
    icon: <PiStorefrontDuotone />,
  },
  {
    name: 'Analytics',
    href: routes.analytics,
    icon: <PiChartBarDuotone />,
  },
  {
    name: 'Store Analytics',
    href: routes.storeAnalytics.dashboard,
    icon: <PiChartLineUpDuotone />,
    badge: 'NEW',
  },

  // ─── Catalog (platform-wide) ────────────────────────────────
  {
    name: 'Catalog',
  },
  {
    name: 'Products',
    href: '#',
    icon: <PiListBulletsDuotone />,
    dropdownItems: [
      { name: 'All Products', href: routes.eCommerce.products },
      { name: 'Add Product', href: routes.eCommerce.createProduct },
      { name: 'Sub-Products', href: routes.eCommerce.subProducts },
      { name: 'Add Sub-Product', href: routes.eCommerce.createSubProduct },
    ],
  },
  {
    name: 'Categories',
    href: '#',
    icon: <PiTagDuotone />,
    dropdownItems: [
      { name: 'All Categories', href: routes.eCommerce.categories },
      { name: 'Add Category', href: routes.eCommerce.createCategory },
      { name: 'Sub-categories', href: routes.eCommerce.subCategories },
      { name: 'Add Sub-category', href: routes.eCommerce.createSubCategory },
    ],
  },
  {
    name: 'Brands',
    href: '#',
    icon: <PiFilesDuotone />,
    dropdownItems: [
      { name: 'All Brands', href: routes.eCommerce.brands },
      { name: 'Add Brand', href: routes.eCommerce.createBrand },
    ],
  },

  // ─── Your Store (tenant-owned — see the scope note above) ───
  {
    name: 'Your Store',
  },
  {
    name: 'Point of Sale',
    href: '#',
    icon: <PiCashRegisterDuotone />,
    badge: 'POS',
    dropdownItems: [
      { name: 'Dashboard', href: routes.pos.index },
      { name: 'Sell', href: routes.pos.sell },
      { name: 'Orders', href: routes.pos.orders },
      { name: 'Order History', href: routes.pos.history },
      { name: 'Order Analysis', href: routes.pos.orderAnalysis },
      { name: 'Sessions', href: routes.pos.sessions },
      { name: 'Session Report', href: routes.pos.sessionReport },
      { name: 'Sales Details', href: routes.pos.salesDetails },
      // routes.pos.pricelists is the standalone cashier app (/pos/pricelists);
      // the back-office page is the /point-of-sale one.
      { name: 'Pricelists', href: '/point-of-sale/pricelists' },
      { name: 'Combos', href: routes.pos.combos },
      { name: 'Loyalty', href: routes.pos.loyalty },
      // routes.pos.settings points at a settings anchor that no longer holds
      // the POS section; the real page is /point-of-sale/settings.
      { name: 'POS Settings', href: '/point-of-sale/settings' },
    ],
  },
  {
    name: 'Sales',
    href: '#',
    icon: <PiFileTextDuotone />,
    dropdownItems: [
      { name: 'Overview', href: routes.eCommerce.sales },
      { name: 'Quotations', href: routes.eCommerce.salesQuotations },
      { name: 'Orders', href: routes.eCommerce.salesOrders },
      { name: 'New Sale', href: routes.eCommerce.createSale },
      { name: 'Fulfillment', href: routes.eCommerce.salesFulfillList },
      { name: 'Returns', href: routes.eCommerce.salesReturns },
    ],
  },
  {
    name: 'Purchase Orders',
    href: '#',
    icon: <PiShoppingCartDuotone />,
    dropdownItems: [
      { name: 'All Orders', href: routes.eCommerce.purchases },
      { name: 'New Purchase Order', href: routes.eCommerce.createPurchase },
      { name: 'Receive', href: routes.eCommerce.receivePurchase },
      { name: 'Validate Receipt', href: routes.eCommerce.validateReceipt },
      { name: 'Agreements', href: routes.eCommerce.purchaseAgreements },
      { name: 'Purchase Analytics', href: routes.eCommerce.purchaseAnalytics },
    ],
  },
  {
    name: 'Vendors & Bills',
    href: '#',
    icon: <PiInvoiceDuotone />,
    dropdownItems: [
      { name: 'Vendors', href: routes.eCommerce.purchaseVendors },
      { name: 'All Bills', href: routes.eCommerce.vendorBills },
      { name: 'New Bill', href: routes.eCommerce.createVendorBill },
      { name: 'Vendor Returns', href: routes.eCommerce.vendorReturns },
    ],
  },
  {
    name: 'Stock Transfers',
    href: '#',
    icon: <PiArrowUUpLeftDuotone />,
    dropdownItems: [
      { name: 'All Transfers', href: routes.eCommerce.stockTransfers },
      { name: 'New Transfer', href: routes.eCommerce.createStockTransfer },
    ],
  },
  {
    name: 'Purchase Config',
    href: '#',
    icon: <PiScalesDuotone />,
    dropdownItems: [
      { name: 'Vendor Pricelists', href: routes.eCommerce.vendorPricelists },
      { name: 'UOM Conversions', href: routes.eCommerce.uomConversions },
      { name: 'Exchange Rates', href: routes.eCommerce.exchangeRates },
      // routes.eCommerce.purchaseSettings is a /settings anchor; the standalone
      // page is /purchases/settings.
      { name: 'Purchase Settings', href: '/purchases/settings' },
    ],
  },
  {
    name: 'Inventory',
    href: '#',
    icon: <PiPackageDuotone />,
    dropdownItems: [
      { name: 'Overview', href: routes.inventory.index },
      { name: 'Receipts', href: routes.inventory.receipts },
      { name: 'Deliveries', href: routes.inventory.deliveries },
      { name: 'Transfers', href: routes.inventory.transfers },
      { name: 'Internal Transfers', href: routes.inventory.internal },
      { name: 'Adjustments', href: routes.inventory.adjustments },
      { name: 'Scrap', href: routes.inventory.scrap },
      { name: 'Physical Inventory', href: routes.inventory.physicalInventory },
      { name: 'Procurement', href: routes.inventory.procurement },
      { name: 'Replenishment', href: routes.inventory.replenishment },
    ],
  },
  {
    name: 'Inventory Reports',
    href: '#',
    icon: <PiClipboardTextDuotone />,
    dropdownItems: [
      { name: 'Stock', href: routes.inventory.stock },
      { name: 'Locations', href: routes.inventory.locations },
      { name: 'Valuation', href: routes.inventory.valuation },
      { name: 'Moves History', href: routes.inventory.movesHistory },
    ],
  },
  {
    name: 'Inventory Config',
    href: '#',
    icon: <PiSlidersDuotone />,
    dropdownItems: [
      { name: 'Operation Types', href: routes.inventory.operationTypes },
      { name: 'Locations', href: routes.inventory.configLocations },
      { name: 'Storage Categories', href: routes.inventory.storageCategories },
      { name: 'Putaway Rules', href: routes.inventory.putawayRules },
      { name: 'Attributes', href: routes.inventory.attributes },
      { name: 'Delivery Methods', href: routes.inventory.deliveryMethods },
      { name: 'Package Types', href: routes.inventory.packageTypes },
    ],
  },
  {
    name: 'Warehouses',
    href: '#',
    icon: <PiWarehouseDuotone />,
    dropdownItems: [
      { name: 'All Warehouses', href: routes.warehouses.list },
      { name: 'Warehouse Analysis', href: routes.warehouses.analysis },
    ],
  },

  // ─── Storefront ─────────────────────────────────────────────
  {
    name: 'Storefront',
  },
  {
    name: 'Orders',
    href: routes.eCommerce.orders,
    icon: <PiReceiptDuotone />,
  },
  {
    name: 'Reviews',
    href: routes.eCommerce.reviews,
    icon: <PiStarDuotone />,
  },
  {
    name: 'Banners',
    href: routes.eCommerce.banners,
    icon: <PiImageDuotone />,
  },
  {
    name: 'Blog',
    href: routes.blog.list,
    icon: <PiNewspaperClippingDuotone />,
  },
  {
    name: 'Shop Preview',
    href: routes.eCommerce.shop,
    icon: <PiStorefrontDuotone />,
    platformOnly: true,
  },

  // ─── Logistics ──────────────────────────────────────────────
  {
    name: 'Logistics',
  },
  {
    name: 'Shipments',
    href: '#',
    icon: <PiTruckDuotone />,
    dropdownItems: [
      { name: 'All Shipments', href: routes.logistics.shipmentList },
      { name: 'New Shipment', href: routes.logistics.createShipment },
    ],
  },
  {
    name: 'Tracking',
    href: '#',
    icon: <PiArrowsDownUpDuotone />,
    dropdownItems: [
      { name: 'Dashboard', href: routes.logistics.dashboard },
      // routes.logistics.tracking takes an id; this is the standalone page.
      { name: 'Track Shipment', href: '/logistics/tracking' },
      { name: 'Customer Profile', href: routes.logistics.customerProfile },
    ],
  },

  // ─── Support ────────────────────────────────────────────────
  {
    name: 'Support',
  },
  {
    name: 'Inbox',
    href: routes.support.inbox,
    icon: <PiChatCircleDotsDuotone />,
  },
  {
    name: 'Customers',
    href: routes.support.dashboard,
    icon: <PiUsersThreeDuotone />,
  },
  {
    name: 'Snippets & Templates',
    href: '#',
    icon: <PiFilesDuotone />,
    dropdownItems: [
      { name: 'Snippets', href: routes.support.snippets },
      { name: 'Templates', href: routes.support.templates },
    ],
  },

  // ─── Administration (platform-wide) ─────────────────────────
  {
    name: 'Administration',
  },
  {
    name: 'Tenants',
    href: '#',
    icon: <PiBuildingsDuotone />,
    platformOnly: true,
    dropdownItems: [
      { name: 'All Tenants', href: routes.eCommerce.tenants },
      { name: 'Add Tenant', href: routes.eCommerce.createTenant },
    ],
  },
  {
    name: 'Employees',
    href: routes.employees.list,
    icon: <PiUsersThreeDuotone />,
  },
  {
    name: 'Contacts',
    href: routes.contacts.list,
    icon: <PiAddressBookDuotone />,
  },
  {
    name: 'Users & Roles',
    href: routes.rolesPermissions,
    icon: <PiShieldCheckDuotone />,
  },
  {
    name: 'Invoices',
    href: '#',
    icon: <PiInvoiceDuotone />,
    dropdownItems: [
      { name: 'All Invoices', href: routes.invoice.home },
      { name: 'Create Invoice', href: routes.invoice.create },
      { name: 'Invoice Builder', href: routes.invoice.builder },
    ],
  },
  {
    name: 'Settings',
    href: '#',
    icon: <PiGearDuotone />,
    dropdownItems: [
      { name: 'General Settings', href: '/settings' },
      { name: 'Billing', href: routes.billing },
    ],
  },
  {
    name: 'Account Settings',
    href: routes.forms.profileSettings,
    icon: <PiUserGearDuotone />,
  },
];
