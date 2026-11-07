'use client';
import { useEffect, useRef, useState } from 'react';
import { stockTransferService } from '@/services/stockTransfer.service';
import { requestDocumentExport } from '@/utils/print/document-export';
import { buildSelectedTransfersReport } from './selected-transfers-report';

export default function SelectedTransfersExport({
  selected,
  warehouseId,
  token,
  clear,
}: {
  selected: string[];
  warehouseId: string;
  token: string;
  clear: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  useEffect(() => {
    setBusy(false);
    setError('');
    return () => {
      generation.current += 1;
    };
  }, [warehouseId, token]);
  const print = async () => {
    const current = ++generation.current;
    setBusy(true);
    setError('');
    try {
      // Bound requests so a selection spanning many pages cannot flood the API.
      const documents = [];
      for (let offset = 0; offset < selected.length; offset += 5) {
        const batch = await Promise.all(
          selected
            .slice(offset, offset + 5)
            .map((id) => stockTransferService.get(id, token))
        );
        if (current !== generation.current) return;
        documents.push(
          ...batch.map((result) => {
            if (!result.success)
              throw new Error(
                result.message || 'Unable to load a selected transfer.'
              );
            return result.data;
          })
        );
      }
      requestDocumentExport(
        buildSelectedTransfersReport(documents, warehouseId)
      );
    } catch (reason) {
      if (current === generation.current)
        setError(
          reason instanceof Error
            ? reason.message
            : 'Unable to prepare the combined PDF.'
        );
    } finally {
      if (current === generation.current) setBusy(false);
    }
  };
  return (
    <div className="space-y-2 rounded-xl border border-[#ece4d6] bg-white p-4">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span aria-live="polite">{selected.length} transfers selected</span>
        <button
          type="button"
          onClick={print}
          disabled={busy || !selected.length}
          className="rounded-lg bg-[#b20202] px-3 py-2 font-semibold text-white disabled:opacity-40"
        >
          {busy ? 'Preparing PDF…' : 'Print selected transfers (PDF)'}
        </button>
        <button
          type="button"
          onClick={clear}
          disabled={busy || !selected.length}
          className="underline disabled:opacity-40"
        >
          Clear selection
        </button>
      </div>
      <p className="text-xs text-gray-500">
        Select transfers across pages. The PDF combines all their products after
        returns, using saved costs. Changing filters clears selection.
      </p>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
