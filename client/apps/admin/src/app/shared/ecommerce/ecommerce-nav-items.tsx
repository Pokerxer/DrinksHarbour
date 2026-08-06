import type { ReactNode } from 'react';
import { routes } from '@/config/routes';
import {
  planAllows,
  roleAllows,
  type TenantMenuRole,
  type TenantPlan,
} from '@/layouts/hydrogen/tenant-menu-items';
import { TENANT_ROLES, type UserRole } from '@/types/authorization';
import {
  PiGaugeDuotone,
  PiReceiptDuotone,
  PiPackageDuotone,
  PiStackDuotone,
  PiCashRegisterDuotone,
  PiIdentificationCardDuotone,
  PiUserGearDuotone,
  PiSlidersHorizontalDuotone,
  PiTagDuotone,
  PiMegaphoneDuotone,
  PiBuildingsDuotone,
  PiChartLineUpDuotone,
  PiStarDuotone,
  PiStorefrontDuotone,
} from 'react-icons/pi';

export interface EcommerceNavSubItem {
  label: string;
  href: string;
  icon?: ReactNode;
  desc?: string;
  /** Minimum tenant plan required to see this item (tenant users only). */
  requiredPlan?: TenantPlan;
  /** Minimum tenant role required to see this item (tenant users only). */
  minRole?: TenantMenuRole;
}

export type EcommerceNavItem =
  | {
      label: string;
      href: string;
      icon: ReactNode;
      items?: never;
      requiredPlan?: TenantPlan;
      minRole?: TenantMenuRole;
    }
  | {
      label: string;
      href?: never;
      icon: ReactNode;
      items: EcommerceNavSubItem[];
    };

/**
 * Tenant nav — mirrors the hydrogen tenant sidebar (tenant-menu-items.tsx) so
 * the /ecommerce top bar never offers a link the sidebar hides or the
 * middleware/server refuse for a given role or plan.
 *
 * Gating rules mirror the sidebar exactly:
 *   - Banners / Reviews          → starter plan and above
 *   - Cashiers (POS)             → tenant_owner and above (server guard)
 *   - Settings                   → tenant_owner and above
 */
const tenantNavItems: EcommerceNavItem[] = [
  {
    label: 'Dashboard',
    href: routes.eCommerce.dashboard,
    icon: <PiGaugeDuotone />,
  },
  {
    label: 'Orders',
    href: routes.eCommerce.orders,
    icon: <PiReceiptDuotone />,
  },
  {
    label: 'Sub-Products',
    icon: <PiPackageDuotone />,
    items: [
      {
        label: 'My Sub-Products',
        href: routes.eCommerce.subProducts,
        icon: <PiPackageDuotone />,
        desc: 'Your sellable stock instances',
      },
      {
        label: 'Add Sub-Product',
        href: routes.eCommerce.createSubProduct,
        icon: <PiPackageDuotone />,
        desc: 'Link to a catalog product or create new',
      },
    ],
  },
  {
    label: 'Inventory',
    icon: <PiStackDuotone />,
    items: [
      {
        label: 'Categories',
        href: routes.eCommerce.categories,
        icon: <PiTagDuotone />,
      },
      {
        label: 'Brands',
        href: routes.eCommerce.brands,
        icon: <PiTagDuotone />,
      },
      {
        label: 'Banners',
        href: routes.eCommerce.banners,
        icon: <PiMegaphoneDuotone />,
        desc: 'Storefront promotional banners',
        requiredPlan: 'starter',
      },
    ],
  },
  {
    label: 'Point of Sale',
    icon: <PiCashRegisterDuotone />,
    items: [
      {
        label: 'POS Dashboard',
        href: routes.pos.index,
        icon: <PiCashRegisterDuotone />,
        desc: 'Terminal overview',
      },
      {
        label: 'Cashiers',
        href: routes.pos.cashiers,
        icon: <PiIdentificationCardDuotone />,
        desc: 'POS staff & PINs',
        minRole: 'tenant_owner',
      },
    ],
  },
  {
    label: 'Configuration',
    icon: <PiUserGearDuotone />,
    items: [
      {
        label: 'Account Settings',
        href: routes.forms.profileSettings,
        icon: <PiUserGearDuotone />,
        desc: 'Your profile & security',
      },
      {
        label: 'Settings',
        href: '/settings',
        icon: <PiSlidersHorizontalDuotone />,
        desc: 'Workspace settings',
        minRole: 'tenant_owner',
      },
    ],
  },
];

/** Platform admin nav — super_admin / admin running the central marketplace. */
const adminNavItems: EcommerceNavItem[] = [
  {
    label: 'Dashboard',
    href: routes.eCommerce.dashboard,
    icon: <PiGaugeDuotone />,
  },
  {
    label: 'Products',
    icon: <PiPackageDuotone />,
    items: [
      {
        label: 'Central Catalog',
        href: routes.eCommerce.products,
        icon: <PiStorefrontDuotone />,
        desc: 'Single source of truth for products',
      },
      {
        label: 'Add Product',
        href: routes.eCommerce.createProduct,
        icon: <PiPackageDuotone />,
      },
      {
        label: 'Sub-Products',
        href: routes.eCommerce.subProducts,
        icon: <PiStackDuotone />,
        desc: 'Tenant-owned selling instances',
      },
      {
        label: 'Categories',
        href: routes.eCommerce.categories,
        icon: <PiTagDuotone />,
      },
      {
        label: 'Brands',
        href: routes.eCommerce.brands,
        icon: <PiTagDuotone />,
      },
    ],
  },
  {
    label: 'Tenants',
    href: routes.eCommerce.tenants,
    icon: <PiBuildingsDuotone />,
  },
  {
    label: 'Orders',
    href: routes.eCommerce.orders,
    icon: <PiReceiptDuotone />,
  },
  {
    label: 'Engagement',
    icon: <PiStarDuotone />,
    items: [
      {
        label: 'Reviews',
        href: routes.eCommerce.reviews,
        icon: <PiStarDuotone />,
      },
      {
        label: 'Promotions',
        href: routes.eCommerce.promotions,
        icon: <PiMegaphoneDuotone />,
      },
      {
        label: 'Banners',
        href: routes.eCommerce.banners,
        icon: <PiMegaphoneDuotone />,
      },
    ],
  },
  {
    label: 'Configuration',
    icon: <PiSlidersHorizontalDuotone />,
    items: [
      {
        label: 'Settings',
        href: '/settings',
        icon: <PiSlidersHorizontalDuotone />,
        desc: 'Platform settings',
      },
      {
        label: 'Analytics',
        href: routes.analytics,
        icon: <PiChartLineUpDuotone />,
      },
    ],
  },
];

export { tenantNavItems, adminNavItems };

/**
 * Pick the nav set for the signed-in user and drop every entry (and dropdown
 * child) their role or plan can't use. Platform roles get the full admin nav;
 * tenant roles get the tenant nav filtered by plan and minRole — the same
 * gates the hydrogen sidebar applies, so the top bar and sidebar agree.
 */
export function getEcommerceNavItems(opts: {
  role?: string;
  plan?: string;
}): EcommerceNavItem[] {
  const isTenantUser = TENANT_ROLES.includes(opts.role as UserRole);
  const source = isTenantUser ? tenantNavItems : adminNavItems;

  if (!isTenantUser) return source;

  return source
    .map((item) => {
      if ('items' in item && item.items) {
        const kids = item.items.filter(
          (sub) =>
            (!sub.requiredPlan || planAllows(opts.plan, sub.requiredPlan)) &&
            (!sub.minRole || roleAllows(opts.role, sub.minRole))
        );
        // A dropdown whose children were all gated out has nothing to link to.
        return kids.length ? { ...item, items: kids } : null;
      }
      const allowed =
        (!item.requiredPlan || planAllows(opts.plan, item.requiredPlan)) &&
        (!item.minRole || roleAllows(opts.role, item.minRole));
      return allowed ? item : null;
    })
    .filter((item): item is EcommerceNavItem => item !== null);
}
