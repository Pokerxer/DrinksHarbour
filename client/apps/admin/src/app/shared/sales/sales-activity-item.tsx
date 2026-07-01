// client/apps/admin/src/app/shared/sales/sales-activity-item.tsx
'use client';

import { PiGearSix, PiChatCircleText, PiNoteBlank } from 'react-icons/pi';
import {
  type SalesActivity,
  initialsFrom,
  timeOf,
  userNameOf,
} from './sales-activity-helpers';

function renderMetaValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (typeof value === 'object' && 'from' in value && 'to' in value) {
    const obj = value as { from: unknown; to: unknown };
    return `${renderMetaValue(obj.from)} → ${renderMetaValue(obj.to)}`;
  }
  return '—';
}

function ChangeMeta({ activity }: { activity: SalesActivity }) {
  const meta = activity.meta;
  if (!meta) return null;

  // Simple field change (e.g. pricelist): meta.from → meta.to
  if ('from' in meta || 'to' in meta) {
    return (
      <span className="mt-0.5 inline-flex flex-wrap items-center gap-1 text-xs">
        <span className="text-gray-400 line-through">
          {renderMetaValue(meta.from)}
        </span>
        <span className="text-gray-300">→</span>
        <span className="font-medium text-brand">
          {renderMetaValue(meta.to)}
        </span>
      </span>
    );
  }

  // Nested field changes (e.g. totals): { total: { from, to }, untaxed: { from, to } }
  const entries = Object.entries(meta).filter(
    ([key, val]) =>
      key !== 'field' &&
      val !== null &&
      typeof val === 'object' &&
      'from' in val &&
      'to' in val
  );

  if (entries.length > 0) {
    return (
      <span className="mt-0.5 inline-flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
        {entries.map(([key, val]) => (
          <span key={key} className="inline-flex items-center gap-1">
            <span className="text-gray-500 capitalize">{key}:</span>
            <span className="text-gray-400 line-through">
              {renderMetaValue((val as { from: unknown; to: unknown }).from)}
            </span>
            <span className="text-gray-300">→</span>
            <span className="font-medium text-brand">
              {renderMetaValue((val as { from: unknown; to: unknown }).to)}
            </span>
          </span>
        ))}
      </span>
    );
  }

  return null;
}

export default function SalesActivityItem({
  activity,
}: {
  activity: SalesActivity;
}) {
  const isSystem = activity.system || activity.type === 'log';
  const isMessage = activity.type === 'message';
  const userName = userNameOf(activity.createdBy);

  const Icon = isSystem
    ? PiGearSix
    : isMessage
      ? PiChatCircleText
      : PiNoteBlank;
  const iconTint = isSystem
    ? 'bg-gray-100 text-gray-500'
    : isMessage
      ? 'bg-brand/10 text-brand'
      : 'bg-amber-50 text-amber-600';

  return (
    <div className="flex gap-3 py-2.5">
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${iconTint}`}
        aria-hidden
      >
        {isSystem ? <Icon className="h-4 w-4" /> : initialsFrom(userName)}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-gray-800">
            {activity.subject}
          </p>
          <time className="shrink-0 whitespace-nowrap text-[11px] text-gray-400">
            {timeOf(activity.createdAt)}
          </time>
        </div>

        <ChangeMeta activity={activity} />

        {activity.description && (
          <p className="mt-0.5 whitespace-pre-wrap text-xs text-gray-500">
            {activity.description}
          </p>
        )}

        {!isSystem && userName && (
          <p className="mt-0.5 text-[11px] text-gray-400">by {userName}</p>
        )}
      </div>
    </div>
  );
}
