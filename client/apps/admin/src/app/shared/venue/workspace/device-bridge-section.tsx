'use client';
import { useState } from 'react';
import { registerDeviceBridge, revokeDeviceBridge, type BridgeRegistrationDTO } from '@/services/venue/ops';
import { buttonClass, dangerButtonClass, Notice, primaryButtonClass } from './controls';

/**
 * S4 device bridge registration (Task 3): the pull token is minted
 * server-side on the stations.write register route and returned ONCE — only
 * its sha-256 hash is stored on the location profile, so this UI is the only
 * place the token ever exists. Re-registration invalidates the previous
 * token immediately; revoke clears the hash. No runVenueOperation here by
 * design: the raw token must never land in the operation ledger.
 */
export default function DeviceBridgeSection({ token, locationId }: { token: string; locationId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [issued, setIssued] = useState<BridgeRegistrationDTO | null>(null);
  const [copied, setCopied] = useState(false);
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bridge command failed');
    } finally {
      setBusy(false);
    }
  }
  const copy = () => run(async () => {
    if (!issued) return;
    await navigator.clipboard.writeText(issued.token);
    setCopied(true);
  });
  return (
    <section aria-label="Device bridge" className="space-y-3">
      <div className="min-w-0 space-y-1">
        <h2 className="text-xl font-semibold">Device bridge</h2>
        <p className="max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-300">
          The bridge device pulls this location&apos;s pending print jobs with its
          token — the server never connects outward. Registering mints a new
          token and invalidates the previous one immediately.
        </p>
      </div>
      {error && <Notice tone="error" role="alert">{error}</Notice>}
      {issued && (
        <Notice
          tone="info"
          role="status"
          action={
            <button type="button" className={buttonClass} disabled={busy} onClick={() => void copy()}>
              {copied ? 'Copied' : 'Copy token'}
            </button>
          }
        >
          Bridge token (shown once): <code className="break-all font-mono text-xs">{issued.token}</code> — copy it now,
          only its hash is stored and it cannot be retrieved again.
        </Notice>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={primaryButtonClass} disabled={busy} onClick={() => run(async () => { setCopied(false); setIssued(await registerDeviceBridge(token, locationId)); })}>
          Register bridge token
        </button>
        <button type="button" className={dangerButtonClass} disabled={busy} onClick={() => run(async () => { await revokeDeviceBridge(token, locationId); setIssued(null); })}>
          Revoke bridge access
        </button>
      </div>
    </section>
  );
}
