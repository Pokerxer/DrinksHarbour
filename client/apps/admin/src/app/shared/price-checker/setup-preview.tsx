import React from 'react';
import { PiBarcode, PiCheckCircle, PiMapPin } from 'react-icons/pi';
import type { KioskInput, KioskOptions } from './types';
import { kioskUrl } from './form-utils';
export function SetupPreview({ value, options }: { value: KioskInput; options: KioskOptions }) {
  const settings = value.settings || options.defaults;
  const shop = options.shops.find((row) => row._id === value.shopId);
  const location = options.locations.find((row) => row._id === value.location);
  const dark = settings.theme === 'dark';
  return (
    <aside className="pc-setup-aside">
      <div className="pc-preview-caption">
        <span>SCREEN PREVIEW</span>
        <small>Illustration · not live inventory</small>
      </div>
      <div
        className="pc-preview-screen"
        style={{
          background: settings.background || (dark ? '#171717' : '#faf9f6'),
          color: dark ? '#faf9f6' : '#272323',
        }}
      >
        <span className="pc-preview-brand">DrinksHarbour</span>
        <PiBarcode style={{ color: settings.accent || '#b20202' }} aria-hidden="true" />
        <h3>
          Check a<br />
          <span style={{ color: settings.accent || '#b20202' }}>Product Price</span>
        </h3>
        <p>Scan a product barcode</p>
        {settings.welcomeMessage && <small>{settings.welcomeMessage}</small>}
        {settings.displayStoreName && (
          <span className="pc-preview-store">
            {shop?.name || 'Your store'} · {location?.name || 'Your location'}
          </span>
        )}
      </div>
      <section className="pc-card pc-setup-summary">
        <h2>Ready for your counter</h2>
        <p>
          <PiMapPin aria-hidden="true" />
          {location?.name || 'Assign a stock location'}
        </p>
        <p>
          <PiCheckCircle aria-hidden="true" />
          {settings.resetSeconds || 8}s return to welcome
        </p>
        <p>
          <PiCheckCircle aria-hidden="true" />
          {settings.manualEntry ? 'Scanner + manual entry' : 'Scanner input'}
        </p>
        <p className="pc-help">
          After saving, open the kiosk on your display and scan a product to confirm its price.
        </p>
        <p className="pc-url">
          {value.slug ? kioskUrl(value.slug) : 'Choose a URL for this screen'}
        </p>
      </section>
    </aside>
  );
}
