import Link from 'next/link';
import type { ReactNode } from 'react';
import { PiArrowLeft, PiCheck, PiCalendarBlank } from 'react-icons/pi';
import type { AppraisalCycle } from '@/services/appraisal.service';

const statuses = {
  draft: 'Draft',
  collecting: 'Collecting',
  closed: 'Closed',
  cancelled: 'Cancelled',
};
function date(value?: string) {
  if (!value || Number.isNaN(new Date(value).getTime())) return 'Not set';
  return new Date(value).toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
export function CycleHeader({
  cycle,
  modeLabel,
  description,
  actions,
}: {
  cycle: AppraisalCycle;
  modeLabel: string;
  description: string;
  actions?: ReactNode;
}) {
  const stages = ['draft', 'collecting', 'closed'] as const;
  const current = stages.findIndex((stage) => stage === cycle.status);
  return (
    <header className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="px-5 py-5 sm:px-7 sm:py-6">
        <Link
          href="/appraisals/cycles"
          className="inline-flex items-center gap-2 rounded text-xs font-medium text-gray-500 hover:text-gray-900 focus-visible:outline focus-visible:outline-2"
        >
          <PiArrowLeft aria-hidden="true" />
          All cycles
        </Link>
        <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="w-full min-w-0 sm:w-auto sm:flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[#b20202]">
              {modeLabel}
            </p>
            <h1 className="mt-2 break-words text-2xl font-semibold tracking-tight text-gray-900 sm:text-[28px]">
              {cycle.name}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
              {description}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-3">
            <span
              role="status"
              aria-label={`Cycle ${cycle.status}`}
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${cycle.status === 'closed' ? 'bg-green-50 text-green-700' : cycle.status === 'collecting' ? 'bg-red-50 text-[#b20202]' : 'bg-gray-100 text-gray-600'}`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {statuses[cycle.status]}
            </span>
            {actions}
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 border-t border-gray-100 pt-4 text-xs text-gray-500">
          <span className="inline-flex items-center gap-2">
            <PiCalendarBlank aria-hidden="true" />
            {cycle.launchedAt
              ? `Launched ${date(cycle.launchedAt)}`
              : 'Not launched yet'}
          </span>
          {cycle.feedbackDeadline && (
            <span>Feedback due {date(cycle.feedbackDeadline)}</span>
          )}
          {cycle.closedAt && <span>Closed {date(cycle.closedAt)}</span>}
        </div>
      </div>
      <ol
        aria-label="Cycle stages"
        className="grid grid-cols-3 border-t border-gray-100 bg-gray-50/70"
      >
        {stages.map((stage, i) => (
          <li
            key={stage}
            aria-current={stage === cycle.status ? 'step' : undefined}
            className={`relative flex items-center gap-2 px-3 py-4 sm:gap-3 sm:px-7 ${i > 0 ? 'border-l border-gray-200' : ''} ${current === i ? 'text-[#b20202]' : current > i ? 'text-green-700' : 'text-gray-400'}`}
          >
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${current === i ? 'border-[#b20202] bg-red-50' : current > i ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-white'}`}
            >
              {current > i ? <PiCheck aria-label="Complete" /> : i + 1}
            </span>
            <span className="text-xs font-semibold sm:text-sm">
              {statuses[stage]}
            </span>
            {current === i && (
              <span className="absolute inset-x-0 bottom-0 h-0.5 bg-[#b20202]" />
            )}
          </li>
        ))}
      </ol>
    </header>
  );
}
export function CycleMetric({
  label,
  value,
  detail,
  accent = false,
}: {
  label: string;
  value: string;
  detail: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-4 sm:px-5">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p
        className={`mt-2 text-2xl font-semibold tabular-nums tracking-tight ${accent ? 'text-[#b20202]' : 'text-gray-900'}`}
      >
        {value}
      </p>
      <p className="mt-1 text-xs leading-5 text-gray-500">{detail}</p>
    </div>
  );
}
export function CycleActionPanel({
  title,
  description,
  children,
  settings,
}: {
  title: string;
  description: string;
  children: ReactNode;
  settings?: ReactNode;
}) {
  return (
    <aside className="self-start rounded-2xl border border-gray-200 bg-white p-5 shadow-sm lg:sticky lg:top-24">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-[#b20202]">
        Next action
      </p>
      <h2 className="mt-3 text-lg font-semibold text-gray-900">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-gray-500">{description}</p>
      <div className="mt-5 space-y-3">{children}</div>
      {settings && (
        <div className="mt-6 space-y-3 border-t border-gray-100 pt-5">
          {settings}
        </div>
      )}
    </aside>
  );
}
export function CycleWorkspace({
  header,
  metrics,
  sidebar,
  children,
}: {
  header: ReactNode;
  metrics: ReactNode;
  sidebar: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
      {header}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{metrics}</div>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="order-2 min-w-0 space-y-5 lg:order-1">{children}</div>
        <div className="order-1 min-w-0 lg:order-2">{sidebar}</div>
      </div>
    </div>
  );
}
