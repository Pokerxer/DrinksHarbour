'use client';
import Link from 'next/link';
import {
  ArrowLeftRight,
  Banknote,
  CalendarClock,
  ClipboardList,
  ChefHat,
  DoorOpen,
  Hourglass,
  LayoutDashboard,
  LayoutGrid,
  ListOrdered,
  ScanBarcode,
  GraduationCap,
  MapPin,
  Plus,
  UtensilsCrossed,
  Wine,
  type LucideIcon,
} from 'lucide-react';
import type { Tab } from './tool-search';

export type { Tab };

const externalLinkClass =
  'inline-flex min-h-11 shrink-0 items-center rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700';

export default function WorkspaceNavigation({
  tab,
  onTab,
  canManage,
  preparation,
}: {
  tab: Tab;
  onTab: (tab: Tab) => void;
  canManage: boolean;
  preparation: boolean;
}) {
  const tabs: [Tab, string, LucideIcon][] = [
    ['overview', 'Overview', LayoutDashboard],
    ...(canManage
      ? ([
          ['profile', 'Location profile', MapPin],
          ['menu', 'Beverage menu', Wine],
          ['recipes', 'Recipe versions', ClipboardList],
          ['servings', 'Serving definitions', UtensilsCrossed],
          ['production', 'Batch preparation', ChefHat],
          ['counts', 'Physical counts', ClipboardList],
          ['cost-sources', 'Receipt costs', Banknote],
          ['profitability', 'Menu margin', Banknote],
          ['floor', 'Floor layout', LayoutGrid],
          ['floor-ops', 'Floor ops', ArrowLeftRight],
          ['capacity', 'Capacity settings', CalendarClock],
          ['money', 'Payment exceptions', Banknote],
          ['stations', 'Prep stations', UtensilsCrossed],
          ['courses', 'Courses', ListOrdered],
        ] as [Tab, string, LucideIcon][])
      : []),
    // Phase-4 E2: the door is staff work, not configuration — every workspace
    // user sees the tab; the panel (and server) only ever show occurrences the
    // actor is assigned to (doorStaffIds rule).
    // Phase-4 E3: the waitlist is likewise live floor work (a queue with
    // expiring offers) — visible to every workspace user, like the door.
    ['door', 'Door', DoorOpen],
    ['waitlist', 'Waitlist', Hourglass],
    // Phase-4 E4: packages are floor work too — definitions below the commit
    // queue are management-only (the panel itself gates on canManage), but the
    // commit/serve queue is visible to every workspace user, like door/waitlist.
    ['packages', 'Packages', Wine],
    ['practice', 'Staff practice', GraduationCap],
  ];
  return (
    <nav
      aria-label="Venue tools"
      className="sticky top-0 z-20 -mx-4 border-b border-gray-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur dark:border-gray-700 dark:bg-gray-900/95 sm:-mx-6 sm:px-6"
    >
      <div className="flex items-center gap-2 overflow-x-auto pb-0.5 motion-safe:[scrollbar-width:none]">
        {tabs.map(([value, label, Icon]) => {
          const active = tab === value;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={active}
              onClick={() => onTab(value)}
              className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors duration-200 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${active ? 'border-gray-900 bg-gray-900 text-white shadow-sm dark:border-gray-200 dark:bg-gray-200 dark:text-gray-950' : 'border-transparent text-gray-700 hover:border-gray-200 hover:bg-gray-100 dark:text-gray-300 dark:hover:border-gray-700 dark:hover:bg-gray-800'}`}
            >
              <Icon aria-hidden="true" className="size-4 shrink-0" />
              {label}
              {active && <span className="sr-only">(current tool)</span>}
            </button>
          );
        })}
        <span
          aria-hidden="true"
          className="mx-1 hidden h-8 w-px shrink-0 bg-gray-200 dark:bg-gray-700 sm:block"
        />
        <Link href="/venue-completion" className={externalLinkClass}>
          <Plus aria-hidden="true" className="size-4 shrink-0" />
          Complete existing visits
        </Link>
        <Link href="/point-of-sale/sell" className={externalLinkClass}>
          <ScanBarcode aria-hidden="true" className="size-4 shrink-0" />
          Open POS
        </Link>
        {preparation && (
          <Link href="/pos/kitchen" className={externalLinkClass}>
            <ChefHat aria-hidden="true" className="size-4 shrink-0" />
            Open preparation queue
          </Link>
        )}
      </div>
    </nav>
  );
}
