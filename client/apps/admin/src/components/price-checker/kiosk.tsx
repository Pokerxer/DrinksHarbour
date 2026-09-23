'use client';
import { useState, type CSSProperties } from 'react';
import { useKiosk } from './use-kiosk';
import { ProductResult } from './product-result';
import { ScannerMark } from './scanner-mark';
import { validBarcode } from './scanner';
import './kiosk.css';
import './kiosk-display.css';
export default function PriceCheckerKiosk({ slug }: { slug: string }) {
  const kiosk = useKiosk(slug);
  const [manual, setManual] = useState(false);
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const { config, screen } = kiosk;
  const settings = config?.settings;
  async function fullscreen() {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
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
          ...(settings?.background ? { '--kiosk-bg': settings.background } : {}),
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
        {config?.store && (
          <div className="kiosk-location">
            {settings?.logo && (
              <img src={settings.logo} alt="Store logo" referrerPolicy="no-referrer" />
            )}
            <span>
              {config.store.name}
              <small>{config.store.location}</small>
            </span>
          </div>
        )}
        {settings?.fullscreen && (
          <button className="kiosk-quiet" onClick={fullscreen} aria-label="Toggle fullscreen">
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
        {screen === 'result' && kiosk.product && config ? (
          <ProductResult product={kiosk.product} config={config} />
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
            {settings?.welcomeMessage && <p className="kiosk-small">{settings.welcomeMessage}</p>}
            {config?.store && (
              <div className="kiosk-store-pill">
                {config.store.name} — {config.store.location}
              </div>
            )}
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
                  screen === 'offline' || !config ? void kiosk.initialize() : kiosk.reset()
                }
              >
                Try again
              </button>
            )}
          </section>
        )}
      </div>
      <footer className="kiosk-footer">
        <div>
          <strong>
            {screen === 'closed'
              ? 'Please ask a member of staff'
              : screen === 'offline'
                ? 'Waiting for connection'
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
        {settings?.manualEntry && !['closed', 'initializing'].includes(screen) && (
          <button
            className="kiosk-quiet"
            onClick={() => {
              setManual(!manual);
              setMessage('');
            }}
          >
            Enter barcode
          </button>
        )}
      </footer>
      {manual && settings?.manualEntry && !['closed', 'initializing'].includes(screen) && (
        <form
          className="kiosk-manual"
          onSubmit={(event) => {
            event.preventDefault();
            const value = validBarcode(code);
            if (!value) {
              setMessage('Enter a barcode of at least 5 characters.');
              return;
            }
            setManual(false);
            setCode('');
            setMessage('');
            void kiosk.scan(value);
          }}
        >
          <label htmlFor="manual-barcode">Product barcode</label>
          <input
            id="manual-barcode"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            maxLength={128}
            autoComplete="off"
            autoFocus
          />
          <button className="kiosk-primary" type="submit">
            Check price
          </button>
          <button className="kiosk-quiet" type="button" onClick={() => setManual(false)}>
            Close
          </button>
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
