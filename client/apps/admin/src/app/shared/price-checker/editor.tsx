'use client';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { priceCheckerApi as api } from '@/services/priceChecker.service';
import { PriceCheckerHeader } from './header';
import { SettingsFields } from './settings-fields';
import { kioskInput } from './form-utils';
import { setupError } from './workflow-utils';
import { IdentityFields } from './identity-fields';
import { SetupPreview } from './setup-preview';
import type { KioskInput, KioskOptions } from './types';
export default function KioskEditor({ id }: { id?: string }) {
  const { data: session, status } = useSession();
  const token = (session?.user as { token?: string })?.token || '';
  const router = useRouter();
  const [options, setOptions] = useState<KioskOptions | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const {
    register,
    watch,
    reset,
    setValue,
    handleSubmit,
    formState: { isDirty },
  } = useForm<KioskInput>();
  useEffect(() => {
    if (!token) return;
    let current = true;
    setOptions(null);
    setError('');
    Promise.all([api.options(token), id ? api.get(id, token) : Promise.resolve(null)])
      .then(([data, kiosk]) => {
        if (!current) return;
        setOptions(data);
        reset(
          kiosk
            ? kioskInput(kiosk)
            : {
                name: '',
                internalId: '',
                slug: '',
                shopId: 'retail',
                location: data.shops[0]?.location || '',
                pricelist: null,
                currency: data.currency,
                mode: 'STORE_ONLY',
                enabled: true,
                settings: data.defaults,
              }
        );
      })
      .catch((e) => {
        if (current) setError(e instanceof Error ? e.message : 'Unable to load kiosk.');
      });
    return () => {
      current = false;
    };
  }, [id, token, reset]);
  const value = watch();
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (isDirty && !savingRef.current) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);
  async function save(data: KioskInput) {
    if (savingRef.current || !options) return;
    const problem = setupError(data, options);
    if (problem) {
      setError(problem);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError('');
    try {
      if (id) await api.update(id, data, token);
      else await api.create(data, token);
      router.push('/retail-tools/price-checker');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save kiosk.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }
  return (
    <div className="pc-admin">
      <PriceCheckerHeader
        title={id ? 'Edit Price Checker' : 'Create Price Checker'}
        subtitle="Connect a customer screen to the right store, stock location and prices."
      />
      {error && (
        <p className="pc-error" role="alert">
          {error}
        </p>
      )}
      {status !== 'loading' && !token ? (
        <p role="alert">Sign in as a tenant administrator to configure a kiosk.</p>
      ) : !options ? (
        <p role="status">
          {error
            ? 'The configuration could not be loaded. Refresh to retry.'
            : 'Loading configuration…'}
        </p>
      ) : (
        <form onSubmit={handleSubmit(save)}>
          <nav className="pc-setup-nav" aria-label="Configuration sections">
            {[
              ['identity', 'Store & pricing'],
              ['display', 'Display'],
              ['behavior', 'Scanner'],
              ['messages', 'Messages'],
              ['branding', 'Branding'],
            ].map(([anchor, label]) => (
              <a href={`#${anchor}`} key={anchor}>
                {label}
              </a>
            ))}
          </nav>
          <div className="pc-setup-layout">
            <fieldset disabled={saving} className="pc-setup-fields">
              {id && (
                <p className="pc-help">
                  Changing the URL slug replaces the kiosk’s address. Update the saved link on your
                  display after saving.
                </p>
              )}
              <IdentityFields
                options={options}
                register={register}
                setValue={setValue}
                watch={watch}
              />
              <SettingsFields register={register} />
            </fieldset>
            <SetupPreview value={value} options={options} />
          </div>
          <div className="pc-save">
            <span className="pc-help">
              {saving
                ? 'Saving configuration…'
                : isDirty
                  ? 'You have unsaved changes'
                  : id
                    ? 'Configuration is up to date'
                    : 'Complete setup, then save your kiosk'}
            </span>
            <Link
              href="/retail-tools/price-checker"
              onClick={(event) => {
                if (saving || (isDirty && !window.confirm('Discard unsaved changes?')))
                  event.preventDefault();
              }}
            >
              Cancel
            </Link>
            <button className="pc-button" disabled={saving} type="submit">
              {saving ? 'Saving…' : 'Save kiosk'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
