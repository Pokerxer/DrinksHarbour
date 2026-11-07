'use client';
import { useCallback, useRef, useState, type CSSProperties } from 'react';
import { useKiosk } from './use-kiosk';
import { useCompare, compareKey } from './use-compare';
import { usePhonePairing } from './use-phone-pairing';
import { useOfflineBook } from './use-offline';
import { PhonePair } from './phone-pair';
import { ProductResult } from './product-result';
import { CompareTray } from './compare-tray';
import { CompareScreen } from './compare-screen';
import type { KioskProduct } from './types';
import { ScannerMark } from './scanner-mark';
import { validBarcode } from './scanner';
import './kiosk.css';
import './kiosk-display.css';
export default function PriceCheckerKiosk({ slug }: { slug: string }) {
  const offlineBook = useOfflineBook(slug);
  const kiosk = useKiosk(slug, offlineBook.support ?? undefined);
  const compare = useCompare(slug);
  const [manual, setManual] = useState(false);
  const [pairSession] = useState(() => crypto.randomUUID());
  const pairApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [barcodeError, setBarcodeError] = useState('');
  const manualTrigger = useRef<HTMLButtonElement>(null);
  const closeManual = () => {
    setManual(false);
    setBarcodeError('');
    manualTrigger.current?.focus();
  };
  const { config, screen } = kiosk;
  const settings = config?.settings;
  const compareOn = Boolean(settings?.enableCompare && config);
  const showTray = compareOn && config && !['initializing', 'loading', 'compare', 'offline', 'closed'].includes(screen);
  const product = kiosk.product;
  const productAlreadyHeld = Boolean(
    product && compare.items.some((item) => compareKey(item) === compareKey(product))
  );
  // Phone pairing: the QR session id doubles as the socket room name. Only
  // shown while the kiosk is usable; scans land in the comparison tray.
  const pairEnabled = Boolean(
    config?.settings.enablePhoneScan &&
      !['compare', 'initializing', 'offline', 'closed'].includes(screen)
  );
  const pairUrl =
    pairEnabled && typeof window !== 'undefined'
      ? `${window.location.origin}/kiosk/price-checker/${encodeURIComponent(
          slug
        )}/m/${pairSession}`
      : '';
  const onPhoneScan = useCallback(
    (product: KioskProduct) => compare.add(product),
    [compare]
  );
  usePhonePairing(pairUrl ? pairApiUrl : '', pairSession, onPhoneScan);
  async function fullscreen() {
    try {
      if (!document.fullscreenElement)
        await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch {
      setMessage('Use your browser’s fullscreen option to fill this screen.');
    }
  }
  const title =
    screen === 'closed'
      ? 'Kiosk unavailable'
      : screen === 'offline'
        ? 'Connection unavailable'
        : screen === 'missing'
          ? 'Product not recognised'
          : 'Please ask a member of staff';
  const detail =
    screen === 'missing'
      ? settings?.notFoundMessage
      : screen === 'offline'
        ? 'Please try again or ask a staff member for assistance.'
        : 'We cannot display a price for this item here. Please ask a member of staff for assistance.';
  return (
    <div
      className="price-kiosk"
      data-theme={settings?.theme || 'light'}
      style={
        {
          '--kiosk-accent': settings?.accent || '#b20202',
          ...(settings?.background
            ? { '--kiosk-bg': settings.background }
            : {}),
        } as CSSProperties
      }
    >
      <header className="kiosk-header">
        <div className="kiosk-brand">
          <img src="/logo.png" alt="DrinksHarbour" width={46} height={46} />
          <span>
            Drinks<span className="kiosk-brand-accent">Harbour</span>
          </span>
        </div>
        {kiosk.offline && (
          <div className="kiosk-offline-pill" role="status">
            Offline · prices from{' '}
            {offlineBook.book
              ? new Date(offlineBook.book.generatedAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'cache'}
          </div>
        )}
        {config?.store && (
          <div className="kiosk-location">
            {settings?.logo && (
              <img
                src={settings.logo}
                alt="Store logo"
                referrerPolicy="no-referrer"
              />
            )}
            <span>
              {config.store.name}
              <small>{config.store.location}</small>
            </span>
          </div>
        )}
        {settings?.fullscreen && (
          <button
            className="kiosk-quiet"
            onClick={fullscreen}
            aria-label="Toggle fullscreen"
          >
            ⛶ <span>Fullscreen</span>
          </button>
        )}
      </header>
      <div
        className="kiosk-content"
        aria-live="polite"
        aria-atomic="true"
        aria-busy={screen === 'loading' || screen === 'initializing'}
      >
        {screen === 'compare' && config && compare.items.length >= 2 ? (
          <CompareScreen
            items={compare.items}
            currency={config.currency}
            onRemove={compare.remove}
            onClose={kiosk.reset}
          />
        ) : screen === 'result' && kiosk.product && config ? (
          <>
          <ProductResult
            product={kiosk.product}
            config={config}
            compareSlot={
              settings?.enableCompare
                ? {
                    added: productAlreadyHeld,
                    full: !compare.canAdd,
                    onAdd: () => compare.add(kiosk.product as KioskProduct),
                  }
                : undefined
            }
          />
          {pairUrl && (
            <div className="kiosk-result-pair">
              <PhonePair url={pairUrl} />
            </div>
          )}
          </>
        ) : ['idle', 'initializing', 'loading'].includes(screen) ? (
          <section className="kiosk-status">
            <span className="kiosk-eyebrow">Your in-store price guide</span>
            <ScannerMark loading={screen !== 'idle'} />
            <h1>
              {screen === 'loading' ? (
                'Checking product…'
              ) : screen === 'initializing' ? (
                'Getting ready…'
              ) : (
                <>
                  Check a<br />
                  <span>Product Price</span>
                </>
              )}
            </h1>
            <p>
              {screen === 'idle'
                ? 'Scan a product barcode to see its current price'
                : 'Just a moment'}
            </p>
            {settings?.welcomeMessage && (
              <p className="kiosk-small">{settings.welcomeMessage}</p>
            )}
            {config?.store && (
              <div className="kiosk-store-pill">
                {config.store.name} — {config.store.location}
              </div>
            )}
            {pairUrl && <PhonePair url={pairUrl} />}
          </section>
        ) : (
          <section className="kiosk-status">
            <ScannerMark />
            <h1>{title}</h1>
            <p>
              {screen === 'closed'
                ? 'This price checker is currently unavailable. Please ask a member of staff.'
                : detail}
            </p>
            {screen !== 'closed' && (
              <button
                className="kiosk-primary"
                onClick={() =>
                  screen === 'offline' || !config
                    ? void kiosk.initialize()
                    : kiosk.reset()
                }
              >
                Try again
              </button>
            )}
          </section>
        )}
      </div>
      {showTray && config && (
        <CompareTray
          items={compare.items}
          currency={config.currency}
          canAdd={compare.canAdd}
          onRemove={compare.remove}
          onClear={compare.clear}
          onCompare={kiosk.openCompare}
        />
      )}
      <footer className="kiosk-footer">
        <div>
          <strong>
            {screen === 'closed'
              ? 'Please ask a member of staff'
              : screen === 'offline'
                ? 'Waiting for connection'
                : screen === 'compare'
                  ? 'Comparing bottles'
                  : screen === 'idle'
                    ? 'Ready to scan'
                    : 'Scan another product'}
          </strong>
          <span>
            {kiosk.remaining > 0
              ? `Returning to scan screen in ${kiosk.remaining} seconds`
              : 'Hold the barcode under the scanner'}
          </span>
        </div>
        {settings?.manualEntry &&
          !['closed', 'initializing'].includes(screen) && (
            <button
              ref={manualTrigger}
              className="kiosk-quiet"
              aria-expanded={manual}
              aria-controls={manual ? 'manual-entry-form' : undefined}
              onClick={() => {
                setManual(!manual);
                setBarcodeError('');
                setMessage('');
              }}
            >
              Enter barcode
            </button>
          )}
      </footer>
      {manual &&
        settings?.manualEntry &&
        !['closed', 'initializing'].includes(screen) && (
          <form
            id="manual-entry-form"
            className="kiosk-manual"
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                closeManual();
              }
            }}
            onSubmit={(event) => {
              event.preventDefault();
              const value = validBarcode(code);
              if (!value) {
                setBarcodeError(
                  'Enter a barcode of 5 to 128 printable characters.'
                );
                return;
              }
              closeManual();
              setCode('');
              setMessage('');
              void kiosk.scan(value);
            }}
          >
            <label htmlFor="manual-barcode">Product barcode</label>
            <input
              id="manual-barcode"
              value={code}
              onChange={(event) => {
                setCode(event.target.value);
                setBarcodeError('');
              }}
              aria-invalid={barcodeError ? true : undefined}
              aria-describedby={
                barcodeError ? 'manual-barcode-error' : undefined
              }
              maxLength={128}
              autoComplete="off"
              autoFocus
            />
            <button className="kiosk-primary" type="submit">
              Check price
            </button>
            <button className="kiosk-quiet" type="button" onClick={closeManual}>
              Close
            </button>
            {barcodeError && (
              <p
                id="manual-barcode-error"
                className="kiosk-manual-error"
                role="alert"
              >
                {barcodeError}
              </p>
            )}
          </form>
        )}
      {message && (
        <p className="kiosk-notice" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
