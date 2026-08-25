'use client';

import React from 'react';
import { PiTag, PiReceipt, PiSealPercent, PiInfo } from 'react-icons/pi';
import { BRAND } from '@/app/shared/point-of-sale/pricelist-constants';
import type { Pricelist } from './types';

export default function StatsStrip({ rows }: { rows: Pricelist[] }) {
  const totalSelectable = rows.filter((p) => p.isSelectable).length;
  const totalWebsite = rows.filter((p) => p.website).length;
  const currencies = new Set(rows.map((r) => r.currency || 'NGN')).size;

  const stats = [
    { label: 'Total (shown)', value: String(rows.length), icon: <PiTag className="h-4 w-4" /> },
    {
      label: 'Selectable',
      value: String(totalSelectable),
      icon: <PiReceipt className="h-4 w-4" />,
      red: true,
    },
    {
      label: 'With Website',
      value: String(totalWebsite),
      icon: <PiSealPercent className="h-4 w-4" />,
    },
    {
      label: 'Currencies',
      value: String(currencies),
      icon: <PiInfo className="h-4 w-4" />,
    },
  ];

  return (
    <div className="flex shrink-0 divide-x divide-gray-100 border-b border-gray-200 bg-white">
      {stats.map(({ label, value, icon, red }) => (
        <div key={label} className="flex flex-1 items-center gap-3 px-5 py-3">
          <span style={red ? { color: BRAND } : { color: '#9ca3af' }}>{icon}</span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              {label}
            </p>
            <p
              className="text-sm font-bold tabular-nums"
              style={red ? { color: BRAND } : { color: '#111827' }}
            >
              {value}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
