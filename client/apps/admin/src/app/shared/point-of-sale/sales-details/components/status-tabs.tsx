export function StatusTabs({
  statusFilter,
  setStatusFilter,
  statusCounts,
}: {
  statusFilter: 'all' | 'active' | 'voided';
  setStatusFilter: (s: 'all' | 'active' | 'voided') => void;
  statusCounts: { all: number; active: number; voided: number };
}) {
  return (
    <div className="flex rounded-xl border border-gray-200 bg-gray-50 p-0.5">
      {(['all', 'active', 'voided'] as const).map((s) => {
        const active = statusFilter === s;
        return (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`flex items-center gap-2 rounded-[10px] px-4 py-1.5 text-xs font-semibold transition-all ${
              active
                ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200/60'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {s === 'all' ? 'All' : s === 'active' ? 'Active' : 'Voided'}
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums leading-none transition-colors ${
                active
                  ? s === 'voided'
                    ? 'bg-red-100 text-red-600'
                    : 'bg-[#b20202]/10 text-[#b20202]'
                  : 'bg-gray-200 text-gray-400'
              }`}
            >
              {statusCounts[s]}
            </span>
          </button>
        );
      })}
    </div>
  );
}