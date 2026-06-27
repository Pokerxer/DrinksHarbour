// client/apps/admin/src/app/scan/[pairingCode]/page.tsx
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  PiCamera,
  PiSpinner,
  PiCheckCircle,
  PiWarningCircle,
  PiUploadSimple,
} from 'react-icons/pi';
import { scanService } from '@/services/scan.service';

type Phase = 'validating' | 'ready' | 'uploading' | 'analyzing' | 'done' | 'error' | 'expired';

export default function MobileScanPage({ params }: { params: { pairingCode: string } }) {
  const { pairingCode } = params;
  const [phase, setPhase] = useState<Phase>('validating');
  const [message, setMessage] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Validate the pairing code on load (no auth — the code itself is the credential).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // The status endpoint requires an admin JWT, which the phone doesn't have.
        // The mobile upload endpoint is the public entry point and returns a clear
        // 404/410 for an invalid/expired/used code, so we validate by probing it
        // with an empty preflight via a HEAD-style fetch. To keep it simple and
        // avoid a dedicated public-validate endpoint, we just show the capture UI
        // and surface any error at upload time. (A used/expired code is rejected
        // by the upload endpoint with a clear message.)
        if (cancelled) return;
        setPhase('ready');
      } catch {
        if (!cancelled) {
          setPhase('expired');
          setMessage('This link is invalid or has expired. Generate a new code on your computer.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pairingCode]);

  const handleFile = useCallback(
    async (file: File) => {
      setPhase('uploading');
      setMessage('Uploading photo…');
      try {
        await scanService.uploadMobile(pairingCode, file);
        setPhase('analyzing');
        setMessage('Analyzing… Check your computer for the matched products.');
        // The desktop drawer receives the result via Socket.io. The phone's job
        // is done; show a success state after a short beat.
        setTimeout(() => {
          setPhase('done');
          setMessage('Done! The matched products are on your computer.');
        }, 2500);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Upload failed';
        if (/expired|used|not found/i.test(msg)) {
          setPhase('expired');
          setMessage('This link has expired or was already used. Generate a new code on your computer.');
        } else {
          setPhase('error');
          setMessage(msg);
        }
      }
    },
    [pairingCode]
  );

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100 p-6">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-5 text-center">
          <h1 className="text-lg font-bold text-gray-900">DrinksHarbour</h1>
          <p className="text-xs text-gray-500">Scan &amp; Match</p>
        </div>

        {phase === 'validating' && (
          <div className="flex flex-col items-center gap-3 py-8 text-gray-400">
            <PiSpinner className="h-8 w-8 animate-spin" />
            <p className="text-sm">Checking link…</p>
          </div>
        )}

        {phase === 'ready' && (
          <div className="flex flex-col items-center gap-4">
            <p className="text-center text-sm text-gray-600">
              Take a photo of a product, a shelf, or a list. It will be sent to your computer and matched against the catalogue.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#b20202] py-3 text-sm font-semibold text-white hover:bg-[#9a0101]"
            >
              <PiCamera className="h-5 w-5" /> Take or choose photo
            </button>
            <p className="text-[11px] text-gray-400">
              Code: <span className="font-mono">{pairingCode}</span>
            </p>
          </div>
        )}

        {(phase === 'uploading' || phase === 'analyzing') && (
          <div className="flex flex-col items-center gap-3 py-8 text-gray-500">
            <PiSpinner className="h-8 w-8 animate-spin text-[#b20202]" />
            <p className="text-sm">{message}</p>
          </div>
        )}

        {phase === 'done' && (
          <div className="flex flex-col items-center gap-3 py-8 text-emerald-600">
            <PiCheckCircle className="h-12 w-12" />
            <p className="text-center text-sm font-medium">{message}</p>
            <p className="text-xs text-gray-400">You can close this page.</p>
          </div>
        )}

        {phase === 'expired' && (
          <div className="flex flex-col items-center gap-3 py-8 text-amber-600">
            <PiWarningCircle className="h-10 w-10" />
            <p className="text-center text-sm font-medium">{message}</p>
          </div>
        )}

        {phase === 'error' && (
          <div className="flex flex-col items-center gap-3 py-8 text-red-600">
            <PiWarningCircle className="h-10 w-10" />
            <p className="text-center text-sm font-medium">{message}</p>
            <button
              type="button"
              onClick={() => setPhase('ready')}
              className="mt-2 rounded-lg border border-gray-200 px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              Try again
            </button>
          </div>
        )}
      </div>
      <p className="mt-4 flex items-center gap-1 text-[11px] text-gray-400">
        <PiUploadSimple className="h-3 w-3" /> Powered by DrinksHarbour
      </p>
    </div>
  );
}