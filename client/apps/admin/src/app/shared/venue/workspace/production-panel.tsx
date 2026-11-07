'use client';
import { useEffect, useState } from 'react';
import {
  listProduction,
  createProduction,
  productionCommand,
  type ProductionRow,
} from '@/services/venue/costing';
import { getRecipes, type RecipeGroupDTO } from '@/services/venue/recipes';
import type { Candidate } from '@/services/venue/experience';
import { costMoney } from './cost-status';
import { buttonClass, fieldClass, Notice, panelClass } from './controls';
export default function ProductionPanel({
  token,
  locationId,
  catalog = [],
}: {
  token: string;
  locationId: string;
  catalog?: Candidate[];
}) {
  const [rows, setRows] = useState<ProductionRow[]>([]);
  const [recipes, setRecipes] = useState<RecipeGroupDTO[]>([]);
  const [recipe, setRecipe] = useState('');
  const [planned, setPlanned] = useState('');
  const [actual, setActual] = useState('');
  const [reason, setReason] = useState('');
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const validActual = Number.isInteger(Number(actual)) && Number(actual) >= 1 && Number(actual) <= 100;
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    Promise.all([
      listProduction(token, locationId),
      getRecipes(token, locationId),
    ])
      .then(([jobs, versions]) => {
        if (active) {
          setRows(jobs.items);
          setRecipes(versions.items);
        }
      })
      .catch((e) => {
        if (active)
          setError(
            e instanceof Error ? e.message : 'Unable to load production',
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token, locationId]);
  const run = async (
    row: ProductionRow,
    action: 'reserve' | 'complete' | 'cancel',
  ) => {
    if (busy || (action === 'complete' && !failed && !validActual)) return;
    setBusy(true);
    setError('');
    try {
      const body =
        action === 'complete'
          ? {
              actualOutput: {
                amountScaled: failed ? 0 : Number(actual),
                scale: 1 as const,
                unit: 'count' as const,
              },
              waste: {
                classification: failed
                  ? ('abnormal' as const)
                  : ('normal' as const),
                reason,
              },
            }
          : action === 'cancel'
            ? { reason }
            : undefined;
      const updated = await productionCommand(
        token,
        locationId,
        row,
        action,
        body,
      );
      setRows((previous) =>
        previous.map((item) => (item.id === row.id ? updated : item)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update production');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="space-y-4">
      <div className={panelClass}>
        <h2 className="text-xl font-semibold">Batch preparation</h2>
        <p className="mt-2 text-sm leading-6">
          Reserve ingredients, measure the usable portions, then complete the
          batch. Source stock and cost move together. A shortage keeps the batch
          reserved for review.
        </p>
      </div>
      {error && (
        <Notice tone="error" role="alert">
          {error}
        </Notice>
      )}
      {loading && <p role="status">Loading production…</p>}
      <form
        className={`${panelClass} flex flex-wrap items-end gap-3`}
        onSubmit={async (e) => {
          e.preventDefault();
          const selected = recipes.find(
            (group) => group.activeVersion?.id === recipe,
          );
          if (!selected?.activeVersion) return;
          setBusy(true);
          setError('');
          try {
            const row = await createProduction(token, locationId, {
              subProductId: selected.subProductId,
              sizeId: selected.sizeId,
              recipeVersionId: recipe,
              expectedOutput: {
                amountScaled: Number(planned),
                scale: 1,
                unit: 'count',
              },
            });
            setRows((previous) => [row, ...previous]);
          } catch (e) {
            setError(
              e instanceof Error ? e.message : 'Unable to create production',
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Reviewed serving recipe
          <select
            className={fieldClass}
            value={recipe}
            onChange={(e) => setRecipe(e.target.value)}
            required
          >
            <option value="">Choose recipe</option>
            {recipes
              .filter((group) => group.activeVersion)
              .map((group) => (
                <option
                  key={group.activeVersion!.id}
                  value={group.activeVersion!.id}
                >
                  {catalog.find((item) => item.id === group.subProductId)
                    ?.name || 'Serving'}{' '}
                  · version {group.activeVersion!.version}
                </option>
              ))}
          </select>
        </label>
        <label>
          Planned portions
          <input
            className={fieldClass}
            type="number"
            min="1"
            max="100"
            step="1"
            required
            value={planned}
            onChange={(e) => setPlanned(e.target.value)}
          />
        </label>
        <button className={buttonClass} disabled={busy || loading || !recipe}>
          Create preparation batch
        </button>
      </form>
      {rows.some((row) => row.state === 'reserved') && (
        <div className={`${panelClass} space-y-3`}>
          <label>
            Measured usable portions
            <input
              className={fieldClass}
              type="number"
              min="0"
              max="100"
              step="1"
              disabled={failed}
              value={actual}
              onChange={(e) => setActual(e.target.value)}
            />
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={failed}
              onChange={(e) => setFailed(e.target.checked)}
            />
            Failed batch: record all inputs as reviewed waste
          </label>
          <p className="text-sm">
            Completing consumes the batch’s reserved inputs once and receives
            the measured portions. Failed batches receive no output.
          </p>
        </div>
      )}
      <label className="block">
        Production or cancellation note
        <input
          className={fieldClass}
          maxLength={500}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      {!loading && !rows.length && (
        <p>
          No preparation batches yet. Choose a reviewed prepared-serving recipe
          to begin.
        </p>
      )}
      <ul className="space-y-3">
        {rows.map((row, index) => (
          <li key={row.id} className={panelClass}>
            <div className="flex flex-wrap justify-between gap-3">
              <h3 className="font-semibold">
                Batch {index + 1} ·{' '}
                <span>
                  {row.state.charAt(0).toUpperCase() + row.state.slice(1)}
                </span>
              </h3>
              <p>Recorded input cost: {costMoney(row.sourceCostMinor)}</p>
            </div>
            <p className="mt-1 text-xs text-gray-500">Reference {row.id}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {row.state === 'draft' && (
                <button
                  className={buttonClass}
                  disabled={busy}
                  onClick={() => void run(row, 'reserve')}
                >
                  Reserve ingredients
                </button>
              )}
              {row.state === 'reserved' && (
                <button
                  className={buttonClass}
                  disabled={
                    busy ||
                    reason.trim().length < 5 ||
                    (!failed && !validActual)
                  }
                  onClick={() => void run(row, 'complete')}
                >
                  Complete measured output
                </button>
              )}
              {['draft', 'reserved'].includes(row.state) && (
                <button
                  className={buttonClass}
                  disabled={busy || reason.trim().length < 3}
                  onClick={() => void run(row, 'cancel')}
                >
                  Cancel batch
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
