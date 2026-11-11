'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { PhoneScanner } from '@/components/price-checker/phone-scanner';
import { PhoneResults } from '@/components/price-checker/phone-results';
import { PhoneDetail } from '@/components/price-checker/phone-detail';
import { usePhoneHistory } from '@/components/price-checker/use-phone-history';
import { ProductResult } from '@/components/price-checker/product-result';
import { BottleSuggestions } from '@/components/price-checker/bottle-suggestions';
import { formatMoney } from '@/components/price-checker/money';
import { CompareScreen } from '@/components/price-checker/compare-screen';
import { compareKey, useCompare } from '@/components/price-checker/use-compare';
import { useOfflineBook } from '@/components/price-checker/use-offline';
import type { KioskConfig, KioskProduct } from '@/components/price-checker/types';
import { openSession, postPhoneScan } from './phone-api';

export function Unavailable() {
  return (
    <main className="phone-page">
      <div className="phone-card">
        <h1>Price checker unavailable</h1>
        <p>Open this link again from the price checker screen.</p>
      </div>
    </main>
  );
}

export function PhonePriceChecker({ slug, session }: { slug: string; session: string }) {
  const [config, setConfig] = useState<KioskConfig | null>(null);
  const [down, setDown] = useState(false);
  const [current, setCurrent] = useState<KioskProduct | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [detail, setDetail] = useState<KioskProduct | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [comparing, setComparing] = useState(false);
  const requestInFlight = useRef(false);
  const closeDetail = useCallback(() => setDetail(null), []);
  const history = usePhoneHistory(slug, session);
  const compare = useCompare(`phone-${slug}-${session}`);
  const { book, refresh } = useOfflineBook(slug, Boolean(config));
  const revision = config?.revision;
  const bookRevision = book?.config.revision;

  useEffect(() => {
    if (revision !== undefined && bookRevision !== undefined && revision !== bookRevision) void refresh();
  }, [bookRevision, revision, refresh]);

  useEffect(() => {
    let active = true;
    void openSession(slug).then((next) => {
      if (!active) return;
      if (!next.settings.enablePhoneScan) setDown(true);
      else setConfig(next);
    }).catch(() => { if (active) setDown(true); });
    return () => { active = false; };
  }, [slug]);

  async function onScan(barcode: string) {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await postPhoneScan(slug, barcode, session);
      if (!result.config.settings.enablePhoneScan) {
        setDown(true);
        return;
      }
      setConfig(result.config);
      if (result.found && result.product) {
        setCurrent(result.product);
        history.add({ barcode, product: result.product });
      } else {
        setError(result.status === 'NOT_FOUND' ? result.config.settings.notFoundMessage : 'Price unavailable.');
      }
    } catch {
      setError('Price check is unavailable right now. Try capturing again.');
    } finally {
      requestInFlight.current = false;
      setBusy(false);
    }
  }

  if (down) return <Unavailable />;
  const readyToCompare = Boolean(config?.settings.enableCompare && compare.items.length >= 2);
  const comparingNow = Boolean(comparing && readyToCompare);
  const isSelected = (product: KioskProduct) =>
    compare.items.some((item) => compareKey(item) === compareKey(product));

  function removeFromHistory(barcode: string) {
    const removed = history.entries.find((entry) => entry.barcode === barcode);
    if (current && removed && compareKey(current) === compareKey(removed.product)) setCurrent(null);
    history.remove(barcode);
  }

  return (
    <main className="phone-page" data-theme={config?.settings.theme}
      style={{ '--kiosk-accent': config?.settings.accent || '#b20202' } as React.CSSProperties}>
      <div className="phone-card" inert={Boolean(detail)}>
        <header className="phone-brand">
          <p className="phone-wordmark">Drinks<span>Harbour</span></p>
          {config?.store && <p>{config.store.name} · {config.store.location}</p>}
        </header>
        {!config && <p role="status">Connecting to the price checker…</p>}
        {config && (
          <div className="phone-flow" data-camera-active={cameraActive}>
            <div className="phone-capture">
              <PhoneScanner busy={busy} onCameraChange={setCameraActive}
                onScan={(barcode) => void onScan(barcode)} />
              {busy && <p role="status">Checking price…</p>}
              {error && <p role="alert" className="phone-error">{error}</p>}
              {current && cameraActive && !busy && !error && (
                <p className="phone-last-capture" role="status">
                  {current.name}{current.size ? ` · ${current.size}` : ''} · {formatMoney(current.price, current.currency)}
                </p>
              )}
            </div>
            {comparingNow ? (
              <CompareScreen items={compare.items} currency={config.currency}
                onRemove={(key) => {
                  if (compare.items.length === 2) setComparing(false);
                  compare.remove(key);
                }}
                onClose={() => setComparing(false)} />
            ) : (
              <>
                {current && (
                  <div className="phone-product-focus">
                    <ProductResult key={compareKey(current)} product={current} config={config}
                      compareSlot={config.settings.enableCompare ? {
                        added: isSelected(current),
                        full: !compare.canAdd,
                        onAdd: () => compare.add(current),
                        replaces: !compare.canAdd ? compare.oldest : undefined,
                        onReplace: () => compare.replaceOldestWith(current),
                      } : undefined} />
                  </div>
                )}
                <PhoneResults results={history.entries}
                  onSelect={({ product }) => setDetail(product)}
                  onRemove={removeFromHistory}
                  onClear={() => {
                    history.clear();
                    setCurrent(null);
                  }} />
                {current && (
                  <BottleSuggestions book={book} config={config} product={current}
                    selected={compare.items} canAdd={compare.canAdd}
                    onAdd={compare.add} onView={setDetail} />
                )}
                {config.settings.enableCompare && compare.items.length > 0 && (
                  <section className="phone-selection" aria-label="Bottles to compare">
                    <ul>
                      {compare.items.map((item) => (
                        <li key={compareKey(item)}>
                          <span>{item.name}{item.size ? ` · ${item.size}` : ''}</span>
                          <button type="button" className="phone-quiet-button"
                            aria-label={`Remove ${item.name} from comparison`} onClick={() => compare.remove(compareKey(item))}>
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                    <button type="button" className="phone-start" disabled={!readyToCompare}
                      onClick={() => setComparing(true)}>
                      Compare ({compare.items.length})
                    </button>
                  </section>
                )}
              </>
            )}
          </div>
        )}
      </div>
      {detail && (
        <PhoneDetail product={detail} currency={detail.currency} onClose={closeDetail}
          compareAction={config?.settings.enableCompare ? (
            <button type="button" className="phone-start"
              disabled={isSelected(detail) || !compare.canAdd} onClick={() => compare.add(detail)}>
              {isSelected(detail) ? 'Added to compare' : compare.canAdd ? 'Add to compare' : 'Comparison full'}
            </button>
          ) : undefined} />
      )}
    </main>
  );
}
