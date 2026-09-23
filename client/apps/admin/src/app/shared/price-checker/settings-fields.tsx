import type { UseFormRegister } from 'react-hook-form';
import type { KioskInput, KioskSettings } from './types';
type BooleanKey = {
  [K in keyof KioskSettings]: KioskSettings[K] extends boolean ? K : never;
}[keyof KioskSettings];
const toggles: [BooleanKey, string][] = [
  ['displayImages', 'Product images'],
  ['displayTenantName', 'Tenant name'],
  ['displayBrand', 'Brand'],
  ['displaySize', 'Product size'],
  ['displayStockStatus', 'Stock status'],
  ['displayStockQuantity', 'Actual stock quantity'],
  ['displayPromotions', 'Promotional savings'],
  ['displayDiscountPercentage', 'Discount percentage'],
  ['displayStoreName', 'Store and location'],
  ['displayBarcode', 'Barcode'],
  ['manualEntry', 'Manual barcode entry'],
  ['fullscreen', 'Fullscreen button'],
];
export function SettingsFields({ register }: { register: UseFormRegister<KioskInput> }) {
  return (
    <>
      <section className="pc-card" id="display">
        <h2>On the screen</h2>
        <p>Choose what customers can see.</p>
        <div className="pc-toggles">
          {toggles.map(([key, label]) => (
            <label key={key}>
              <input type="checkbox" {...register(`settings.${key}`)} />
              {label}
            </label>
          ))}
        </div>
      </section>
      <section className="pc-card" id="behavior">
        <h2>Scanner behavior</h2>
        <div className="pc-fields">
          <label>
            Return to welcome screen (seconds)
            <input
              type="number"
              step={1}
              min={3}
              max={30}
              required
              {...register('settings.resetSeconds', { valueAsNumber: true })}
            />
          </label>
          <label>
            Out-of-stock products
            <select {...register('settings.outOfStock')}>
              <option value="DISPLAY">Display price and stock status</option>
              <option value="HIDE">Hide the product</option>
              <option value="STAFF_MESSAGE">Show staff assistance message</option>
            </select>
          </label>
        </div>
      </section>
      <section className="pc-card" id="messages">
        <h2>Messages</h2>
        <div className="pc-fields pc-fields-single">
          <label>
            Welcome message
            <textarea maxLength={300} {...register('settings.welcomeMessage')} />
          </label>
          <label>
            Product result message
            <textarea maxLength={300} {...register('settings.resultMessage')} />
          </label>
          <label>
            Unknown barcode message
            <textarea maxLength={300} {...register('settings.notFoundMessage')} />
          </label>
        </div>
      </section>
      <section className="pc-card" id="branding">
        <h2>Branding</h2>
        <div className="pc-fields">
          <label>
            Theme
            <select {...register('settings.theme')}>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          <label>
            Accent color
            <input type="color" {...register('settings.accent')} />
          </label>
          <label>
            Custom background color
            <input
              placeholder="#faf9f6 (blank uses theme)"
              pattern="#[a-fA-F0-9]{6}"
              {...register('settings.background')}
            />
          </label>
          <label>
            Store logo URL
            <input
              type="url"
              pattern="https://.*"
              placeholder="https://…"
              maxLength={2048}
              {...register('settings.logo')}
            />
          </label>
        </div>
        <p className="pc-help">
          DrinksHarbour branding stays visible. Use high-contrast colors for screens viewed from a
          distance.
        </p>
      </section>
    </>
  );
}
