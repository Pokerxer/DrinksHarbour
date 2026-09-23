import type { UseFormRegister, UseFormSetValue, UseFormWatch } from 'react-hook-form';
import type { KioskInput, KioskOptions } from './types';
import { eligiblePricelists, kioskUrl } from './form-utils';
import { suggestedSlug } from './workflow-utils';
export function IdentityFields({
  options,
  register,
  setValue,
  watch,
}: {
  options: KioskOptions;
  register: UseFormRegister<KioskInput>;
  setValue: UseFormSetValue<KioskInput>;
  watch: UseFormWatch<KioskInput>;
}) {
  const shop = watch('shopId'),
    location = watch('location'),
    currency = watch('currency'),
    slug = watch('slug'),
    pricelist = watch('pricelist');
  return (
    <section className="pc-card" id="identity">
      <h2>Store and identity</h2>
      <p>
        Tenant: <strong>{options.tenantName}</strong>
      </p>
      <div className="pc-fields">
        <label>
          Kiosk name
          <input
            required
            maxLength={120}
            {...register('name')}
            placeholder="Maitama price checker"
          />
        </label>
        <label>
          Internal kiosk ID
          <input required maxLength={120} {...register('internalId')} placeholder="MAITAMA_01" />
        </label>
        <label>
          URL slug
          <input
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            maxLength={120}
            {...register('slug')}
            placeholder="maitama-price-checker"
          />
          <button
            className="pc-inline-action"
            type="button"
            onClick={() =>
              setValue('slug', suggestedSlug(watch('name') || ''), { shouldDirty: true })
            }
          >
            Suggest URL from name
          </button>
        </label>
        <label>
          Store
          <select
            required
            {...register('shopId', {
              onChange: (event) => {
                const selected = options.shops.find((row) => row._id === event.target.value);
                setValue('location', selected?.location || '');
                setValue('pricelist', null);
              },
            })}
          >
            {!options.shops.some((row) => row._id === shop) && (
              <option value={shop}>Store unavailable — choose another</option>
            )}
            {options.shops.map((row) => (
              <option key={row._id} value={row._id}>
                {row.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Stock location
          <select required {...register('location')}>
            <option value="">Select a store with a stock location</option>
            {location &&
              !options.locations.some(
                (row) =>
                  row._id === location &&
                  row._id === options.shops.find((item) => item._id === shop)?.location
              ) && <option value={location}>Location unavailable — choose another store</option>}
            {options.locations
              .filter(
                (row) => row._id === options.shops.find((item) => item._id === shop)?.location
              )
              .map((row) => (
                <option key={row._id} value={row._id}>
                  {row.name}
                </option>
              ))}
          </select>
          <span className="pc-help">
            Uses this store’s assigned location. Change the store binding in POS settings if needed.
          </span>
        </label>
        <label>
          Currency
          <select {...register('currency', { onChange: () => setValue('pricelist', null) })}>
            {['NGN', 'USD', 'EUR', 'GBP', 'ZAR', 'KES', 'GHS'].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Active pricelist
          <select {...register('pricelist')}>
            <option value="">Automatic: store → location → default</option>
            {pricelist &&
              !eligiblePricelists(options.pricelists, shop, location, currency).some(
                (row) => row._id === pricelist
              ) && <option value={pricelist}>Pricelist unavailable — choose another</option>}
            {eligiblePricelists(options.pricelists, shop, location, currency).map((row) => (
              <option key={row._id} value={row._id}>
                {row.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Kiosk mode
          <select {...register('mode')}>
            <option value="STORE_ONLY">Store only</option>
            <option value="MARKETPLACE" disabled>
              Marketplace comparison — coming later
            </option>
          </select>
        </label>
      </div>
      <label className="pc-check">
        <input type="checkbox" {...register('enabled')} />
        Kiosk enabled
      </label>
      <p className="pc-url">{slug ? kioskUrl(slug) : 'Your kiosk URL will appear here.'}</p>
    </section>
  );
}
