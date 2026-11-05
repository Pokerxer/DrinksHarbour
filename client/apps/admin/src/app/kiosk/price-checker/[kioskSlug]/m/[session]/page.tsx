// client/apps/admin/src/app/kiosk/price-checker/[kioskSlug]/m/[session]/page.tsx
// Phone companion of the kiosk price checker. The customer scans the QR code
// on the kiosk, lands here, and scans bottles with their camera. Each price
// check also reaches the kiosk's comparison tray through the pairing room's
// `kiosk:scan` event (emitted server-side from POST /scan).
'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { PhoneScanner } from '@/components/price-checker/phone-scanner';
import { formatMoney } from '@/components/price-checker/money';
import { openSession, postPhoneScan, type PhoneScanResult } from './phone-api';
import '../../kiosk-phone.css';

type Phase = 'opening' | 'live' | 'down';

interface Checked {
  barcode: string;
  result: PhoneScanResult;
}

export default function PhonePriceCheckerPage({
  params,
}: {
  params: Promise<{ kioskSlug: string; session: string }>;
}) {
  const [phase, setPhase] = useState<Phase>('opening');
  const [checked, setChecked] = useState<Checked[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const sessionData = useRef({
    slug: '',
    session: '',
  });
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
      setChecked((list) => [{ barcode: code, result }, ...list].slice(0, 12));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Check failed');
    } finally {
      setBusy(false);
    }
  }, []);
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
        <ul className="phone-results" aria-label="Scanned bottles">
          {checked.map(({ barcode, result }) =>
            result.found && result.product ? (
              <li className="phone-hit" key={barcode}>
                {result.product.image && (
                  <img src={result.product.image} alt="" referrerPolicy="no-referrer" />
                )}
                <div>
                  <p className="phone-name">{result.product.name}</p>
                  <p className="phone-price">
                    {formatMoney(result.product.price, result.product.currency)}
                  </p>
                  <p className="phone-toned">
                    It is on the price checker screen in front of you.
                  </p>
                </div>
              </li>
            ) : (
              <li className="phone-miss" key={barcode}>
                <p className="phone-name">Barcode {barcode}</p>
                <p className="phone-toned">
                  {result.status === 'UNAVAILABLE'
                    ? 'Not currently on sale — ask a member of staff.'
                    : 'We could not find this barcode — ask a member of staff.'}
                </p>
              </li>
            )
          )}
        </ul>
        {!checked.length && phase === 'live' && (
          <p className="phone-toned">Scans appear here as you check bottles.</p>
        )}
      </div>
    </main>
  );
}
