import { routes } from '@/config/routes';
import {
  PiCashRegisterDuotone,
  PiChartBarDuotone,
  PiChartLineUpDuotone,
  PiShieldCheckDuotone,
  PiShoppingCartDuotone,
  PiTagDuotone,
  PiListBulletsDuotone,
  PiReceiptDuotone,
  PiStarDuotone,
  PiMegaphoneDuotone,
  PiImageDuotone,
  PiTruckDuotone,
  PiUserGearDuotone,
  PiUsersThreeDuotone,
  PiStorefrontDuotone,
  PiChatCircleDotsDuotone,
  PiArrowsDownUpDuotone,
  PiFilesDuotone,
  PiWarehouseDuotone,
  PiInvoiceDuotone,
  PiGearDuotone,
} from 'react-icons/pi';

// ─── Plan hierarchy ──────────────────────────────────────────────────────────

export type TenantPlan =
  | 'free_trial'
  | 'starter'
  | 'pro'
  | 'enterprise'
  | 'custom';

const PLAN_RANK: Record<TenantPlan, number> = {
  free_trial: 0,
  starter: 1,
  pro: 2,
  enterprise: 3,
  custom: 4,
};

/** Returns true if the tenant's plan meets or exceeds the required plan. */
export function planAllows(
  tenantPlan: string | undefined,
  required: TenantPlan
): boolean {
  const rank = PLAN_RANK[tenantPlan as TenantPlan] ?? 0;
  return rank >= PLAN_RANK[required];
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type TenantMenuItem = {
  name: string;
  href?: string;
  icon?: React.ReactNode;
  badge?: string;
  /** Minimum plan required to see this item. Omit = available on all plans. */
  requiredPlan?: TenantPlan;
  dropdownItems?: { name: string; href: string; badge?: string }[];
};

export type TenantMenuSection = {
  label: string;
};

export type TenantMenuEntry = TenantMenuItem | TenantMenuSection;

export function isSection(item: TenantMenuEntry): item is TenantMenuSection {
  return 'label' in item;
}

// ─── Menu items ──────────────────────────────────────────────────────────────
//
//  Plan gating:
//    (none)      — free_trial and above  (core features every tenant gets)
//    starter     — starter and above
//    pro         — pro and above
//    enterprise  — enterprise and above

export const tenantMenuItems: TenantMenuEntry[] = [
  // ─── Overview ───────────────────────────────────────────────
  { label: 'Overview' },
  {
    name: 'Dashboard',
    href: routes.eCommerce.dashboard,
    icon: <PiStorefrontDuotone />,
    // available on all plans
  },
  {
    name: 'Analytics',
    href: routes.analytics,
    icon: <PiChartBarDuotone />,
    requiredPlan: 'starter',
  },
  {
    name: 'Store Analytics',
    href: routes.storeAnalytics.dashboard,
    icon: <PiChartLineUpDuotone />,
    badge: 'NEW',
    requiredPlan: 'pro',
  },

  // ─── Catalog ────────────────────────────────────────────────
  { label: 'Catalog' },
  {
    name: 'Products',
    href: '#',
    icon: <PiListBulletsDuotone />,
    dropdownItems: [
      { name: 'All Products', href: routes.eCommerce.subProducts },
      { name: 'Add Product', href: routes.eCommerce.createSubProduct },
    ],
  },
  {
    name: 'Categories',
    href: '#',
    icon: <PiTagDuotone />,
    dropdownItems: [
      { name: 'All Categories', href: routes.eCommerce.categories },
      { name: 'Sub-categories', href: routes.eCommerce.subCategories },
    ],
  },
  {
    name: 'Brands',
    href: routes.eCommerce.brands,
    icon: <PiFilesDuotone />,
  },

  // ─── Inventory ──────────────────────────────────────────────
  { label: 'Inventory' },
  {
    name: 'Warehouses',
    href: routes.warehouses.list,
    icon: <PiWarehouseDuotone />,
    // available on all plans
  },

  // ─── Sales ──────────────────────────────────────────────────
  { label: 'Sales' },
  {
    name: 'Point of Sale',
    href: routes.pos.index,
    icon: <PiCashRegisterDuotone />,
    badge: 'POS',
    dropdownItems: [
      { name: 'Dashboard', href: routes.pos.index },
      { name: 'Sell', href: routes.pos.sell },
      { name: 'Order History', href: routes.pos.history },
      { name: 'Sessions', href: routes.pos.sessions },
      { name: 'Cashiers', href: routes.pos.cashiers },
    ],
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
    requiredPlan: 'starter',
  },
  {
    name: 'Promotions',
    href: routes.eCommerce.promotions,
    icon: <PiMegaphoneDuotone />,
    requiredPlan: 'starter',
  },
  {
    name: 'Banners',
    href: routes.eCommerce.banners,
    icon: <PiImageDuotone />,
    requiredPlan: 'starter',
  },

  // ─── Purchases ──────────────────────────────────────────────
  { label: 'Purchases' },
  {
    name: 'Purchase Orders',
    href: '#',
    icon: <PiShoppingCartDuotone />,
    dropdownItems: [
      { name: 'All Orders', href: routes.eCommerce.purchases },
      { name: 'New Purchase', href: routes.eCommerce.createPurchase },
      { name: 'Purchase Analytics', href: routes.eCommerce.purchaseAnalytics },
    ],
  },
  {
    name: 'Vendor Bills',
    href: '#',
    icon: <PiInvoiceDuotone />,
    dropdownItems: [
      { name: 'All Bills', href: routes.eCommerce.vendorBills },
      { name: 'New Bill', href: routes.eCommerce.createVendorBill },
      { name: 'Vendor Returns', href: routes.eCommerce.vendorReturns },
    ],
  },

  // ─── Logistics ──────────────────────────────────────────────
  { label: 'Logistics' },
  {
    name: 'Shipments',
    href: '#',
    icon: <PiTruckDuotone />,
    requiredPlan: 'enterprise',
    dropdownItems: [
      { name: 'All Shipments', href: routes.logistics.shipmentList },
      { name: 'New Shipment', href: routes.logistics.createShipment },
    ],
  },
  {
    name: 'Tracking',
    href: routes.logistics.dashboard,
    icon: <PiArrowsDownUpDuotone />,
    requiredPlan: 'enterprise',
  },

  // ─── Support ────────────────────────────────────────────────
  { label: 'Support' },
  {
    name: 'Inbox',
    href: routes.support.inbox,
    icon: <PiChatCircleDotsDuotone />,
    requiredPlan: 'pro',
  },
  {
    name: 'Customers',
    href: routes.support.dashboard,
    icon: <PiUsersThreeDuotone />,
    requiredPlan: 'pro',
  },

  // ─── Settings ───────────────────────────────────────────────
  { label: 'Settings' },
  {
    name: 'Settings',
    href: '/settings',
    icon: <PiGearDuotone />,
    // available on all plans
  },
  {
    name: 'Account Settings',
    href: routes.forms.profileSettings,
    icon: <PiUserGearDuotone />,
  },
  {
    name: 'Employees',
    href: routes.employees.list,
    icon: <PiUsersThreeDuotone />,
    // available on all plans
  },
  {
    name: 'Users & Roles',
    href: routes.rolesPermissions,
    icon: <PiShieldCheckDuotone />,
    requiredPlan: 'starter',
  },
];
