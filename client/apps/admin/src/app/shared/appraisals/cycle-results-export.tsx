'use client';
import { useRef, useState } from 'react';
import { fetchCycle } from '@/services/appraisal.service';
import { fetchPeerParticipants } from '@/services/peerAppraisal.service';
export default function CycleResultsExport({
  cycleId,
  disabled = false,
}: {
  cycleId: string;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  async function download() {
    if (lock.current || disabled) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      const [cycle, progress, pdf] = await Promise.all([
        fetchCycle(cycleId),
        fetchPeerParticipants(cycleId),
        import('./cycle-results-pdf'),
      ]);
      pdf
        .buildCycleResultsPdf(cycle, progress)
        .save(pdf.cycleResultsFileName(cycle.name));
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Could not prepare the PDF. Try again.'
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="max-w-sm space-y-2">
      <button
        type="button"
        disabled={busy || disabled}
        onClick={() => void download()}
        className="rounded-xl bg-[#b20202] px-4 py-2 text-xs font-semibold text-white hover:bg-[#960202] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b20202] disabled:opacity-50"
      >
        {busy ? 'Preparing PDF…' : 'Download results PDF'}
      </button>
      {error && (
        <p role="alert" className="text-xs leading-5 text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
