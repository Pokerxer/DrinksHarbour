'use client';

import Link from 'next/link';
import {
  PiArrowRight,
  PiArrowsClockwiseDuotone,
  PiArrowsLeftRightDuotone,
  PiSlidersDuotone,
  PiTrashDuotone,
  PiTrayArrowDownDuotone,
  PiTruckDuotone,
} from 'react-icons/pi';

interface OperationTileProps {
  label: string;
  desc: string;
  count: number;
  href: string;
  icon: React.ReactNode;
}

function OperationTile({ label, desc, count, href, icon }: OperationTileProps) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 transition-all hover:border-[#b20202]/30 hover:shadow-md"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 transition-colors group-hover:bg-[#fef2f2] group-hover:text-[#b20202] [&>svg]:h-[22px] [&>svg]:w-[22px]">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gray-800">{label}</p>
        <p className="truncate text-xs text-gray-400">{desc}</p>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-sm font-bold text-gray-700 transition-colors group-hover:bg-[#b20202] group-hover:text-white">
          {count}
        </span>
        <PiArrowRight className="h-4 w-4 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-[#b20202]" />
      </div>
    </Link>
  );
}

function OperationSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 shrink-0 rounded-lg bg-gray-200" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="h-4 w-24 rounded bg-gray-200" />
          <div className="h-3 w-32 rounded bg-gray-200" />
        </div>
      </div>
    </div>
  );
}

interface OperationCounts {
  in: number;
  out: number;
  transfer: number;
  adjustment: number;
  scrap: number;
}

interface OperationsGridProps {
  counts: OperationCounts;
  loading?: boolean;
  hrefs: {
    receipts: string;
    deliveries: string;
    internal: string;
    adjustments: string;
    scrap: string;
    transfers: string;
  };
  icons?: Partial<Record<string, React.ReactNode>>;
}

const OP_CONFIG: Array<{
  key: keyof OperationCounts;
  label: string;
  desc: string;
  hrefKey: keyof OperationsGridProps['hrefs'];
  defaultIcon: React.ReactNode;
}> = [
  { key: 'in', label: 'Receipts', desc: 'Incoming stock', hrefKey: 'receipts', defaultIcon: <PiTrayArrowDownDuotone /> },
  { key: 'out', label: 'Deliveries', desc: 'Outgoing stock', hrefKey: 'deliveries', defaultIcon: <PiTruckDuotone /> },
  { key: 'transfer', label: 'Internal', desc: 'Between warehouses', hrefKey: 'internal', defaultIcon: <PiArrowsClockwiseDuotone /> },
  { key: 'adjustment', label: 'Adjustments', desc: 'Stock corrections', hrefKey: 'adjustments', defaultIcon: <PiSlidersDuotone /> },
  { key: 'scrap', label: 'Scrap', desc: 'Damaged / expired / written off', hrefKey: 'scrap', defaultIcon: <PiTrashDuotone /> },
  { key: 'transfer', label: 'Transfers', desc: 'Planned warehouse transfers', hrefKey: 'transfers', defaultIcon: <PiArrowsLeftRightDuotone /> },
];

export default function OperationsGrid({
  counts,
  loading = false,
  hrefs,
}: OperationsGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <OperationSkeleton key={i} />
        ))}
      </div>
    );
  }

  const tiles = OP_CONFIG.map((cfg) => {
    const count = cfg.key === 'transfer' && cfg.label === 'Transfers'
      ? counts.transfer
      : counts[cfg.key];
    return {
      label: cfg.label,
      desc: cfg.desc,
      count,
      href: hrefs[cfg.hrefKey],
      icon: cfg.defaultIcon,
    };
  });

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {tiles.map((op) => (
        <OperationTile key={op.label} {...op} />
      ))}
    </div>
  );
}
