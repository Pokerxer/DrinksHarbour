'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { routes } from '@/config/routes';
import {
  PiCaretDown,
  PiPlus,
  PiStorefront,
  PiX,
  PiCheck,
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
import { posApi } from '@/app/shared/point-of-sale/api';
import {
  usePOSShops,
  usePOSAuth,
  usePOSActiveShop,
} from '@/app/shared/point-of-sale/store';
import type { POSShop } from '@/app/shared/point-of-sale/types';
import { LauncherButton } from '@/layouts/hydrogen/app-launcher';
import NavDropdownPanel, {
  type NavSubItem,
} from '@/app/shared/nav-dropdown-panel';

type NavItem =
  | { label: string; href: string; icon: React.ReactNode; items?: never }
  | { label: string; href?: never; icon: React.ReactNode; items: NavSubItem[] };

const navItems: NavItem[] = [
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

const BUILT_IN: POSShop[] = [
  {
    _id: 'retail',
    name: 'RETAIL',
    mode: 'retail',
    color: '#f97316',
    description: 'Front-counter sales',
    active: true,
    createdAt: '',
  },
  {
    _id: 'wholesale',
    name: 'WHOLESALE',
    mode: 'wholesale',
    color: '#0ea5e9',
    description: 'Bulk & account orders',
    active: true,
    createdAt: '',
  },
];

// ── New Shop Modal ────────────────────────────────────────────────────────────
function NewShopModal({
  onClose,
  onCreated,
  token,
}: {
  onClose: () => void;
  onCreated: (shop: POSShop) => void;
  token: string;
}) {
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'retail' | 'wholesale'>('retail');
  const [color, setColor] = useState('#b20202');
  const [desc, setDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Shop name is required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const { shop } = await posApi.createShop(token, {
        name: name.trim(),
        mode,
        color,
        description: desc,
      });
      onCreated(shop);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create shop');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <PiStorefront className="h-5 w-5 text-[#b20202]" />
            <span className="text-base font-semibold text-gray-900">
              New Shop
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <PiX className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Shop Name
            </label>
            <input
              ref={inputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. DRIVE-THRU, ONLINE, VIP BAR"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              {(['retail', 'wholesale'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                    mode === m
                      ? 'border-[#b20202] bg-[#fef2f2] text-[#b20202]'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {mode === m && <PiCheck className="h-4 w-4 shrink-0" />}
                  <span className="capitalize">{m}</span>
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-gray-400">
              {mode === 'retail'
                ? 'Walk-in customers, cashier-facing.'
                : 'Bulk & account-based orders, manager-facing.'}
            </p>
          </div>

          <div className="flex gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-9 w-12 cursor-pointer rounded border border-gray-200 p-0.5"
                />
                <span className="font-mono text-xs text-gray-500">{color}</span>
              </div>
            </div>
            <div className="flex-1">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Description{' '}
                <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <input
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="Short description"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20"
              />
            </div>
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#9a0101] disabled:opacity-50"
            >
              {saving ? 'Creating…' : 'Create Shop'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Shop Selector ─────────────────────────────────────────────────────────────
function ShopSelector({ token }: { token: string }) {
  const { shops, setShops } = usePOSShops();
  const { activeShopId, setActiveShopId } = usePOSActiveShop();
  const [open, setOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const activeId = activeShopId ?? 'retail';
  const allShops = [...BUILT_IN, ...shops];
  const active = allShops.find((s) => s._id === activeId) ?? BUILT_IN[0];

  useEffect(() => {
    posApi
      .listShops(token)
      .then(({ shops: loaded }) => setShops(loaded))
      .catch(() => {});
  }, [token, setShops]);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  return (
    <>
      <div ref={ref} className="relative ml-4">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm font-semibold text-gray-800 transition-colors hover:border-gray-300 hover:bg-white"
        >
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ background: active.color }}
          />
          <span className="max-w-[120px] truncate uppercase">
            {active.name}
          </span>
          <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-medium uppercase text-gray-600">
            {active.mode === 'retail' ? 'CASHIER' : 'MANAGER'}
          </span>
          <PiCaretDown
            className={`h-3 w-3 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>

        {open && (
          <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-xl border border-gray-100 bg-white shadow-xl">
            <div className="px-3 pb-1 pt-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                Your Shops
              </p>
            </div>
            <div className="max-h-60 overflow-y-auto py-1">
              {allShops.map((shop) => (
                <button
                  key={shop._id}
                  type="button"
                  onClick={() => {
                    setActiveShopId(shop._id);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 px-3 py-2 text-sm transition-colors ${
                    activeId === shop._id
                      ? 'bg-[#fef2f2] text-[#b20202]'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ background: shop.color }}
                  />
                  <span className="flex-1 truncate font-medium uppercase">
                    {shop.name}
                  </span>
                  <span className="text-[10px] capitalize text-gray-400">
                    {shop.mode}
                  </span>
                  {activeId === shop._id && (
                    <PiCheck className="h-3.5 w-3.5 shrink-0 text-[#b20202]" />
                  )}
                </button>
              ))}
            </div>
            <div className="border-t border-gray-100 p-2">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setShowModal(true);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-[#b20202] transition-colors hover:bg-[#fef2f2]"
              >
                <PiPlus className="h-4 w-4" />
                New Shop
              </button>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <NewShopModal
          token={token}
          onClose={() => setShowModal(false)}
          onCreated={(shop) => setShops((prev) => [...prev, shop])}
        />
      )}
    </>
  );
}

// ── Main nav ──────────────────────────────────────────────────────────────────
export default function POSNavHeader() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { token: posToken } = usePOSAuth();
  const adminToken = (session?.user as { token?: string })?.token ?? null;
  const token = adminToken ?? posToken ?? '';

  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);

  const close = useCallback(() => setOpenMenu(null), []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) close();
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [close]);

  useEffect(() => {
    close();
  }, [pathname, close]);

  return (
    <nav
      ref={navRef}
      className="relative mb-0 flex items-center border-b border-gray-200 bg-white"
    >
      {/* App launcher toggle */}
      <LauncherButton className="me-1 ms-3 shadow-none" />

      {/* Brand */}
      <Link
        href={routes.pos.index}
        className="flex shrink-0 items-center gap-2.5 border-r border-gray-200 py-2 pr-5"
      >
        <Image
          src="/logo-short.svg"
          alt="DrinksHarbour"
          width={30}
          height={30}
          className="rounded-full"
        />
        <span className="text-sm font-semibold text-gray-900">
          Point of Sale
        </span>
      </Link>

      {/* Shop selector */}
      {token && <ShopSelector token={token} />}

      {/* Nav links */}
      <div className="flex items-center pl-2">
        {navItems.map((item) => {
          const isDirectActive = 'href' in item && item.href === pathname;
          const isDropdownActive =
            'items' in item &&
            (item.items?.some(
              (s) => s.href !== '#' && pathname.startsWith(s.href)
            ) ??
              false);
          const isActive = isDirectActive || isDropdownActive;
          const isOpen = openMenu === item.label;

          const activeCls = `font-semibold after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:bg-[#b20202]`;

          if ('href' in item && item.href) {
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`relative flex items-center gap-1.5 px-4 py-3 text-sm transition-colors ${
                  isActive
                    ? `${activeCls} text-[#b20202]`
                    : 'font-normal text-gray-600 hover:text-gray-900'
                }`}
              >
                <span className="[&>svg]:h-[18px] [&>svg]:w-[18px]">
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          }

          const columns = (item.items?.length ?? 0) > 4 ? 2 : 1;

          return (
            <div key={item.label} className="relative">
              <button
                type="button"
                onClick={() => setOpenMenu(isOpen ? null : item.label)}
                className={`relative flex items-center gap-1.5 px-4 py-3 text-sm transition-colors ${
                  isActive || isOpen
                    ? `${activeCls} text-[#b20202]`
                    : 'font-normal text-gray-600 hover:text-gray-900'
                }`}
              >
                <span className="[&>svg]:h-[18px] [&>svg]:w-[18px]">
                  {item.icon}
                </span>
                {item.label}
                <PiCaretDown
                  className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {isOpen && (
                <NavDropdownPanel
                  items={item.items!}
                  pathname={pathname}
                  onNavigate={close}
                  columns={columns}
                />
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
