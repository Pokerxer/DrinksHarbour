import { formatMoney } from './money';
import { ScannerMark } from './scanner-mark';
import type { CompareSummary } from './session-summary';
import { buildShareLinks, shareMessage } from './share';
import type { KioskConfig, Screen } from './types';

export function KioskWelcome({ screen, config, summary, onCompare, onCopy }: {
  screen: Screen;
  config: KioskConfig | null;
  summary: CompareSummary | null;
  onCompare: () => void;
  onCopy: () => void;
}) {
  const currency = config?.currency ?? 'NGN';
  const store = config?.store;
  const ready = screen === 'idle';
  return (
    <section className="kiosk-status">
      <ScannerMark loading={!ready} />
      <h1>{ready ? <>Check a<br /><span>Product Price</span></> :
        screen === 'loading' ? 'Checking product…' : 'Getting ready…'}</h1>
      {ready && <p>Scan a product barcode to see its current price</p>}
      {ready && config?.settings.welcomeMessage && (
        <p className="kiosk-small">{config.settings.welcomeMessage}</p>
      )}
      {ready && summary && (
        <div className="kiosk-session" role="status">
          <p>
            Compared {summary.count} bottles · lowest price <strong>{summary.bestName}</strong>
            {summary.saved > 0 &&
              ` · from ${formatMoney(summary.from, currency)} to ${formatMoney(summary.to, currency)}`}
          </p>
          <div className="kiosk-session-share">
            <button className="kiosk-quiet" onClick={onCompare}>Compare again</button>
            <button className="kiosk-quiet" onClick={() => {
              const link = buildShareLinks(shareMessage(summary, store?.name ?? null, currency)).whatsapp;
              if (link) window.open(link, '_blank', 'noopener');
            }}>WhatsApp</button>
            <button className="kiosk-quiet" onClick={() => {
              const link = buildShareLinks(shareMessage(summary, store?.name ?? null, currency)).sms;
              if (link) window.location.href = link;
            }}>SMS</button>
            <button className="kiosk-quiet" onClick={async () => {
              try {
                await navigator.clipboard.writeText(shareMessage(summary, store?.name ?? null, currency));
                onCopy();
              } catch {
                /* Share links remain available when clipboard access is blocked. */
              }
            }}>Copy</button>
          </div>
        </div>
      )}
    </section>
  );
}
