'use client';

import type { InventoryMovement } from '@/services/inventory.service';
import {
  PiBuildings,
  PiCurrencyNgn,
  PiPackage,
  PiStack,
  PiTrayArrowDown,
  PiTruck,
} from 'react-icons/pi';
import { fmtNgn } from './inventory-receipts-support';
import { lineCost } from './inventory-movements-presets';

export interface MoveStats {
  count: number;
  units: number;
  /** Signed net: in/up positive, out/down negative, per qtySign convention. */
  net: number;
  cost: number;
  warehouses: number;
  products: number;
  suppliers: number;
  pos: number;
}

interface SummaryCardsProps {
  presetTitle: string;
  unitsLabel: string;
  showSupplier: boolean;
  stats: MoveStats;
}

export default function SummaryCards({
  presetTitle,
  unitsLabel,
  showSupplier,
  stats,
}: SummaryCardsProps) {
  const netLabel =
    stats.net === 0
      ? 'net \u00b10'
      : `net ${stats.net > 0 ? '+' : '\u2212'}${Math.abs(stats.net).toLocaleString()}`;
  const netCls =
    stats.net > 0
      ? 'text-emerald-600'
      : stats.net < 0
        ? 'text-red-600'
        : 'text-gray-400';

  const cards: {
    label: string;
    value: string;
    icon: React.ReactNode;
    color: string;
    sub: React.ReactNode;
  }[] = [
    {
      label: presetTitle,
      value: stats.count.toLocaleString(),
      icon: <PiTrayArrowDown className="h-4 w-4" />,
      color: 'text-blue-600',
      sub: 'stock-move lines',
    },
    {
      label: unitsLabel,
      value: stats.units.toLocaleString(),
      icon: <PiStack className="h-4 w-4" />,
      color: 'text-emerald-600',
      sub: <span className={netCls}>{netLabel}</span>,
    },
    {
      label: 'Cost Value',
      value: fmtNgn(stats.cost),
      icon: <PiCurrencyNgn className="h-4 w-4" />,
      color: 'text-[#b20202]',
      sub: 'at unit cost',
    },
    {
      label: 'Warehouses',
      value: stats.warehouses.toLocaleString(),
      icon: <PiBuildings className="h-4 w-4" />,
      color: 'text-purple-600',
      sub: 'involved',
    },
    showSupplier
      ? {
          label: 'Suppliers',
          value: stats.suppliers.toLocaleString(),
          icon: <PiTruck className="h-4 w-4" />,
          color: 'text-amber-500',
          sub: `${stats.pos} linked POs`,
        }
      : {
          label: 'Products',
          value: stats.products.toLocaleString(),
          icon: <PiPackage className="h-4 w-4" />,
          color: 'text-amber-500',
          sub: 'distinct products',
        },
  ];

  return (
    <div className="grid shrink-0 grid-cols-5 divide-x divide-gray-200 border-b border-gray-200 bg-white">
      {cards.map(({ label, value, icon, color, sub }) => (
        <div key={label} className="flex items-start gap-3 px-4 py-3">
          <span className={`mt-0.5 ${color}`}>{icon}</span>
          <div className="min-w-0">
            <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              {label}
            </p>
            <p className="mt-0.5 text-sm font-bold tabular-nums text-gray-900">
              {value}
            </p>
            <p className="mt-0.5 truncate text-[10px] text-gray-400">{sub}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function computeMoveStats(
  moves: InventoryMovement[],
  whCellOf: (m: InventoryMovement) => string,
  productLabelOf: (m: InventoryMovement) => string
): MoveStats {
  let units = 0;
  let net = 0;
  let cost = 0;
  for (const m of moves) {
    const q = Math.abs(m.quantity);
    units += q;
    if (m.category === 'in') net += q;
    else if (m.category === 'out') net -= q;
    else if (m.category === 'adjustment')
      net += m.type.endsWith('_in') ? q : -q;
    cost += lineCost(m);
  }
  return {
    count: moves.length,
    units,
    net,
    cost,
    warehouses: new Set(
      moves.map(whCellOf).filter((w) => w !== '\u2014')
    ).size,
    products: new Set(moves.map(productLabelOf)).size,
    suppliers: new Set(
      moves.map((m) => m.supplierName).filter(Boolean)
    ).size,
    pos: new Set(
      moves
        .map((m) => (m.relatedPurchaseOrder as { _id?: string } | undefined)?._id)
        .filter(Boolean)
    ).size,
  };
}
