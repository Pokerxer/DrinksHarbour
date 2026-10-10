'use client';
import { useId, useRef, useState } from 'react';
import Link from 'next/link';
import { PiInfo, PiPrinter, PiReceipt, PiX } from 'react-icons/pi';
import type { InventoryMovement } from '@/services/inventory.service';
import { requestDocumentExport } from '@/utils/print/document-export';
import { buildMovementDocument, movementDocumentLinks } from './inventory-movement-document';
import { movementDetails } from './inventory-movement-detail-data';
import { referenceLabel } from './inventory-receipts-support';
import { STATUS_CLS } from './inventory-movements-presets';
import MovementDetailContent from './inventory-movement-detail-content';
import MovementDocumentPreview from './inventory-movement-document-preview';
type Props = { move: InventoryMovement; docTitle: string; onClose: () => void };
export default function MoveDetail(props: Props) {
  return <MovementPanel key={props.move._id} {...props} />;
}
function MovementPanel({ move, docTitle, onClose }: Props) {
  const [tab, setTab] = useState<'details' | 'document'>('details');
  const id = useId();
  const tabs = useRef<HTMLDivElement>(null);
  const detail = movementDetails(move),
    document = buildMovementDocument(move, docTitle),
    links = movementDocumentLinks(move);
  const print = () => requestDocumentExport(document);
  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="break-words text-sm font-bold text-gray-900">
              {referenceLabel(move)}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${STATUS_CLS[move.status] || STATUS_CLS.cancelled}`}
            >
              {move.status}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-gray-400">Recorded {detail.recorded}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={print}
            aria-label={`Print ${docTitle.toLowerCase()}`}
            title="Print / PDF"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-[#b20202]"
          >
            <PiPrinter className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close details"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-50"
          >
            <PiX className="h-5 w-5" />
          </button>
        </div>
      </header>
      {!!links.length && (
        <nav
          aria-label="Original documents"
          className="flex flex-wrap gap-3 border-b border-gray-100 px-5 py-3"
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-xs font-semibold text-[#b20202] hover:underline"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}
      <div
        ref={tabs}
        role="tablist"
        aria-label="Movement view"
        className="flex shrink-0 border-b border-gray-100 text-xs font-semibold"
      >
        {(
          [
            { id: 'details', label: 'Details', icon: PiInfo },
            { id: 'document', label: 'Document', icon: PiReceipt },
          ] as const
        ).map((item, index) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`${id}-${item.id}`}
            aria-controls={`${id}-panel`}
            aria-selected={tab === item.id}
            tabIndex={tab === item.id ? 0 : -1}
            onClick={() => setTab(item.id)}
            onKeyDown={(event) => {
              if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
                event.preventDefault();
                const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : 1 - index;
                setTab(next === 0 ? 'details' : 'document');
                tabs.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
              }
            }}
            className={`flex flex-1 items-center justify-center gap-1.5 border-b-2 py-2.5 ${tab === item.id ? 'border-[#b20202] text-[#b20202]' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
          >
            <item.icon className="h-3.5 w-3.5" />
            {item.label}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`${id}-panel`}
        aria-labelledby={`${id}-${tab}`}
        className="flex min-h-0 flex-1 flex-col"
      >
        {tab === 'details' ? (
          <MovementDetailContent move={move} />
        ) : (
          <MovementDocumentPreview document={document} print={print} />
        )}
      </div>
    </div>
  );
}
