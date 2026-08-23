'use client';

import React from 'react';
import { Title } from 'rizzui';
import cn from '@core/utils/class-names';
import { humanize } from './format';

export function WidgetCard({
  title,
  className,
  children,
  childrenWrapperClass,
}: {
  title?: string;
  className?: string;
  children: React.ReactNode;
  childrenWrapperClass?: string;
}) {
  return (
    <div className={className}>
      {title && (
        <Title
          as="h3"
          className="mb-3.5 text-base font-semibold @5xl:mb-5 4xl:text-lg"
        >
          {title}
        </Title>
      )}
      <div
        className={cn(
          'rounded-lg border border-muted px-5 @sm:px-7 @5xl:rounded-xl',
          childrenWrapperClass
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function Field({
  label,
  value,
}: {
  label: string;
  value?: React.ReactNode;
}) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
        {label}
      </p>
      <p className="break-words text-sm text-gray-700">{value}</p>
    </div>
  );
}

export function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  tone?: string;
}) {
  return (
    <div className="flex justify-between gap-4 text-xs">
      <span className="shrink-0 text-gray-400">{label}</span>
      <span className={cn('text-end font-medium text-gray-700', tone)}>
        {value}
      </span>
    </div>
  );
}

const PAY_STATUS_STYLE: Record<string, string> = {
  paid: 'bg-green-500/10 text-green-600 ring-green-500/20 dark:text-green-400',
  pending:
    'bg-orange-500/10 text-orange-600 ring-orange-500/20 dark:text-orange-400',
  failed: 'bg-red-500/10 text-red-600 ring-red-500/20 dark:text-red-400',
  refunded: 'bg-blue-500/10 text-blue-600 ring-blue-500/20 dark:text-blue-400',
  partially_refunded:
    'bg-purple-500/10 text-purple-600 ring-purple-500/20 dark:text-purple-400',
};

export function PaymentBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'rounded-3xl px-2.5 py-1 text-xs font-medium ring-1 ring-inset',
        PAY_STATUS_STYLE[status] ??
          'bg-gray-500/10 text-gray-600 ring-gray-500/20'
      )}
    >
      {humanize(status)}
    </span>
  );
}

export function LoadingSkeleton() {
  return (
    <div className="animate-pulse @container">
      <div className="mb-6 h-12 rounded bg-gray-100" />
      <div className="@5xl:grid @5xl:grid-cols-12 @5xl:gap-7 @6xl:grid-cols-10 @7xl:gap-10">
        <div className="space-y-4 @5xl:col-span-8 @6xl:col-span-7">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded bg-gray-100" />
          ))}
        </div>
        <div className="space-y-4 pt-8 @5xl:col-span-4 @5xl:pt-0 @6xl:col-span-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded bg-gray-100" />
          ))}
        </div>
      </div>
    </div>
  );
}
