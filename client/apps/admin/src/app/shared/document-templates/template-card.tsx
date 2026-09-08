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
  const dark = ['classic', 'signature', 'axis'].includes(t.id);
  const centered = t.id === 'atelier';
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
        {dark && (
          <rect
            x={t.id === 'axis' ? 12 : 0}
            y={t.id === 'axis' ? 10 : 0}
            width={t.id === 'axis' ? 68 : 220}
            height="64"
            fill={t.accent}
          />
        )}
        {t.id === 'modern' && <rect width="5" height="64" fill={t.accent} />}
        {t.id === 'blueprint' && (
          <>
            <rect
              x="12"
              y="10"
              width="115"
              height="52"
              fill="none"
              stroke={t.accent}
            />
            <rect
              x="131"
              y="10"
              width="77"
              height="52"
              fill={t.wash}
              stroke={t.accent}
            />
          </>
        )}
        {t.id === 'editorial' && (
          <>
            <path d="M12 9H208 M12 12H208" stroke={t.accent} />
          </>
        )}
        <text
          x={centered ? 110 : t.id === 'axis' ? 90 : 18}
          y="30"
          textAnchor={centered ? 'middle' : 'start'}
          fontFamily={
            t.font === 'times'
              ? 'Georgia'
              : t.font === 'courier'
                ? 'monospace'
                : 'sans-serif'
          }
          fontWeight="bold"
          fontSize="11"
          fill={dark && t.id !== 'axis' ? 'white' : t.accent}
        >
          HARBOUR HOUSE
        </text>
        <text
          x={centered ? 110 : 18}
          y="49"
          textAnchor={centered ? 'middle' : 'start'}
          fontSize="6"
          fill={dark ? 'white' : t.accent}
        >
          QUOTATION · 0042
        </text>
        <path d="M12 67H208" stroke={t.secondary} />
        {[12, 116].map((x) => (
          <g key={x}>
            <rect
              x={x}
              y="78"
              width="92"
              height="34"
              fill={t.parties === 'cards' ? t.wash : 'white'}
              stroke={t.parties === 'ruled' ? t.accent : 'none'}
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
              fill={t.table === 'striped' && i % 2 === 0 ? t.wash : 'white'}
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
        <text
          x="129"
          y="225"
          fontSize="7"
          fill={t.totals === 'bar' ? 'white' : t.accent}
        >
          TOTAL NGN 285,950
        </text>
        <path d="M12 248H208" stroke={t.secondary} />
      </svg>
      <div className="mt-3 flex items-center justify-between">
        <span className="font-semibold text-gray-900">{t.name}</span>
        <span className="text-xs text-gray-600">
          {selected ? 'Selected ✓' : 'Choose'}
        </span>
      </div>
      <p className="mt-1 text-xs leading-5 text-gray-500">{t.description}</p>
    </button>
  );
}
