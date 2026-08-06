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
  PiImageDuotone,
  PiTruckDuotone,
  PiUserGearDuotone,
  PiUsersThreeDuotone,
  PiAddressBookDuotone,
  PiStorefrontDuotone,
  PiChatCircleDotsDuotone,
  PiArrowsDownUpDuotone,
  PiFilesDuotone,
  PiWarehouseDuotone,
  PiInvoiceDuotone,
  PiGearDuotone,
  PiFileTextDuotone,
  PiTrayArrowDownDuotone,
  PiArrowUUpLeftDuotone,
  PiPackageDuotone,
  PiClipboardTextDuotone,
} from 'react-icons/pi';

// ─── Plan hierarchy ──────────────────────────────────────────────────────────
// Keys mirror server/config/erm-plans.js — Tenant.plan enum. Keep the two in
// sync: a plan missing here ranks as free_trial (0) and silently locks the
// tenant out of every gated item, which is how growth (₦35K) and venue (₦150K)
// tenants were being treated before growth/venue were added.

export type TenantPlan =
  | 'free_trial'
  | 'starter'
  | 'growth'
  | 'pro'
  | 'enterprise'
  | 'venue'
  | 'custom';

const PLAN_RANK: Record<TenantPlan, number> = {
  free_trial: 0,
  starter: 1,
  growth: 2,
  pro: 3,
  enterprise: 4,
  venue: 5,
  custom: 6,
};

/** Returns true if the tenant's plan meets or exceeds the required plan. */
export function planAllows(
  tenantPlan: string | undefined,
  required: TenantPlan
): boolean {
  const rank = PLAN_RANK[tenantPlan as TenantPlan] ?? 0;
  return rank >= PLAN_RANK[required];
}

// ─── Role hierarchy ───────────────────────────────────────────────────────────
// Tenant-role users all share the tenant sidebar, but a handful of entries are
// management surfaces the server and middleware refuse for tenant_staff. This
// mirrors src/middleware.ts (/roles-permissions, /users) and the server's
// tenantAdminOrSuperAdmin guards (/api/pos/cashiers).

export type TenantMenuRole = 'tenant_owner' | 'tenant_admin';

const ROLE_RANK: Record<TenantMenuRole, number> = {
  tenant_owner: 1,
  tenant_admin: 2,
};

/** Returns true if the user's role meets or exceeds the required role. */
export function roleAllows(
  userRole: string | undefined,
  required: TenantMenuRole
): boolean {
  const rank = ROLE_RANK[userRole as TenantMenuRole] ?? 0;
  return rank >= ROLE_RANK[required];
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type TenantMenuItem = {
  name: string;
  href?: string;
  icon?: React.ReactNode;
  badge?: string;
  /**
   * Names a live, self-updating badge for this entry, as opposed to `badge`
   * which is a fixed label. Resolved to a component in sidebar-menu.
   */
  liveBadge?: 'mail-unread';
  /** Minimum plan required to see this item. Omit = available on all plans. */
  requiredPlan?: TenantPlan;
  /**
   * Minimum tenant role required to see this item. Omit = visible to all
   * tenant roles (tenant_staff included). Mirrors the middleware/server
   * guards, so the menu stops offering links that end in access-denied or
   * a 403 for staff users.
   */
  minRole?: TenantMenuRole;
  dropdownItems?: {
    name: string;
    href: string;
    badge?: string;
    minRole?: TenantMenuRole;
  }[];
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
    name: 'Inventory',
    href: routes.inventory.index,
    icon: <PiPackageDuotone />,
    dropdownItems: [
      { name: 'Overview', href: routes.inventory.index },
      { name: 'Transfers', href: routes.inventory.transfers },
      { name: 'Receipts', href: routes.inventory.receipts },
      { name: 'Deliveries', href: routes.inventory.deliveries },
      { name: 'Adjustments', href: routes.inventory.adjustments },
      { name: 'Stock', href: routes.inventory.stock },
      { name: 'Replenishment', href: routes.inventory.replenishment },
    ],
  },
  {
    name: 'Warehouses',
    href: routes.warehouses.list,
    icon: <PiWarehouseDuotone />,
    // available on all plans
  },

  // ─── Point of Sale ──────────────────────────────────────────
  { label: 'Point of Sale' },
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
      {
        name: 'Cashiers',
        href: routes.pos.cashiers,
        // Server: /api/pos/cashiers* requires tenantAdminOrSuperAdmin.
        minRole: 'tenant_owner',
      },
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

  // ─── Sales ──────────────────────────────────────────────────
  { label: 'Sales' },
  {
    name: 'Quotations & Orders',
    href: '#',
    icon: <PiFileTextDuotone />,
    dropdownItems: [
      { name: 'Quotations', href: routes.eCommerce.salesQuotations },
      { name: 'Orders', href: routes.eCommerce.salesOrders },
      { name: 'New Sale', href: routes.eCommerce.createSale },
    ],
  },
  {
    name: 'Fulfillment',
    href: routes.eCommerce.salesFulfillList,
    icon: <PiTrayArrowDownDuotone />,
  },
  {
    name: 'Sales Returns',
    href: routes.eCommerce.salesReturns,
    icon: <PiArrowUUpLeftDuotone />,
  },

  // ─── Logistics ──────────────────────────────────────────────
  { label: 'Logistics' },
  {
    name: 'Dispatch Board',
    href: routes.logistics.dashboard,
    icon: <PiTruckDuotone />,
    requiredPlan: 'enterprise',
  },
  {
    name: 'Riders',
    href: routes.logistics.drivers,
    icon: <PiArrowsDownUpDuotone />,
    requiredPlan: 'enterprise',
  },
  // Shipments / Tracking / Customer Profile remain template demo pages and are
  // deliberately unlinked — see the note in hydrogen/menu-items.tsx.

  // ─── Support ────────────────────────────────────────────────
  { label: 'Support' },
  {
    name: 'Inbox',
    href: routes.support.inbox,
    icon: <PiChatCircleDotsDuotone />,
    requiredPlan: 'pro',
    liveBadge: 'mail-unread',
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
    // Store configuration — staff shouldn't reconfigure the business.
    minRole: 'tenant_owner',
  },
  {
    name: 'Account Settings',
    href: routes.forms.profileSettings,
    icon: <PiUserGearDuotone />,
    // Own profile — every tenant role sees this.
  },
  {
    name: 'Employees',
    href: routes.employees.list,
    icon: <PiUsersThreeDuotone />,
    // Staff/role management — matches /roles-permissions protection.
    minRole: 'tenant_owner',
  },
  {
    name: 'Appraisals',
    href: '/appraisals',
    icon: <PiClipboardTextDuotone />,
    // Own appraisal + assigned feedback forms — every tenant role sees this
    // (matches middleware: bare /appraisals is not gated).
    dropdownItems: [
      { name: 'My Appraisals', href: '/appraisals' },
      { name: 'My Team', href: '/appraisals/team' },
      {
        name: 'Cycles',
        href: '/appraisals/cycles',
        // HR administration — matches middleware's /appraisals/cycles gate.
        minRole: 'tenant_owner',
      },
    ],
  },
  {
    name: 'Contacts',
    href: routes.contacts.list,
    icon: <PiAddressBookDuotone />,
    // available on all plans
  },
  {
    name: 'Users & Roles',
    href: routes.rolesPermissions,
    icon: <PiShieldCheckDuotone />,
    requiredPlan: 'starter',
    // Middleware refuses /roles-permissions for tenant_staff.
    minRole: 'tenant_owner',
  },
];
