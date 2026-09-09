'use client';
import type { DocumentTemplate } from '@/utils/print/templates/registry';
export default function TemplateCard({
  template: t,
  selected,
  onSelect,
}: {
  template: DocumentTemplate;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`group rounded-xl border-2 p-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 ${selected ? 'border-primary bg-primary/5' : 'border-muted bg-white hover:border-gray-400 dark:bg-gray-50'}`}
    >
      <svg
        viewBox="0 0 220 265"
        className="mx-auto max-h-56 w-full rounded border border-gray-100 bg-white shadow-sm"
        aria-hidden="true"
      >
        <rect width="220" height="265" fill="white" />
        <rect width="220" height="64" fill={t.accent} />
        <path d="M128 0H220V64H117Z" fill="#000" opacity="0.48" />
        <path d="M0 65H220" stroke={t.secondary} strokeWidth="2" />
        <text x="14" y="25" fontFamily="sans-serif" fontWeight="bold" fontSize="9" fill="white">
          HARBOUR HOUSE
        </text>
        <path d="M14 34H90 M14 40H81" stroke="white" opacity="0.6" />
        <rect x="14" y="47" width="44" height="9" rx="4" fill="none" stroke="white" opacity="0.6" />
        <text x="21" y="53" fontSize="4" fill="white">
          SALES
        </text>
        <text x="205" y="22" textAnchor="end" fontSize="5" fill="white">
          QUOTATION
        </text>
        <text x="205" y="37" textAnchor="end" fontWeight="bold" fontSize="10" fill="white">
          QT-0042
        </text>
        <rect x="177" y="45" width="28" height="9" rx="4" fill="#e5e7eb" />
        <text x="184" y="51" fontSize="4" fill="#555">
          DRAFT
        </text>
        {[12, 116].map((x) => (
          <g key={x}>
            <rect
              x={x}
              y="78"
              width="92"
              height="34"
              rx="3"
              fill={t.parties === 'cards' ? t.wash : 'white'}
              stroke={t.parties === 'ruled' ? t.accent : 'none'}
            />
            <path
              d={`M${x + 2} 82v26`}
              stroke={x === 12 ? t.accent : t.secondary}
              strokeWidth="2"
            />
            <path
              d={`M${x + 5} 87h46 M${x + 5} 95h65 M${x + 5} 103h38`}
              stroke="#b0b6bd"
              strokeWidth="2"
            />
          </g>
        ))}
        <rect
          x="12"
          y="124"
          width="196"
          height="13"
          fill={t.table === 'plain' ? t.wash : t.accent}
        />
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i}>
            <rect
              x="12"
              y={139 + i * 12}
              width="196"
              height="12"
              fill={i % 2 === 0 ? '#f9fafb' : 'white'}
              stroke={t.table === 'grid' ? '#dddddd' : 'none'}
            />
            <path
              d={`M17 ${145 + i * 12}h86 M166 ${145 + i * 12}h35`}
              stroke="#b0b6bd"
              strokeWidth="2"
            />
          </g>
        ))}
        <rect
          x="122"
          y="212"
          width="86"
          height="20"
          fill={t.totals === 'bar' ? t.accent : 'white'}
          stroke={t.accent}
        />
        <text x="129" y="225" fontSize="7" fill={t.totals === 'bar' ? 'white' : t.accent}>
          TOTAL NGN 285,950
        </text>
        <path d="M12 248H208" stroke={t.secondary} />
      </svg>
      <div className="mt-3 flex items-center justify-between">
        <span className="font-semibold text-gray-900">{t.name}</span>
        <span className="text-xs text-gray-600">{selected ? 'Selected ✓' : 'Choose'}</span>
      </div>
      <p className="mt-1 text-xs leading-5 text-gray-500">{t.description}</p>
    </button>
  );
}
