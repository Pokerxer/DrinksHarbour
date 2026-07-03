'use client';

import React from 'react';
import * as Icon from 'react-icons/pi';
import type { WalletTransaction } from '../_types';
import { fmtNgn, fmtDateTime } from './format';

const TYPE_META: Record<string, { label: string; color: string; icon: any; sign: string }> = {
  credit:     { label: 'Credit',     color: 'text-green-700 bg-green-50',     icon: Icon.PiArrowDownLeftBold, sign: '+' },
  debit:      { label: 'Debit',      color: 'text-red-700 bg-red-50',          icon: Icon.PiArrowUpRightBold, sign: '-' },
  refund:     { label: 'Refund',     color: 'text-blue-700 bg-blue-50',        icon: Icon.PiArrowCounterClockwiseBold, sign: '+' },
  adjustment: { label: 'Adjustment', color: 'text-amber-700 bg-amber-50',      icon: Icon.PiGearBold, sign: '+' },
};

export default function WalletTransactionList({ items, loading }: { items: WalletTransaction[]; loading: boolean }) {
  if (loading && items.length === 0) {
    return (
      <div className="p-6 space-y-3">
        {[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-stone-100 animate-pulse rounded-xl" />)}
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="p-10 text-center">
        <Icon.PiReceiptBold size={36} className="mx-auto text-stone-200 mb-3" />
        <p className="font-semibold text-stone-700 mb-1">No transactions yet</p>
        <p className="text-sm text-stone-400">Your wallet activity will appear here.</p>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-stone-100">
      {items.map(t => {
        const meta = TYPE_META[t.type] || TYPE_META.adjustment;
        return (
          <li key={t._id} className="px-6 py-3.5 flex items-center gap-4 hover:bg-stone-50/60 transition-colors">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${meta.color}`}>
              <meta.icon size={15} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-stone-800 truncate">
                {t.reason || meta.label}
                {t.reference && <span className="ml-2 text-xs text-stone-400">· {t.reference}</span>}
              </p>
              <p className="text-xs text-stone-400">{fmtDateTime(t.createdAt)} · {meta.label}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className={`text-sm font-black ${t.type === 'debit' ? 'text-red-700' : 'text-green-700'}`}>
                {meta.sign}{fmtNgn(t.amount)}
              </p>
              <p className="text-xs text-stone-400">Bal {fmtNgn(t.balanceAfter)}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}