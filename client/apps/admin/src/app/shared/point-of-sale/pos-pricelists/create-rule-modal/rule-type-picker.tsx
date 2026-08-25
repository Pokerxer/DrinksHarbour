'use client';

import { RULE_TYPE_META } from '@/app/shared/point-of-sale/pricelist-constants';

interface MetaEntry {
  label: string;
  color: string;
  bg: string;
  border: string;
  hint?: string;
  modalHint?: string;
}
const META = RULE_TYPE_META as unknown as Record<string, MetaEntry>;

const GLYPH: Record<string, string> = {
  discount: '%',
  flash_sale: '⚡',
  fixed: '₦',
  formula: 'ƒ',
  bundle: '📦',
  cart_threshold: '🛒',
};

export default function RuleTypePicker({
  value,
  onChange,
}: {
  value: string;
  onChange(t: string): void;
}) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">
        Rule Type
      </p>
      <div className="grid grid-cols-6 gap-1.5">
        {Object.entries(META).map(([v, m]) => {
          const active = value === v;
          return (
            <button
              key={v}
              type="button"
              title={m.modalHint || m.hint}
              aria-pressed={active}
              onClick={() => onChange(v)}
              className={`flex flex-col items-center gap-1 rounded-xl border-2 px-1 py-2.5 text-center transition-all ${
                active
                  ? 'shadow-sm'
                  : 'border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-white'
              }`}
              style={active ? { borderColor: m.color, backgroundColor: m.bg } : {}}
            >
              <span
                className="text-base leading-none"
                style={{ color: active ? m.color : '#6b7280' }}
                aria-hidden
              >
                {GLYPH[v] ?? '•'}
              </span>
              <span
                className="text-[10px] font-semibold leading-tight"
                style={{ color: active ? m.color : '#374151' }}
              >
                {m.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
