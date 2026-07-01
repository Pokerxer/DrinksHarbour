// client/apps/admin/src/app/shared/sales/sales-activity-composer.tsx
'use client';

import { useState } from 'react';
import { PiPaperPlaneRight, PiSpinner } from 'react-icons/pi';
import toast from 'react-hot-toast';
import { salesOrderService } from '@/services/salesOrder.service';

type ComposerMode = 'note' | 'message';

export default function SalesActivityComposer({
  token,
  orderId,
  onPosted,
}: {
  token: string;
  orderId?: string;
  onPosted: () => void;
}) {
  const [mode, setMode] = useState<ComposerMode>('note');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const disabled = !orderId || !text.trim() || busy;

  async function handleSubmit() {
    if (!orderId || !text.trim()) return;
    const trimmed = text.trim();
    const newlineIdx = trimmed.indexOf('\n');
    const subject = newlineIdx === -1 ? trimmed : trimmed.slice(0, newlineIdx);
    const description = newlineIdx === -1 ? undefined : trimmed.slice(newlineIdx + 1).trim();

    setBusy(true);
    try {
      await salesOrderService.createActivity(
        orderId,
        { type: mode, subject, description: description || undefined },
        token
      );
      setText('');
      onPosted();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to post');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-2.5">
      <div className="mb-2 inline-flex rounded-lg bg-white p-0.5 ring-1 ring-gray-100">
        {(['note', 'message'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              mode === m ? 'bg-brand text-white' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {m === 'note' ? 'Log note' : 'Send message'}
          </button>
        ))}
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        placeholder={
          orderId
            ? mode === 'note'
              ? 'Log an internal note…'
              : 'Send a message…'
            : 'Save first to add notes'
        }
        disabled={!orderId || busy}
        className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none placeholder:text-gray-400 focus:border-brand focus:ring-1 focus:ring-brand disabled:bg-gray-100"
      />

      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? (
            <PiSpinner className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <PiPaperPlaneRight className="h-3.5 w-3.5" />
          )}
          {mode === 'note' ? 'Log' : 'Send'}
        </button>
      </div>
    </div>
  );
}
