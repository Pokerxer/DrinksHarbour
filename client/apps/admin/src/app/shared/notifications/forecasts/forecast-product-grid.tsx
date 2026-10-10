'use client';
import { useEffect, useState } from 'react';
import type { InsightLine } from '@/services/notificationInsights.service';
import ForecastProductCard from './forecast-product-card';
import ForecastProductModal from './forecast-product-modal';
export default function ForecastProductGrid({
  lines,
  ...options
}: {
  lines: InsightLine[];
  days: number;
  stock: boolean;
  purchase: boolean;
  asOf?: string;
}) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const selected = lines.find((line) => line.key === selectedKey);
  useEffect(() => {
    if (selectedKey && !selected) setSelectedKey(null);
  }, [selectedKey, selected]);
  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {lines.map((line) => (
          <ForecastProductCard
            key={line.key}
            line={line}
            {...options}
            onOpen={() => setSelectedKey(line.key)}
          />
        ))}
      </div>
      {selected && (
        <ForecastProductModal
          line={selected}
          {...options}
          onClose={() => setSelectedKey(null)}
        />
      )}
    </>
  );
}
