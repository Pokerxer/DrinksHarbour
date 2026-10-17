'use client';
import Link from 'next/link';
import { PiArrowSquareOut, PiPencilSimple } from 'react-icons/pi';
import { routes } from '@/config/routes';
import type { PricedLine } from './sales-line-types';
/** The picked product's name shown as a link to its SubProduct edit (inventory) page. */
export default function SelectedProductCell({
  line,
  onChange,
}: {
  line: PricedLine;
  onChange: () => void;
}) {
  const href = routes.eCommerce.editSubProduct(line.subProductId);
  return (
    <div className="flex items-start gap-2">
      <div className="min-w-0 flex-1">
        <Link
          href={href}
          target="_blank"
          rel="noreferrer"
          title="Open subproduct inventory"
          className="inline-flex items-center gap-1 text-sm font-medium text-gray-900 hover:text-brand hover:underline"
        >
          <span className="truncate">{line.name}</span>
          <PiArrowSquareOut className="h-3.5 w-3.5 shrink-0 text-gray-400" />
        </Link>
        {line.sku && (
          <p className="mt-0.5 font-mono text-[10px] text-gray-400">
            {line.sku}
          </p>
        )}
        {line.sizeName && (
          <p className="mt-0.5 text-[10px] text-gray-400">
            Size: {line.sizeName}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onChange}
        title="Change product"
        className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
      >
        <PiPencilSimple className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
