'use client';

import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  PiX,
  PiSpinner,
  PiFloppyDisk,
  PiLightning,
  PiPlus,
  PiTag,
  PiCaretLeft,
  PiCaretRight,
} from 'react-icons/pi';
import { BRAND } from '@/app/shared/point-of-sale/pricelist-constants';
import type { Pricelist, PricelistRule, SubProductLite } from './types';
import { pricelistService } from '@/services/pricelist.service';
import { subproductService } from '@/services/subproduct.service';
import { warehouseService } from '@/services/warehouse.service';
import { posApi } from '@/app/shared/point-of-sale/api';
import ConfirmDialog from '@/app/shared/purchases/pricelists/confirm-dialog';
import PanelBindings from './panel-bindings';
import RuleCard from './rule-card';
import CreateRuleModal from './create-rule-modal';

interface Props {
  pl: Pricelist;
  token?: string;
  onClose(): void;
  onRefresh(): void;
}

const PAGE = 40;

export default function PricelistPanel({ pl, token, onClose, onRefresh }: Props) {
  const [tab, setTab] = useState<'rules' | 'ecommerce'>('rules');
  const [name, setName] = useState(pl?.name || '');
  const [currency, setCurrency] = useState(pl?.currency || 'NGN');
  const [website, setWebsite] = useState(pl?.website || '');
  const [selectable, setSelectable] = useState(!!pl?.isSelectable);
  const [boundShops, setBoundShops] = useState<string[]>(pl?.shops || []);
  const [boundWarehouses, setBoundWarehouses] = useState<string[]>(
    (pl?.warehouses || []).map(String)
  );
  const [isDefault, setIsDefault] = useState(!!pl?.isDefault);
  const [customerTagsInput, setCustomerTagsInput] = useState(
    (pl?.customerTags || []).join(', ')
  );
  const [shopOptions, setShopOptions] = useState<{ _id: string; name: string }[]>(
    []
  );
  const [whOptions, setWhOptions] = useState<{ _id: string; name: string }[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [products, setProducts] = useState<SubProductLite[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState('');
  const [productsRetry, setProductsRetry] = useState(0);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmRuleId, setConfirmRuleId] = useState<string | null>(null);
  const [editRule, setEditRule] = useState<PricelistRule | null>(null);
  const [reordering, setReordering] = useState(false);
  const [page, setPage] = useState(1);

  // Sync local meta fields on pricelist switch, but never wipe mid-edit state.
  const dirtyRef = useRef(dirty);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  useEffect(() => {
    if (!dirtyRef.current) {
      setName(pl?.name || '');
      setCurrency(pl?.currency || 'NGN');
      setWebsite(pl?.website || '');
      setSelectable(!!pl?.isSelectable);
      setBoundShops(pl?.shops || []);
      setBoundWarehouses((pl?.warehouses || []).map(String));
      setIsDefault(!!pl?.isDefault);
      setCustomerTagsInput((pl?.customerTags || []).join(', '));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pl?._id]);

  // Shop + warehouse options for binding selectors
  useEffect(() => {
    if (!token) return;
    const builtins = [
      { _id: 'retail', name: 'Retail (built-in)' },
      { _id: 'wholesale', name: 'Wholesale (built-in)' },
    ];
    posApi
      .listShops(token)
      .then((r: { shops?: { _id: string; name: string }[] }) => {
        const custom = (r?.shops || []).map((s) => ({
          _id: String(s._id),
          name: s.name,
        }));
        setShopOptions([...builtins, ...custom]);
      })
      .catch(() => setShopOptions(builtins));
    warehouseService
      .getWarehouses(token, { isActive: true })
      .then((r: unknown) => {
        const res = r as {
          data?: unknown;
          warehouses?: { _id: string; name: string }[];
        };
        const list = Array.isArray(res?.data)
          ? (res.data as { _id: string; name: string }[])
          : ((res?.data as { warehouses?: { _id: string; name: string }[] })
              ?.warehouses ??
            res?.warehouses ??
            []);
        setWhOptions(list.map((w) => ({ _id: String(w._id), name: w.name })));
      })
      .catch(() => setWhOptions([]));
  }, [token]);

  // Eager product catalogue load with visible error + retry
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setProductsLoading(true);
    setProductsError('');
    subproductService
      .getSubProducts(token, { limit: 500 })
      .then((r: unknown) => {
        if (cancelled) return;
        const res = r as {
          data?: { subProducts?: SubProductLite[] };
          subProducts?: SubProductLite[];
        };
        setProducts(res?.data?.subProducts || res?.subProducts || []);
      })
      .catch(() => {
        if (!cancelled) setProductsError('Could not load products');
      })
      .finally(() => {
        if (!cancelled) setProductsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, productsRetry]);

  function markDirty() {
    setDirty(true);
  }

  async function saveMeta() {
    setSaving(true);
    try {
      await pricelistService.update(
        pl._id,
        {
          name,
          currency,
          website,
          isSelectable: selectable,
          shops: boundShops,
          warehouses: boundWarehouses,
          customerTags: customerTagsInput
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
          isDefault,
        },
        token!
      );
      toast.success('Pricelist saved');
      setDirty(false);
      dirtyRef.current = false;
      onRefresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleApply() {
    const rules = pl?.rules || [];
    const activeRules = rules.filter(
      (r) => !r.endDate || new Date(r.endDate) >= new Date()
    );
    if (activeRules.length === 0) {
      toast.error('No active rules to apply');
      return;
    }
    setApplying(true);
    try {
      const res = await pricelistService.apply(pl._id, token!);
      const d = res.data as {
        message?: string;
        modified: number;
        skipped: number;
        errors?: unknown[];
      };
      toast.success(
        d.message || `${d.modified} product${d.modified === 1 ? '' : 's'} updated`
      );
      if (d.skipped > 0)
        toast(`${d.skipped} rule${d.skipped === 1 ? '' : 's'} skipped`, {
          icon: '⚠️',
        });
      if ((d.errors?.length ?? 0) > 0)
        toast.error(
          `${d.errors!.length} rule${d.errors!.length === 1 ? '' : 's'} failed`
        );
      onRefresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setApplying(false);
    }
  }

  async function saveRule(rule: Record<string, unknown>, keepOpen: boolean) {
    try {
      await pricelistService.addRule(pl._id, rule, token!);
      toast.success('Rule added');
      if (!keepOpen) setShowModal(false);
      onRefresh();
    } catch (e) {
      toast.error((e as Error).message);
      throw e;
    }
  }

  async function saveEditedRule(ruleId: string, rule: Record<string, unknown>) {
    try {
      await pricelistService.updateRule(pl._id, ruleId, rule, token!);
      toast.success('Rule updated');
      setEditRule(null);
      onRefresh();
    } catch (e) {
      toast.error((e as Error).message);
      throw e;
    }
  }

  async function deleteRule(ruleId: string) {
    setDeleting(ruleId);
    try {
      await pricelistService.deleteRule(pl._id, ruleId, token!);
      toast.success('Rule removed');
      onRefresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDeleting(null);
      setConfirmRuleId(null);
    }
  }

  async function moveRule(ruleId: string, direction: 'up' | 'down') {
    const currentRules = [...(pl?.rules || [])];
    const idx = currentRules.findIndex((r) => r._id === ruleId);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= currentRules.length) return;

    [currentRules[idx], currentRules[swapIdx]] = [
      currentRules[swapIdx],
      currentRules[idx],
    ];
    const orderedIds = currentRules.map((r) => r._id);

    setReordering(true);
    try {
      await pricelistService.reorderRules(pl._id, orderedIds, token!);
      onRefresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setReordering(false);
    }
  }

  const rules = pl?.rules || [];
  const pageRules = rules.slice((page - 1) * PAGE, page * PAGE);
  const totalPages = Math.max(1, Math.ceil(rules.length / PAGE));

  const now = new Date();
  const expiredCount = rules.filter(
    (r) => r.endDate && new Date(r.endDate) < now
  ).length;
  const activeCount = rules.length - expiredCount;

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <input
              aria-label="Pricelist name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                markDirty();
              }}
              className="min-w-0 flex-1 truncate bg-transparent text-sm font-bold text-gray-900 outline-none focus:text-gray-700"
              placeholder="Pricelist name"
            />
            {pl?.isSelectable && !dirty && (
              <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700">
                Selectable
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[10px] text-gray-400">
            {pl?.currency || 'NGN'} · {activeCount} rule{activeCount !== 1 ? 's' : ''}
            {expiredCount > 0 ? ` · ${expiredCount} expired` : ''}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {dirty && (
            <button
              type="button"
              onClick={saveMeta}
              disabled={saving}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: BRAND }}
            >
              {saving ? (
                <PiSpinner className="h-3 w-3 animate-spin" />
              ) : (
                <PiFloppyDisk className="h-3 w-3" />
              )}
              Save
            </button>
          )}
          <button
            type="button"
            aria-label="Close panel"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <PiX className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Meta row */}
      <div className="flex shrink-0 items-center gap-3 border-b border-gray-100 bg-gray-50/50 px-4 py-2 text-[11px]">
        <div className="flex items-center gap-1.5">
          <span className="text-gray-400">Currency</span>
          <select
            aria-label="Currency"
            value={currency}
            onChange={(e) => {
              setCurrency(e.target.value);
              markDirty();
            }}
            className="border-0 bg-transparent text-xs font-semibold text-gray-700 outline-none"
          >
            <option>NGN</option>
            <option>USD</option>
            <option>EUR</option>
            <option>GBP</option>
          </select>
        </div>
        <div className="h-3 w-px bg-gray-200" />
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <span className="shrink-0 text-gray-400">Website</span>
          <input
            aria-label="Website"
            value={website}
            onChange={(e) => {
              setWebsite(e.target.value);
              markDirty();
            }}
            className="min-w-0 flex-1 border-0 bg-transparent text-xs font-semibold text-gray-700 outline-none placeholder:font-normal placeholder:text-gray-300"
            placeholder="None"
          />
        </div>
        <div className="h-3 w-px bg-gray-200" />
        <label className="flex cursor-pointer items-center gap-1.5">
          <input
            type="checkbox"
            checked={selectable}
            onChange={(e) => {
              setSelectable(e.target.checked);
              markDirty();
            }}
            className="h-3.5 w-3.5 rounded accent-[#b20202]"
          />
          <span className="text-gray-500">Selectable</span>
        </label>
        <div className="h-3 w-px bg-gray-200" />
        <label className="flex cursor-pointer items-center gap-1.5">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => {
              setIsDefault(e.target.checked);
              markDirty();
            }}
            className="h-3.5 w-3.5 rounded accent-[#b20202]"
          />
          <span className="text-gray-500">Default</span>
        </label>
      </div>

      <PanelBindings
        shopOptions={shopOptions}
        whOptions={whOptions}
        boundShops={boundShops}
        boundWarehouses={boundWarehouses}
        customerTagsInput={customerTagsInput}
        selectable={selectable}
        onToggleShop={(id) => {
          setBoundShops((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
          );
          markDirty();
        }}
        onToggleWarehouse={(id) => {
          setBoundWarehouses((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
          );
          markDirty();
        }}
        onTagsChange={(v) => {
          setCustomerTagsInput(v);
          markDirty();
        }}
      />

      {/* Tabs */}
      <div className="flex shrink-0 border-b border-gray-100 text-xs font-semibold">
        {(['rules', 'ecommerce'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            aria-pressed={tab === t}
            className={`flex flex-1 items-center justify-center py-2.5 capitalize transition-colors ${
              tab === t
                ? 'border-b-2 border-[#b20202] text-[#b20202]'
                : 'border-b-2 border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            {t === 'rules'
              ? `Price Rules${rules.length > 0 ? ` (${rules.length})` : ''}`
              : 'Ecommerce'}
          </button>
        ))}
      </div>

      {tab === 'rules' && (
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="flex shrink-0 items-center gap-2 border-b border-gray-100 px-4 py-2">
            <button
              type="button"
              onClick={handleApply}
              disabled={applying || rules.length === 0}
              title="Fixed & formula rules update the product base price permanently. Discount, flash sale, and bundle rules are dynamic — they activate when this pricelist is selected in a POS session."
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              style={{ backgroundColor: BRAND }}
            >
              {applying ? (
                <PiSpinner className="h-3 w-3 animate-spin" />
              ) : (
                <PiLightning className="h-3 w-3" />
              )}
              Apply prices
            </button>
            <span className="text-[10px] text-gray-400">
              fixed &amp; formula only · discount/bundle rules are session-dynamic
            </span>
            <div className="ml-auto flex items-center gap-1 text-[10px] text-gray-400">
              <span>↑↓ reorder priority</span>
            </div>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1 rounded-lg border border-dashed px-3 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:border-[#b20202] hover:text-[#b20202]"
            >
              <PiPlus className="h-3.5 w-3.5" />
              Add rule
            </button>
          </div>

          {/* Rules list */}
          <div className="flex-1 overflow-y-auto">
            {productsLoading && rules.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-10 text-xs text-gray-400">
                <PiSpinner className="h-4 w-4 animate-spin" /> Loading products…
              </div>
            ) : productsError && rules.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-xs text-red-500">
                Could not load products
                <button
                  type="button"
                  onClick={() => setProductsRetry((n) => n + 1)}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Retry
                </button>
              </div>
            ) : rules.length === 0 ? (
              <EmptyRules onCreate={() => setShowModal(true)} />
            ) : (
              <>
                {rules.length > PAGE && (
                  <Pager page={page} totalPages={totalPages} total={rules.length} onPage={setPage} />
                )}
                <div>
                  {pageRules.map((r, idx) => (
                    <RuleCard
                      key={r._id}
                      rule={r}
                      deleting={deleting === r._id}
                      sequenceIndex={(page - 1) * PAGE + idx}
                      totalRules={rules.length}
                      onDelete={() => setConfirmRuleId(r._id)}
                      onEdit={() => setEditRule(r)}
                      onMoveUp={() => moveRule(r._id, 'up')}
                      onMoveDown={() => moveRule(r._id, 'down')}
                    />
                  ))}
                  {reordering && (
                    <p className="px-4 py-1.5 text-center text-[10px] text-gray-400">
                      Saving order…
                    </p>
                  )}
                </div>
                {expiredCount > 0 && (
                  <p className="px-4 py-2 text-center text-[10px] text-gray-400">
                    {expiredCount} expired rule{expiredCount !== 1 ? 's' : ''} above —
                    they are skipped when applying
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {tab === 'ecommerce' && (
        <div className="flex flex-1 items-center justify-center text-xs text-gray-400">
          Ecommerce settings coming soon
        </div>
      )}

      {/* Create modal */}
      {showModal && (
        <CreateRuleModal
          products={products}
          onSave={async (r) => {
            await saveRule(r, false);
          }}
          onSaveNew={async (r) => {
            await saveRule(r, true);
          }}
          onDiscard={() => setShowModal(false)}
        />
      )}

      {/* Edit modal — Save Changes + Cancel only */}
      {editRule && (
        <CreateRuleModal
          products={products}
          initialValues={editRule}
          onSave={async (r) => {
            await saveEditedRule(editRule._id, r);
          }}
          onDiscard={() => setEditRule(null)}
        />
      )}

      {/* Delete-rule confirmation */}
      <ConfirmDialog
        open={!!confirmRuleId}
        title="Delete price rule?"
        message="This rule will be permanently removed from the pricelist."
        confirmLabel="Delete"
        tone="danger"
        busy={!!deleting}
        onConfirm={() => confirmRuleId && deleteRule(confirmRuleId)}
        onCancel={() => setConfirmRuleId(null)}
      />
    </div>
  );
}

function EmptyRules({ onCreate }: { onCreate(): void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100">
        <PiTag className="h-6 w-6 text-gray-300" />
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-500">No price rules yet</p>
        <p className="mt-0.5 text-[11px] text-gray-400">
          Click &quot;Add rule&quot; to create your first rule
        </p>
      </div>
      <button
        type="button"
        onClick={onCreate}
        className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white"
        style={{ backgroundColor: BRAND }}
      >
        <PiPlus className="h-3.5 w-3.5" /> Add first rule
      </button>
    </div>
  );
}

function Pager({
  page,
  totalPages,
  total,
  onPage,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPage(p: number): void;
}) {
  return (
    <div className="flex items-center justify-between border-b border-gray-100 px-4 py-1.5 text-[10px] text-gray-400">
      <span>
        {(page - 1) * PAGE + 1}–{Math.min(page * PAGE, total)} of {total}
      </span>
      <div className="flex gap-0.5">
        <button
          type="button"
          aria-label="Previous rules page"
          onClick={() => onPage(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="flex h-6 w-6 items-center justify-center rounded hover:bg-gray-100 disabled:opacity-30"
        >
          <PiCaretLeft className="h-3 w-3" />
        </button>
        <button
          type="button"
          aria-label="Next rules page"
          onClick={() => onPage(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="flex h-6 w-6 items-center justify-center rounded hover:bg-gray-100 disabled:opacity-30"
        >
          <PiCaretRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
