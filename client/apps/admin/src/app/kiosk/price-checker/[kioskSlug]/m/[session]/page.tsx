// client/apps/admin/src/app/kiosk/price-checker/[kioskSlug]/m/[session]/page.tsx
// Phone companion of the kiosk price checker. The customer scans the QR code
// on the kiosk, lands here, and scans bottles with their camera. Each price
// check also reaches the kiosk's comparison tray through the pairing room's
// `kiosk:scan` event (emitted server-side from POST /scan).
'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { PhoneScanner } from '@/components/price-checker/phone-scanner';
import { PhoneResults, type Checked } from '@/components/price-checker/phone-results';
import { openSession, postPhoneScan } from './phone-api';
import '../../kiosk-phone.css';

type Phase = 'opening' | 'live' | 'down';

function readStored(slug: string): Checked[] {
  try {
    const list: unknown = JSON.parse(
      sessionStorage.getItem(`price-checker-phone-${slug}`) || '[]'
    );
    if (!Array.isArray(list)) return [];
    return list
      .filter(
        (row): row is Checked =>
          !!row &&
          typeof row === 'object' &&
          typeof (row as Checked).barcode === 'string' &&
          !!(row as Checked).result
      )
      .slice(0, 12);
  } catch {
    return [];
  }
}

export default function PhonePriceCheckerPage({
  params,
}: {
  params: Promise<{ kioskSlug: string; session: string }>;
}) {
  const [phase, setPhase] = useState<Phase>('opening');
  const [checked, setChecked] = useState<Checked[]>(() => readStored(''));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const sessionData = useRef({ slug: '', session: '' });
  const slugState = useRef('');
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { kioskSlug, session } = await params;
      if (
        kioskSlug.length > 120 ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(kioskSlug) ||
        !/^[a-z0-9-]{10,64}$/.test(session)
      ) {
        if (!cancelled) setPhase('down');
        return;
      }
      sessionData.current = { slug: kioskSlug, session };
      slugState.current = kioskSlug;
      setChecked(readStored(kioskSlug));
      try {
        await openSession(kioskSlug);
        if (!cancelled) setPhase('live');
      } catch {
        if (!cancelled) setPhase('down');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params]);
  const onScan = useCallback(async (code: string) => {
    const { slug, session } = sessionData.current;
    if (!slug) return;
    setBusy(true);
    setError('');
    try {
      const result = await postPhoneScan(slug, code, session);
      setChecked((list) => [{ barcode: code, at: Date.now(), result }, ...list].slice(0, 12));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Check failed');
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    const slug = slugState.current;
    if (!slug) return;
    try {
      sessionStorage.setItem(
        `price-checker-phone-${slug}`,
        JSON.stringify(checked)
      );
    } catch {
      /* private mode — history lives in memory only */
    }
  }, [checked]);
  if (phase === 'down')
    return (
      <main className="phone-page">
        <div className="phone-card">
          <h1>Price checker unavailable</h1>
          <p>Please open this link again from the price checker screen.</p>
        </div>
      </main>
    );
  return (
    <main className="phone-page">
      <div className="phone-card">
        <header className="phone-brand">
          <h1>
            Drinks<span>Harbour</span>
          </h1>
          <p>Scan a bottle to check its price</p>
        </header>
        {phase === 'opening' ? (
          <p role="status">Connecting to the price checker…</p>
        ) : (
          <PhoneScanner
            slug={sessionData.current.slug}
            session={sessionData.current.session}
            onScan={(code) => void onScan(code)}
          />
        )}
        {busy && <p role="status">Checking price…</p>}
        {error && (
          <p role="alert" className="phone-error">
            {error}
          </p>
        )}
        <PhoneResults
          results={checked}
          onUndo={(barcode) =>
            setChecked((list) => list.filter((entry) => entry.barcode !== barcode))
          }
        />
        {!checked.length && phase === 'live' && (
          <p className="phone-toned">Scans appear here as you check bottles.</p>
        )}
      </div>
    </main>
  );
}
