'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Modal } from 'rizzui';
import { createPeerCycle } from '@/services/peerAppraisal.service';
export default function CreatePeerCycle() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        New colleague bonus cycle
      </Button>
      <Modal
        isOpen={open}
        onClose={() => {
          if (!busy) setOpen(false);
        }}
        size="md"
      >
        <form
          className="space-y-5 p-6"
          onSubmit={async (e) => {
            e.preventDefault();
            if (lock.current || !name.trim()) return;
            lock.current = true;
            setBusy(true);
            setError('');
            try {
              const c = await createPeerCycle(name.trim());
              router.push(`/appraisals/cycles/${c._id}`);
              setOpen(false);
            } catch (e) {
              setError(
                e instanceof Error ? e.message : 'Could not create cycle.'
              );
            } finally {
              setBusy(false);
              lock.current = false;
            }
          }}
        >
          <h2 className="text-xl font-semibold">New colleague bonus cycle</h2>
          <p className="text-sm text-gray-500">
            Each employee rates everyone else from 1–5. Set each employee’s
            bonus allocation before launching.
          </p>
          <label className="block text-sm">
            Cycle name
            <input
              required
              maxLength={200}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-2 w-full rounded-lg border p-3"
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          <div className="flex gap-3">
            <Button type="submit" disabled={busy || !name.trim()}>
              Create cycle
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
