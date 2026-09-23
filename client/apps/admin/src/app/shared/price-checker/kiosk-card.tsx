'use client';
import Link from 'next/link';
import {
  PiBarcode,
  PiArrowSquareOut,
  PiCopy,
  PiPencilSimple,
  PiMapPin,
  PiChartBar,
} from 'react-icons/pi';
import { kioskUrl } from './form-utils';
import { kioskLabels } from './dashboard-utils';
import type { Kiosk, KioskOptions } from './types';
export function KioskCard({
  kiosk,
  options,
  busy,
  onChange,
  onCopy,
}: {
  kiosk: Kiosk;
  options: KioskOptions | null;
  busy: boolean;
  onChange: (kiosk: Kiosk, remove?: boolean) => void;
  onCopy: (kiosk: Kiosk) => void;
}) {
  const labels = kioskLabels(kiosk, options);
  return (
    <article className="pc-card pc-device" data-enabled={kiosk.enabled}>
      <div className="pc-card-top">
        <span className="pc-device-icon">
          <PiBarcode />
        </span>
        <span className={kiosk.enabled ? 'pc-active' : 'pc-paused'}>
          {kiosk.enabled ? 'Enabled' : 'Disabled'}
        </span>
      </div>
      <h2>{kiosk.name}</h2>
      <p className="pc-device-store">{labels.shop}</p>
      <p className="pc-device-location">
        <PiMapPin aria-hidden="true" />
        {labels.location}
      </p>
      <dl>
        <div>
          <dt>Currency</dt>
          <dd>{kiosk.currency}</dd>
        </div>
        <div>
          <dt>Reset</dt>
          <dd>{kiosk.settings.resetSeconds}s</dd>
        </div>
        <div>
          <dt>Appearance</dt>
          <dd>{kiosk.settings.theme === 'dark' ? 'Dark' : 'Light'}</dd>
        </div>
      </dl>
      <div className="pc-pricing">
        <span>Pricing</span>
        <strong>{labels.pricelist}</strong>
      </div>
      <p className="pc-url" title={kioskUrl(kiosk.slug)}>
        {kiosk.internalId} · {kiosk.slug}
      </p>
      <div className="pc-device-primary">
        <a className="pc-button" href={kioskUrl(kiosk.slug)} target="_blank" rel="noreferrer">
          <PiArrowSquareOut />
          {kiosk.enabled ? 'Open kiosk' : 'Open disabled screen'}
        </a>
        <button
          className="pc-copy"
          onClick={() => onCopy(kiosk)}
          aria-label={`Copy link for ${kiosk.name}`}
          title="Copy kiosk link"
        >
          <PiCopy />
        </button>
      </div>
      <div className="pc-actions pc-device-actions">
        <Link href={`/retail-tools/price-checker/${kiosk._id}/edit`}>
          <PiPencilSimple />
          Configure
        </Link>
        <Link href={`/retail-tools/price-checker/analytics?kiosk=${kiosk._id}`}>
          <PiChartBar />
          Activity
        </Link>
        <details>
          <summary aria-label={`More actions for ${kiosk.name}`}>More</summary>
          <div className="pc-device-menu">
            <button disabled={busy} onClick={() => onChange(kiosk)}>
              {kiosk.enabled ? 'Disable kiosk' : 'Enable kiosk'}
            </button>
            <button className="pc-danger" disabled={busy} onClick={() => onChange(kiosk, true)}>
              Delete kiosk
            </button>
          </div>
        </details>
      </div>
    </article>
  );
}
