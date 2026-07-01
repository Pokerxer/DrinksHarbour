// client/apps/admin/src/app/shared/sales/sales-activity-item.tsx
'use client';

import { PiGearSix, PiChatCircleText, PiNoteBlank } from 'react-icons/pi';
import {
  type SalesActivity,
  initialsFrom,
  timeOf,
  userNameOf,
} from './sales-activity-helpers';

function ChangeMeta({ activity }: { activity: SalesActivity }) {
  const meta = activity.meta;
  if (!meta) return null;

  // Simple field change (e.g. pricelist): meta.from → meta.to
  if (meta.from !== undefined || meta.to !== undefined) {
    return (
      <span className="mt-0.5 inline-flex flex-wrap items-center gap-1 text-xs">
        <span className="text-gray-400 line-through">
          {String(meta.from ?? '—')}
        </span>
        <span className="text-gray-300">→</span>
        <span className="font-medium text-brand">{String(meta.to ?? '—')}</span>
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
