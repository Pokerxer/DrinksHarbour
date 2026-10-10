'use client';
import { useEffect, useState } from 'react';
import type { InsightLine } from '@/services/notificationInsights.service';
import type { Selection, Selections } from '../vendor-orders/order-draft';
import type { RestockRow } from './restock-rules';
import RestockProductCard from './restock-product-card';
import RestockProductModal from './restock-product-modal';
export default function RestockProductGrid({
  lines,
  allLines,
  selections,
  onChange,
  stock,
  demand,
}: {
  lines: RestockRow[];
  allLines: InsightLine[];
  selections: Selections;
  onChange: (key: string, choice: Selection) => void;
  stock: boolean;
  demand: boolean;
}) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const selected = allLines.find((line) => line.key === selectedKey);
  useEffect(() => {
    if (selectedKey && !selected) setSelectedKey(null);
  }, [selectedKey, selected]);
  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {lines.map((line) => (
          <RestockProductCard
            key={line.key}
            line={line}
            stock={stock}
            onOpen={() => setSelectedKey(line.key)}
          />
        ))}
      </div>
      {selected && (
        <RestockProductModal
          line={selected}
          stock={stock}
          demand={demand}
          selection={selections[selected.key]}
          onChange={(choice) => onChange(selected.key, choice)}
          onClose={() => setSelectedKey(null)}
        />
      )}
    </>
  );
}
