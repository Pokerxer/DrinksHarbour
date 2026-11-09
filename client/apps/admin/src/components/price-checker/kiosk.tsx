'use client';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useKiosk } from './use-kiosk';
import { useCompare, compareKey } from './use-compare';
import { usePhonePairing } from './use-phone-pairing';
import { useOfflineBook } from './use-offline';
import { compareSummary, type CompareSummary } from './session-summary';
import { useStaleSession, COMPARE_MS, IDLE_MS } from './use-idle-timer';
import { formatMoney } from './money';
import { LANGUAGES, LanguageProvider, useCopy, type Language } from './copy';
import { PhonePair } from './phone-pair';
import { ProductResult } from './product-result';
import { CompareTray } from './compare-tray';
import { CompareScreen } from './compare-screen';
import type { KioskProduct } from './types';
import { ScannerMark } from './scanner-mark';
import { validBarcode } from './scanner';
import './kiosk.css';
import './kiosk-display.css';
import './kiosk-motion.css';

const LANG_KEY = (slug: string) => `price-checker-lang-${slug}`;

function readStoredLang(slug: string): Language | null {
  try {
    const value = sessionStorage.getItem(LANG_KEY(slug));
    return value === 'en' || value === 'ha' || value === 'pig' ? value : null;
  } catch {
    return null;
  }
}

export default function PriceCheckerKiosk({ slug }: { slug: string }) {
  const offlineBook = useOfflineBook(slug);
  const kiosk = useKiosk(slug, offlineBook.support ?? undefined);
  const compare = useCompare(slug);
  const [langOverride, setLangOverride] = useState<Language | null>(() =>
    readStoredLang(slug)
  );
  const lang = langOverride ?? kiosk.config?.settings.language ?? 'en';
  const cycleLanguage = useCallback(() => {
    const next = LANGUAGES[(LANGUAGES.findIndex((row) => row.id === lang) + 1) % LANGUAGES.length]
      .id;
    setLangOverride(next);
    try {
      sessionStorage.setItem(LANG_KEY(slug), next);
    } catch {
      /* private mode — language lives in memory only */
    }
  }, [lang, slug]);
  return (
    <LanguageProvider lang={lang}>
      <KioskScreen
        slug={slug}
        kiosk={kiosk}
        compare={compare}
        offline={offlineBook.book}
        lang={lang}
        onCycleLanguage={cycleLanguage}
      />
    </LanguageProvider>
  );
}

interface KioskScreenProps {
  slug: string;
  kiosk: ReturnType<typeof useKiosk>;
  compare: ReturnType<typeof useCompare>;
  offline: ReturnType<typeof useOfflineBook>['book'];
  lang: Language;
  onCycleLanguage: () => void;
}

function KioskScreen({
  kiosk,
  compare,
  offline,
  lang,
  onCycleLanguage,
  slug,
}: KioskScreenProps) {
  const { t } = useCopy();
  const [summary, setSummary] = useState<CompareSummary | null>(null);
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
  const closeCompare = useCallback(() => {
    if (compare.items.length >= 2) setSummary(compareSummary(compare.items));
    kiosk.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compare.items, kiosk]);
  // Any new scan or tray change wipes a stale recap immediately.
  useEffect(() => {
    if (screen !== 'idle' && screen !== 'compare') setSummary(null);
  }, [screen, compare.items.length]);
  // Customer-walked-away guard: wipe tray + recap after inactivity so the
  // next customer never sees the last one's prices. Idle-stale keeps the
  // offline scan queue (server telemetry, not customer data).
  const holdContent =
    Boolean(config) &&
    (screen !== 'idle' || compare.items.length > 0 || summary !== null);
  useStaleSession(
    holdContent ? `${screen}:${compare.items.length}:${summary ? 1 : 0}` : '',
    () => {
      compare.clear();
      setSummary(null);
      kiosk.reset();
    },
    { timeoutMs: screen === 'compare' ? COMPARE_MS : IDLE_MS, enabled: holdContent }
  );
  // Phone pairing: the QR session id doubles as the socket room name.
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
    (scanned: KioskProduct) => compare.add(scanned),
    [compare]
  );
  usePhonePairing(pairUrl ? pairApiUrl : '', pairSession, onPhoneScan);
  async function fullscreen() {
    try {
      if (!document.fullscreenElement)
        await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch {
      setMessage(t('fullscreenFallback'));
    }
  }
  const title =
    screen === 'closed'
      ? t('closedTitle')
      : screen === 'offline'
        ? t('offlineTitle')
        : screen === 'missing'
          ? t('missingTitle')
          : t('staffTitle');
  const detail =
    screen === 'missing'
      ? settings?.notFoundMessage
      : screen === 'offline'
        ? t('offlineBody')
        : t('staffBody');
  const money = (value: number) => formatMoney(value, config?.currency ?? 'NGN');
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
            {t('offlinePill', {
              time: offline
                ? new Date(offline.generatedAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '—',
            })}
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
        <button
          className="kiosk-quiet kiosk-lang"
          aria-label={t('language')}
          title={t('language')}
          onClick={onCycleLanguage}
        >
          {lang.toUpperCase()}
        </button>
        {settings?.fullscreen && (
          <button
            className="kiosk-quiet"
            onClick={fullscreen}
            aria-label={t('fullscreen')}
          >
            ⛶ <span>{t('fullscreen')}</span>
          </button>
        )}
      </header>
      <div
        className="kiosk-content"
        data-attract={screen === 'idle' ? 'true' : undefined}
        aria-live="polite"
        aria-atomic="true"
        aria-busy={screen === 'loading' || screen === 'initializing'}
      >
        {screen === 'compare' && config && compare.items.length >= 2 ? (
          <CompareScreen
            items={compare.items}
            currency={config.currency}
            onRemove={compare.remove}
            onClose={closeCompare}
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
            <span className="kiosk-eyebrow">{t('idleEyebrow')}</span>
            <ScannerMark loading={screen !== 'idle'} />
            <h1>
              {screen === 'loading' ? (
                t('loading')
              ) : screen === 'initializing' ? (
                t('initializing')
              ) : (
                <>
                  {t('titleLine1')}
                  <br />
                  <span>{t('titleLine2')}</span>
                </>
              )}
            </h1>
            <p>
              {screen === 'idle' ? t('idlePrompt') : t('justMoment')}
            </p>
            {settings?.welcomeMessage && (
              <p className="kiosk-small">{settings.welcomeMessage}</p>
            )}
            {config?.store && (
              <div className="kiosk-store-pill">
                {config.store.name} — {config.store.location}
              </div>
            )}
            {summary && (
              <div className="kiosk-session" role="status">
                <p>
                  {t('recapIntro', { n: summary.count })} ·{' '}
                  {t('recapBest', { name: summary.bestName })}
                  {summary.saved > 0 &&
                    ` · ${t('recapBand', {
                      from: money(summary.from),
                      to: money(summary.to),
                    })}`}
                </p>
                <button className="kiosk-quiet" onClick={kiosk.openCompare}>
                  {t('recapAgain')}
                </button>
              </div>
            )}
            {pairUrl && <PhonePair url={pairUrl} />}
          </section>
        ) : (
          <section className="kiosk-status">
            <ScannerMark />
            <h1>{title}</h1>
            <p>
              {screen === 'closed' ? t('closedBody') : detail}
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
                {t('tryAgain')}
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
          onScanAgain={kiosk.reset}
          onCompare={kiosk.openCompare}
          onHoldClear={compare.clear}
        />
      )}
      <footer className="kiosk-footer">
        <div>
          <strong>
            {screen === 'closed'
              ? t('footerStaff')
              : screen === 'offline'
                ? t('footerWaiting')
                : screen === 'compare'
                  ? t('footerComparing')
                  : screen === 'idle'
                    ? t('footerReady')
                    : t('footerAnother')}
          </strong>
          <span>
            {kiosk.remaining > 0
              ? t('footerCountdown', { n: kiosk.remaining })
              : t('footerScanHold')}
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
              {t('manualEntry')}
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
                setBarcodeError(t('manualError'));
                return;
              }
              closeManual();
              setCode('');
              setMessage('');
              void kiosk.scan(value);
            }}
          >
            <label htmlFor="manual-barcode">{t('manualLabel')}</label>
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
              {t('checkPrice')}
            </button>
            <button className="kiosk-quiet" type="button" onClick={closeManual}>
              {t('close')}
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
