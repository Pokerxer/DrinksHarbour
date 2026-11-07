'use client';
import { useEffect, useState } from 'react';
import type { Candidate } from '@/services/venue/experience';
import {
  getCostingReadiness,
  listServings,
  saveServing,
  type Serving,
  type ServingMode,
  type CostingReadiness,
} from '@/services/venue/costing';
import { buttonClass, fieldClass, Notice, panelClass } from './controls';
export default function ServingEditor({
  token,
  locationId,
  catalog,
}: {
  token: string;
  locationId: string;
  catalog: Candidate[];
}) {
  const [rows, setRows] = useState<Serving[]>([]);
  const [ready, setReady] = useState<CostingReadiness | null>(null);
  const [selected, setSelected] = useState('');
  const [product, setProduct] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [mode, setMode] = useState<ServingMode>('made_to_order');
  const [saleUnit, setSaleUnit] = useState<Serving['saleUnit']>('plate');
  const [price, setPrice] = useState('');
  const [weight, setWeight] = useState('');
  const [volume, setVolume] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [refreshRequired, setRefreshRequired] = useState(false);
  useEffect(() => {
    let active = true;
    setReady(null);
    setRows([]);
    setError('');
    Promise.all([
      getCostingReadiness(token, locationId),
      listServings(token, locationId),
    ])
      .then(([configuration, result]) => {
        if (active) {
          setReady(configuration);
          setRows(result.items);
        }
      })
      .catch((e) => {
        if (active)
          setError(e instanceof Error ? e.message : 'Unable to load servings');
      });
    return () => {
      active = false;
    };
  }, [token, locationId]);
  const existing = rows.find((row) => row.id === selected);
  const choose = (value: string) => {
    const row = rows.find((item) => item.id === value);
    setSelected(value);
    setProduct(row?.subProductId || '');
    setName(row?.displayName || '');
    setCode(row?.code || '');
    setMode(row?.mode || 'made_to_order');
    setSaleUnit(row?.saleUnit || 'plate');
    setPrice(row?.sellingPrice == null ? '' : String(row.sellingPrice));
    setWeight(row?.weightGrams == null ? '' : String(row.weightGrams));
    setVolume(row?.volumeMl == null ? '' : String(row.volumeMl));
    setMessage('');
  };
  return (
    <section className="space-y-4">
      <div className={panelClass}>
        <h2 className="text-xl font-semibold">Serving definitions</h2>
        <p className="mt-2 text-sm leading-6">
          Give each portion a stable code and its own price and measured size. A
          large plate needs its own reviewed recipe; it is not automatically two
          regular plates.
        </p>
      </div>
      {error && (
        <Notice tone="error" role="alert">
          {error}
          {refreshRequired && (
            <button type="button" className={buttonClass} disabled={busy} onClick={async () => {
              setBusy(true);
              try {
                setRows((await listServings(token, locationId)).items);
                setRefreshRequired(false);
                setError('');
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Unable to reload servings');
              } finally { setBusy(false); }
            }}>Reload servings</button>
          )}
        </Notice>
      )}
      {message && (
        <Notice tone="success" role="status">
          {message}
        </Notice>
      )}
      {ready && !ready.servingsEnabled && (
        <Notice tone="info">
          Serving authoring is inactive until this location’s rollout and
          uniqueness checks are reviewed.
        </Notice>
      )}
      <form
        className={`${panelClass} grid gap-4 sm:grid-cols-2`}
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy || refreshRequired || !ready?.servingsEnabled || !ready.grants.includes('venue:servings_write')) return;
          setBusy(true);
          setError('');
          setMessage('');
          try {
            const input = {
              code,
              displayName: name,
              mode,
              saleUnit,
              sellingPrice: Number(price),
              ...(existing?.servingsPerUnit != null
                ? { servingsPerUnit: existing.servingsPerUnit }
                : {}),
              ...(existing?.costPrice != null
                ? { costPrice: existing.costPrice }
                : {}),
              ...(weight ? { weightGrams: Number(weight) } : {}),
              ...(volume ? { volumeMl: Number(volume) } : {}),
            };
            const result = await saveServing(
              token,
              locationId,
              {
                subProductId: product,
                expectedVersion: existing?.version || 0,
                input,
              },
              existing?.id,
            );
            setSelected(result.id);
            setMessage(
              'Serving saved. Menu publication and physical stock readiness are checked separately.',
            );
            setRefreshRequired(true);
            try {
              setRows((await listServings(token, locationId)).items);
              setRefreshRequired(false);
            } catch {
              setError('Serving saved, but the list could not refresh. Reload servings before making another change.');
            }
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Unable to save serving');
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Existing serving
          <select
            className={fieldClass}
            value={selected}
            onChange={(e) => choose(e.target.value)}
          >
            <option value="">Create a serving</option>
            {rows.map((row) => (
              <option key={row.id} value={row.id}>
                {row.displayName} · {row.code}
              </option>
            ))}
          </select>
        </label>
        <label>
          Item
          <select
            className={fieldClass}
            required
            value={product}
            disabled={!!existing}
            onChange={(e) => setProduct(e.target.value)}
          >
            <option value="">Choose item</option>
            {catalog.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Serving name
          <input
            className={fieldClass}
            required
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          Stable serving code
          <input
            className={fieldClass}
            required
            disabled={!!existing}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            maxLength={50}
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </label>
        <label>
          Preparation
          <select
            className={fieldClass}
            value={mode}
            onChange={(e) => setMode(e.target.value as ServingMode)}
          >
            <option value="made_to_order">Made to order</option>
            <option value="prepared_batch">Prepared in batches</option>
            <option value="sealed">Sealed item</option>
            <option value="pour">Measured pour</option>
          </select>
        </label>
        <label>
          Sale unit
          <select
            className={fieldClass}
            value={saleUnit}
            onChange={(e) => setSaleUnit(e.target.value as Serving['saleUnit'])}
          >
            {[
              'plate', 'portion', 'bowl', 'tray', 'piece', 'bottle', 'glass',
            ].map((unit) => (
              <option key={unit}>{unit}</option>
            ))}
          </select>
        </label>
        <label>
          Selling price (₦)
          <input
            className={fieldClass}
            type="number"
            required
            min="0.01"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </label>
        <label>
          Portion weight (g, optional)
          <input
            className={fieldClass}
            type="number"
            min="0.01"
            step="0.01"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
        </label>
        {mode === 'pour' && (
          <label>
            Pour volume (ml)
            <input
              className={fieldClass}
              type="number"
              required
              min="0.01"
              step="0.01"
              value={volume}
              onChange={(e) => setVolume(e.target.value)}
            />
          </label>
        )}
        <div className="sm:col-span-2">
          <button
            className={buttonClass}
            disabled={
              busy ||
              refreshRequired ||
              !ready?.servingsEnabled ||
              !ready.grants.includes('venue:servings_write')
            }
          >
            Save serving
          </button>
        </div>
      </form>
    </section>
  );
}
