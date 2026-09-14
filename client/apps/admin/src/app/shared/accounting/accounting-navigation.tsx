import type React from 'react';
import type { NavSubItem } from '@/app/shared/nav-dropdown-panel';
import {
  PiGaugeDuotone,
  PiBookOpenDuotone,
  PiChartBarDuotone,
  PiBookOpenTextDuotone,
  PiReceiptDuotone,
  PiUsersDuotone,
  PiHandshakeDuotone,
  PiFileTextDuotone,
  PiArrowCounterClockwiseDuotone,
  PiMoneyDuotone,
  PiStackDuotone,
  PiPackageDuotone,
} from 'react-icons/pi';
import { routes } from '@/config/routes';
type NavItem =
  | { label: string; href: string; icon: React.ReactNode }
  | { label: string; icon: React.ReactNode; items: NavSubItem[] };

export const navItems: NavItem[] = [
  {
    label: 'Overview',
    href: routes.accounting.index,
    icon: <PiGaugeDuotone />,
  },
  {
    label: 'Journal Entries',
    href: routes.accounting.journalEntries,
    icon: <PiBookOpenDuotone />,
  },
  {
    label: 'Reports',
    href: routes.accounting.reports,
    icon: <PiChartBarDuotone />,
  },
  {
    label: 'Customers',
    icon: <PiUsersDuotone />,
    items: [
      {
        label: 'Invoices',
        href: routes.accounting.invoices,
        icon: <PiFileTextDuotone />,
        desc: 'Open customer invoices',
      },
      {
        label: 'Credit Notes',
        href: routes.accounting.creditNotes,
        icon: <PiArrowCounterClockwiseDuotone />,
        desc: 'Issue customer credits',
      },
      {
        label: 'Payments',
        href: `${routes.accounting.payments}?side=customer`,
        icon: <PiMoneyDuotone />,
        desc: 'Register customer payments',
      },
      {
        label: 'Batch Payments',
        href: `${routes.accounting.batchPayments}?side=customer`,
        icon: <PiStackDuotone />,
        desc: 'Group payments for deposit',
      },
      {
        label: 'Products',
        href: routes.accounting.products,
        icon: <PiPackageDuotone />,
        desc: 'What you sell',
      },
      {
        label: 'Customers',
        href: routes.accounting.customers,
        icon: <PiUsersDuotone />,
        desc: 'Balances & contacts',
      },
    ],
  },
  {
    label: 'Vendors',
    icon: <PiHandshakeDuotone />,
    items: [
      {
        label: 'Bills',
        href: routes.accounting.bills,
        icon: <PiFileTextDuotone />,
        desc: 'Open vendor bills',
      },
      {
        label: 'Payments',
        href: `${routes.accounting.payments}?side=vendor`,
        icon: <PiMoneyDuotone />,
        desc: 'Pay your vendors',
      },
      {
        label: 'Batch Payments',
        href: `${routes.accounting.batchPayments}?side=vendor`,
        icon: <PiStackDuotone />,
        desc: 'Group payments for payout',
      },
      {
        label: 'Products',
        href: routes.accounting.products,
        icon: <PiPackageDuotone />,
        desc: 'What you sell',
      },
      {
        label: 'Vendors',
        href: routes.accounting.vendors,
        icon: <PiHandshakeDuotone />,
        desc: 'Balances & contacts',
      },
    ],
  },
  {
    label: 'Configuration',
    icon: <PiBookOpenTextDuotone />,
    items: [
      {
        label: 'Chart of Accounts',
        href: routes.accounting.chartOfAccounts,
        icon: <PiBookOpenTextDuotone />,
        desc: 'Accounts & balances',
      },
      {
        label: 'Taxes',
        href: routes.accounting.taxes,
        icon: <PiReceiptDuotone />,
        desc: 'Rates, ledger, summary',
      },
    ],
  },
];
