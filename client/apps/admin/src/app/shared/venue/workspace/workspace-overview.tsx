import type { ReactNode } from 'react';
import { ArrowRightLeft } from 'lucide-react';
import type { Workspace } from '@/services/venue/experience';
import FloorList from './floor-list';
import { Chip, panelClass, buttonClass } from './controls';
const readinessLabels: Record<string, string> = {
  profile: 'Location profile',
  publication: 'Publication review',
  menu: 'Beverage menu',
  floor: 'Floor layout',
  staff: 'Staff assignment',
  canonicalCheckout: 'Visit checkout approval',
};

function readinessTone(value: unknown): 'ready' | 'pending' {
  return value === true ? 'ready' : 'pending';
}

function readinessText(value: unknown): string {
  if (value === true) return 'Ready';
  if (value === false) return 'Needs review';
  return typeof value === 'string' ? value : 'Needs review';
}

export default function WorkspaceOverview({
  data,
  onOpen,
  children,
}: {
  data: Workspace;
  onOpen: (id: string) => void;
  children: ReactNode;
}) {
  const entries = Object.entries(data.readiness);
  const readyCount = entries.filter(([, value]) => value === true).length;
  return (
    <>
      <section className={`${panelClass} space-y-4`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold">Configuration checklist</h2>
          <p className="text-sm tabular-nums text-gray-600 dark:text-gray-300">
            <span className="font-semibold">{readyCount}</span> of{' '}
            <span className="font-semibold">{entries.length}</span> checks ready
          </p>
        </div>
        <div
          aria-hidden="true"
          className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"
        >
          <div
            className="h-full rounded-full bg-green-600 transition-all duration-300 dark:bg-green-500"
            style={{
              width: entries.length
                ? `${Math.round((readyCount / entries.length) * 100)}%`
                : '0%',
            }}
          />
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map(([name, value]) => (
            <li
              key={name}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm dark:border-gray-700 dark:bg-gray-800"
            >
              <span className="font-medium">
                {readinessLabels[name] || name}
              </span>
              <Chip
                tone={readinessTone(value)}
                label={readinessText(value)}
              />
            </li>
          ))}
        </ul>
      </section>
      {!data.canonicalCheckoutEnabled && (
        <p
          role="status"
          className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
        >
          <span
            aria-hidden="true"
            className="mt-1 size-2.5 shrink-0 rounded-full bg-amber-500"
          />
          <span>
            <strong>Seating is awaiting operational approval.</strong> Visit
            checkout approval is pending, so new arrivals cannot be seated at
            this location yet.
          </span>
        </p>
      )}
      {children}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Current visits and exceptions</h2>
        {!data.visits.length && (
          <p className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-5 py-8 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
            No open visits.
          </p>
        )}
        {data.visits.map((v) => (
          <article
            key={v._id}
            className={`${panelClass} flex flex-wrap items-start justify-between gap-3`}
          >
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-base font-semibold">
                  Visit {v._id.slice(-6)}
                </h3>
                <Chip
                  tone={v.state === 'closed' ? 'info' : 'pending'}
                  label={`State · ${v.state}`}
                />
              </div>
              <p className="text-sm tabular-nums text-gray-600 dark:text-gray-300">
                Service date {v.businessDate}
              </p>
            </div>
            {(data.canBill ?? data.canManage) && (
              <button className={buttonClass} onClick={() => onOpen(v._id)}>
                <ArrowRightLeft aria-hidden="true" className="size-4" />
                Open visit bill
              </button>
            )}
          </article>
        ))}
      </section>
      <FloorList floor={data.config.floor} tables={data.tables} />
    </>
  );
}
