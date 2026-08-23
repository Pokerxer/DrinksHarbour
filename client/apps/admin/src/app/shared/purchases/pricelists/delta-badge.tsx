'use client';

import { PiCaretDown, PiCaretUp } from 'react-icons/pi';
import { BIG_JUMP_THRESHOLD } from './helpers';

export default function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null || delta === 0) return null;
  const up = delta > 0;
  const big = Math.abs(delta) >= BIG_JUMP_THRESHOLD;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
        up
          ? big
            ? 'bg-red-100 text-red-600'
            : 'bg-red-50 text-red-500'
          : 'bg-[#3d6b5c]/12 text-[#3d6b5c]'
      }`}
      title={`${up ? 'Up' : 'Down'} ${Math.abs(delta)}% vs previous`}
    >
      {up ? (
        <PiCaretUp className="h-2.5 w-2.5" />
      ) : (
        <PiCaretDown className="h-2.5 w-2.5" />
      )}
      {Math.abs(delta)}%
    </span>
  );
}
