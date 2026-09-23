'use client';

// app/shared/warehouses/mobile-nav-menu.tsx
// Collapsible "Menu" dropdown for narrow screens: replaces the icon-only,
// multi-row wrapping tab strip below `md` in the module nav headers. One
// button expands a labelled panel listing every destination; grouped items
// (Catalog, Purchases, Configuration) are collapsible sections.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PiCaretDown } from 'react-icons/pi';
import type { NavSubItem, NavSection } from '@/app/shared/nav-dropdown-panel';

type MenuNavItem =
  | { label: string; href: string; icon: React.ReactNode; items?: never; sections?: never }
  | { label: string; href?: never; icon: React.ReactNode; items: NavSubItem[]; sections?: never }
  | { label: string; href?: never; icon: React.ReactNode; items?: never; sections: NavSection[] };

function subItemsOf(item: MenuNavItem): NavSubItem[] {
  if ('items' in item && item.items) return item.items;
  if ('sections' in item && item.sections)
    return item.sections.flatMap((s) => s.items);
  return [];
}

/** True when a nav item (direct link or dropdown group) matches the path. */
export function isMobileNavItemActive(
  item: MenuNavItem,
  pathname: string
): boolean {
  if ('href' in item) return item.href === pathname;
  return (
    subItemsOf(item).some((s) => s.href !== '#' && pathname.startsWith(s.href)) ??
    false
  );
}

export function activeMobileNavLabel(
  items: MenuNavItem[],
  pathname: string
): string | undefined {
  return items.find((i) => isMobileNavItemActive(i, pathname))?.label;
}

export default function MobileNavMenu({
  items,
  open,
  onClose,
  id = 'mobile-nav-menu',
}: {
  items: MenuNavItem[];
  open: boolean;
  onClose: () => void;
  id?: string;
}) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState<string | null>(null);

  // Close on Escape. Outside clicks are handled by the host header (it owns
  // both the toggle button and this panel, so the toggle always works).
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Reset navigation state whenever the route changes.
  useEffect(() => {
    setExpanded(null);
    onClose();
  }, [pathname, onClose]);

  if (!open) return null;

  return (
    <div
      id={id}
      className="absolute inset-x-0 top-full z-50 mt-1 rounded-xl border border-gray-200 bg-white shadow-xl shadow-gray-200/60 md:hidden"
    >
      <nav className="max-h-[calc(100vh-80px)] overflow-y-auto p-2">
        {items.map((item) => {
          const isActive = isMobileNavItemActive(item, pathname);

          // Direct link: label + icon, red when active.
          if ('href' in item) {
            return (
              <Link
                key={item.label}
                href={item.href!}
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  isActive
                    ? 'bg-[#b20202]/5 font-semibold text-[#b20202]'
                    : 'font-normal text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="[&>svg]:h-[18px] [&>svg]:w-[18px]">
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          }

          // Grouped item: expand/collapse its sub-items.
          const isGroupOpen = expanded === item.label;
          const flat = 'items' in item ? item.items! : [];
          const sections = 'sections' in item ? item.sections! : undefined;
          return (
            <div key={item.label}>
              <button
                type="button"
                onClick={() => setExpanded(isGroupOpen ? null : item.label)}
                aria-expanded={isGroupOpen}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  isActive
                    ? 'font-semibold text-[#b20202]'
                    : 'font-normal text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="[&>svg]:h-[18px] [&>svg]:w-[18px]">
                  {item.icon}
                </span>
                <span className="flex-1 text-left">{item.label}</span>
                <PiCaretDown
                  className={`h-3 w-3 text-gray-400 transition-transform ${
                    isGroupOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {isGroupOpen && (
                <div className="mb-1 ml-7 space-y-2 border-l border-gray-100 pl-3">
                  {sections
                    ? sections.map((section, i) => (
                        <div key={section.heading ?? i}>
                          {section.heading && (
                            <p className="px-3 pb-0.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                              {section.heading}
                            </p>
                          )}
                          <div className="space-y-0.5">
                            {section.items
                              .filter((sub) => sub.href !== '#')
                              .map((sub) => (
                                <Link
                                  key={sub.label}
                                  href={sub.href!}
                                  aria-current={
                                    pathname.startsWith(sub.href!)
                                      ? 'page'
                                      : undefined
                                  }
                                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                                    pathname.startsWith(sub.href!)
                                      ? 'bg-[#b20202]/5 font-semibold text-[#b20202]'
                                      : 'font-normal text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                  }`}
                                >
                                  {sub.icon && (
                                    <span className="[&>svg]:h-4 [&>svg]:w-4 opacity-70">
                                      {sub.icon}
                                    </span>
                                  )}
                                  {sub.label}
                                </Link>
                              ))}
                          </div>
                        </div>
                      ))
                    : flat.map((sub) => {
                        if (sub.href === '#') return null;
                        const subActive = pathname.startsWith(sub.href!);
                        return (
                          <Link
                            key={sub.label}
                            href={sub.href!}
                            aria-current={subActive ? 'page' : undefined}
                            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                              subActive
                                ? 'bg-[#b20202]/5 font-semibold text-[#b20202]'
                                : 'font-normal text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                            }`}
                          >
                            {sub.icon && (
                              <span className="[&>svg]:h-4 [&>svg]:w-4 opacity-70">
                                {sub.icon}
                              </span>
                            )}
                            {sub.label}
                          </Link>
                        );
                      })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </div>
  );
}