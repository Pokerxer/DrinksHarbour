'use client';

import Link from 'next/link';
import { PiSquaresFourDuotone } from 'react-icons/pi';

export type NavSubItem = {
  label: string;
  href: string;
  icon?: React.ReactNode;
  desc?: string;
};

export type NavSection = {
  heading?: string;
  items: NavSubItem[];
};

function ItemLink({
  sub,
  pathname,
  onNavigate,
}: {
  sub: NavSubItem;
  pathname: string;
  onNavigate: () => void;
}) {
  const isActive = sub.href !== '#' && pathname === sub.href;
  return (
    <Link
      href={sub.href}
      onClick={onNavigate}
      className={`group flex items-center gap-3 rounded-xl px-2.5 py-2 transition-colors ${
        isActive ? 'bg-[#fef2f2]' : 'hover:bg-gray-50'
      }`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 transition-colors [&>svg]:h-[19px] [&>svg]:w-[19px] ${
          isActive
            ? 'bg-[#b20202] text-white ring-[#b20202]'
            : 'bg-gray-100 text-gray-500 ring-transparent group-hover:bg-white group-hover:text-[#b20202] group-hover:ring-[#b20202]/20'
        }`}
      >
        {sub.icon ?? <PiSquaresFourDuotone />}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={`block truncate text-sm font-medium ${
            isActive ? 'text-[#b20202]' : 'text-gray-800'
          }`}
        >
          {sub.label}
        </span>
        {sub.desc && (
          <span className="block truncate text-xs text-gray-400">
            {sub.desc}
          </span>
        )}
      </span>
    </Link>
  );
}

/**
 * Shared, polished dropdown panel for the in-page nav headers
 * (warehouses / purchases / POS / inventory). Renders each entry as an icon
 * tile + label (+ optional description), with brand-red active styling and a
 * soft pop-in.
 *
 * Pass either flat `items` (optionally spread over `columns`) or grouped
 * `sections` (each with an optional heading) for Odoo-style configuration
 * menus.
 */
export default function NavDropdownPanel({
  items,
  sections,
  pathname,
  onNavigate,
  columns = 1,
}: {
  items?: NavSubItem[];
  sections?: NavSection[];
  pathname: string;
  onNavigate: () => void;
  columns?: 1 | 2;
}) {
  const isSectioned = !!sections?.length;
  const twoCol = isSectioned || columns === 2;
  return (
    <div
      className="nav-dd absolute left-0 top-full z-50 mt-2 rounded-2xl border border-gray-100 bg-white p-2 shadow-2xl shadow-gray-300/40 ring-1 ring-black/[0.04]"
      style={{ minWidth: twoCol ? 460 : 264 }}
    >
      <style>{`
        @keyframes nav-dd-in { from { opacity: 0; transform: translateY(-6px) scale(.98) } to { opacity: 1; transform: none } }
        .nav-dd { animation: nav-dd-in .16s cubic-bezier(.2,.7,.3,1) both; transform-origin: top left }
        @media (prefers-reduced-motion: reduce) { .nav-dd { animation: none } }
      `}</style>
      {isSectioned ? (
        <div className="grid grid-cols-2 gap-x-2 gap-y-3 p-1">
          {sections!.map((section, i) => (
            <div key={section.heading ?? i}>
              {section.heading && (
                <p className="px-2.5 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  {section.heading}
                </p>
              )}
              <div className="space-y-0.5">
                {section.items.map((sub) => (
                  <ItemLink
                    key={sub.label}
                    sub={sub}
                    pathname={pathname}
                    onNavigate={onNavigate}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={columns === 2 ? 'grid grid-cols-2 gap-0.5' : ''}>
          {(items ?? []).map((sub) => (
            <ItemLink
              key={sub.label}
              sub={sub}
              pathname={pathname}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  );
}
