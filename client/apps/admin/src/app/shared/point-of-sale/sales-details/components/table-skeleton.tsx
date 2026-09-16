export function TableSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="flex gap-4 border-b border-gray-100 bg-gray-50 px-4 py-3">
        {[100, 60, 80, 160, 70, 40, 70, 70, 70, 80, 70].map((w, i) => (
          <div key={i} className="h-3 animate-pulse rounded bg-gray-200" style={{ width: w, flexShrink: 0 }} />
        ))}
      </div>
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className={`flex gap-4 border-b border-gray-50 px-4 py-3 ${i % 2 === 1 ? 'bg-gray-50/30' : ''}`}>
          {[90, 60, 80, 150, 70, 32, 70, 70, 70, 80, 70].map((w, j) => (
            <div key={j} className="h-3.5 animate-pulse rounded bg-gray-100" style={{ width: w, flexShrink: 0 }} />
          ))}
        </div>
      ))}
    </div>
  );
}