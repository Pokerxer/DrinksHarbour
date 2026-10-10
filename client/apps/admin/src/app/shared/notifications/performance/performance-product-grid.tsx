import { useEffect, useState } from 'react';
import type { InsightLine } from '@/services/notificationInsights.service';
import PerformanceProductCard from './performance-product-card';
import PerformanceProductModal from './performance-product-modal';
export default function PerformanceProductGrid({
  lines,
  stock,
  purchase,
}: {
  lines: InsightLine[];
  stock: boolean;
  purchase: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null),
    line = lines.find((row) => row.key === selected);
  useEffect(() => {
    if (selected && !line) setSelected(null);
  }, [selected, line]);
  return (
    <>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {lines.map((row) => (
          <PerformanceProductCard
            key={row.key}
            line={row}
            onOpen={() => setSelected(row.key)}
          />
        ))}
      </div>
      {line && (
        <PerformanceProductModal
          line={line}
          onClose={() => setSelected(null)}
          stock={stock}
          purchase={purchase}
        />
      )}
    </>
  );
}
