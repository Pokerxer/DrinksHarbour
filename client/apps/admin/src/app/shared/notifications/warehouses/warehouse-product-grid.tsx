'use client';
import { useEffect, useState } from 'react';
import type { InsightLine } from '@/services/notificationInsights.service';
import WarehouseProductRow from './warehouse-product-row';
import WarehouseProductModal from './warehouse-product-modal';
export default function WarehouseProductGrid({
  lines,
  ...permissions
}: {
  lines: InsightLine[];
  demand: boolean;
  purchase: boolean;
  manageTransfers?: boolean;
  coverDays?: number;
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
          <WarehouseProductRow
            key={line.key}
            line={line}
            onOpen={() => setSelectedKey(line.key)}
          />
        ))}
      </div>
      {selected && (
        <WarehouseProductModal
          line={selected}
          onClose={() => setSelectedKey(null)}
          {...permissions}
        />
      )}
    </>
  );
}
