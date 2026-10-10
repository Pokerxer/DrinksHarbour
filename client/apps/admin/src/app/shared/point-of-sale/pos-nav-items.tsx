import type React from 'react';
import { routes } from '@/config/routes';
import type { NavSubItem } from '@/app/shared/nav-dropdown-panel';
import {
  PiGaugeDuotone,
  PiReceiptDuotone,
  PiPackageDuotone,
  PiChartBarDuotone,
  PiGearDuotone,
  PiClockCounterClockwiseDuotone,
  PiCreditCardDuotone,
  PiPrinterDuotone,
  PiMonitorDuotone,
  PiUsersThreeDuotone,
  PiStackDuotone,
  PiTagDuotone,
  PiListChecksDuotone,
  PiGiftDuotone,
  PiChartLineUpDuotone,
  PiCoinsDuotone,
  PiStorefrontDuotone,
  PiNoteDuotone,
  PiSquaresFourDuotone,
  PiSlidersDuotone,
} from 'react-icons/pi';
type NavItem =
  | { label: string; href: string; icon: React.ReactNode; items?: never }
  | { label: string; href?: never; icon: React.ReactNode; items: NavSubItem[] };

export const navItems: NavItem[] = [
  { label: 'Dashboard', href: routes.pos.index, icon: <PiGaugeDuotone /> },
  {
    label: 'Orders',
    icon: <PiReceiptDuotone />,
    items: [
      { label: 'Orders', href: routes.pos.orders, icon: <PiReceiptDuotone /> },
      {
        label: 'Sessions',
        href: routes.pos.sessions,
        icon: <PiClockCounterClockwiseDuotone />,
      },
      { label: 'Payments', href: '#', icon: <PiCreditCardDuotone /> },
      { label: 'Preparation Printers', href: '#', icon: <PiPrinterDuotone /> },
      { label: 'Preparation Display', href: '#', icon: <PiMonitorDuotone /> },
      { label: 'Customers', href: '#', icon: <PiUsersThreeDuotone /> },
    ],
  },
  {
    label: 'Products',
    icon: <PiPackageDuotone />,
    items: [
      {
        label: 'Products',
        href: `${routes.eCommerce.subProducts}?from=pos`,
        icon: <PiPackageDuotone />,
      },
      {
        label: 'Product Variants',
        href: `${routes.eCommerce.subProducts}?from=pos`,
        icon: <PiStackDuotone />,
      },
      {
        label: 'Combo Choices',
        href: routes.pos.combos,
        icon: <PiSquaresFourDuotone />,
      },
      {
        label: 'Pricelists',
        href: routes.pos.pricelists,
        icon: <PiListChecksDuotone />,
      },
      {
        label: 'Discount & Loyalty',
        href: routes.pos.loyalty,
        icon: <PiTagDuotone />,
      },
      { label: 'Gift cards & eWallet', href: '#', icon: <PiGiftDuotone /> },
    ],
  },
  {
    label: 'Reporting',
    icon: <PiChartBarDuotone />,
    items: [
      {
        label: 'Order Analysis',
        href: routes.pos.orderAnalysis,
        icon: <PiChartLineUpDuotone />,
      },
      { label: 'Orders', href: routes.pos.orders, icon: <PiReceiptDuotone /> },
      {
        label: 'Sales Details',
        href: routes.pos.salesDetails,
        icon: <PiChartBarDuotone />,
      },
      {
        label: 'Session Report',
        href: routes.pos.sessionReport,
        icon: <PiClockCounterClockwiseDuotone />,
      },
    ],
  },
  {
    label: 'Configuration',
    icon: <PiGearDuotone />,
    items: [
      { label: 'Settings', href: routes.pos.settings, icon: <PiGearDuotone /> },
      { label: 'Payment Methods', href: '#', icon: <PiCreditCardDuotone /> },
      { label: 'Coins/Bills', href: '#', icon: <PiCoinsDuotone /> },
      {
        label: 'Point of Sales',
        href: routes.pos.index,
        icon: <PiStorefrontDuotone />,
      },
      { label: 'Note Models', href: '#', icon: <PiNoteDuotone /> },
      {
        label: 'Products',
        href: `${routes.eCommerce.subProducts}?from=pos`,
        icon: <PiPackageDuotone />,
      },
      {
        label: 'PoS Product Categories',
        href: routes.eCommerce.categories,
        icon: <PiTagDuotone />,
      },
      { label: 'Attributes', href: '#', icon: <PiSlidersDuotone /> },
    ],
  },
];
