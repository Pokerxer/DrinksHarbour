'use client';

import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import type { Pricelist, PricelistRule, SubProductLite } from './types';
import { pricelistService } from '@/services/pricelist.service';
import PanelModals from './panel-modals';
import PanelBindings from './panel-bindings';
import PanelHeader from './panel-header';
import PanelRulesTab from './panel-rules-tab';
import RuleCard from './rule-card';
import CreateRuleModal from './create-rule-modal';
import { usePanelActions } from './use-panel-actions';

interface Props {
  pl: Pricelist;
  token?: string;
  onClose(): void;
  onRefresh(): void;
}

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
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmRuleId, setConfirmRuleId] = useState<string | null>(null);
  const [editRule, setEditRule] = useState<PricelistRule | null>(null);

  const {
    products,
    shopOptions,
    whOptions,
    productsLoading,
    productsError,
    retryProducts,
    applying,
    reordering,
    applyPrices,
    addRule,
    persistRule,
    removeRule,
    moveRule,
  } = usePanelActions({ pl, token, onRefresh });

  // Sync local meta fields on pricelist switch — never wipe mid-edit state.
  const dirtyRef = useRef(dirty);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  function syncFrom(src: Pricelist) {
    setName(src?.name || '');
    setCurrency(src?.currency || 'NGN');
    setWebsite(src?.website || '');
    setSelectable(!!src?.isSelectable);
    setBoundShops(src?.shops || []);
    setBoundWarehouses((src?.warehouses || []).map(String));
    setIsDefault(!!src?.isDefault);
    setCustomerTagsInput((src?.customerTags || []).join(', '));
  }

  useEffect(() => {
    if (!dirtyRef.current) syncFrom(pl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pl?._id]);

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

  async function handleSaveRule(rule: Record<string, unknown>, keepOpen: boolean) {
    const shouldClose = await addRule(rule, keepOpen); // rethrows for modal field errors
    if (shouldClose) setShowModal(false);
    onRefresh();
  }

  async function handleEditSave(ruleId: string, rule: Record<string, unknown>) {
    await persistRule(ruleId, rule); // rethrows for modal field errors
    setEditRule(null);
    onRefresh();
  }

  async function handleConfirmDelete() {
    if (!confirmRuleId) return;
    setDeleting(confirmRuleId);
    await removeRule(confirmRuleId);
    setDeleting(null);
    setConfirmRuleId(null);
  }

  const rules = pl?.rules || [];
  const activeCount = rules.filter(
    (r) => !r.endDate || new Date(r.endDate) >= new Date()
  ).length;
  const expiredCount = rules.filter(
    (r) => r.endDate && new Date(r.endDate) < new Date()
  ).length;

  return (
    <div className="flex h-full flex-col bg-white">
      <PanelHeader
        name={name}
        currency={currency}
        website={website}
        selectable={selectable}
        isDefault={isDefault}
        dirty={dirty}
        saving={saving}
        activeCount={activeCount}
        expiredCount={expiredCount}
        onNameChange={(v) => {
          setName(v);
          markDirty();
        }}
        onCurrencyChange={(v) => {
          setCurrency(v);
          markDirty();
        }}
        onWebsiteChange={(v) => {
          setWebsite(v);
          markDirty();
        }}
        onSelectableChange={(v) => {
          setSelectable(v);
          markDirty();
        }}
        onIsDefaultChange={(v) => {
          setIsDefault(v);
          markDirty();
        }}
        onSave={saveMeta}
        onClose={onClose}
      />

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
            aria-pressed={tab === t}
            onClick={() => setTab(t)}
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
        <PanelRulesTab
          rules={rules}
          productsLoading={productsLoading}
          productsError={productsError}
          applying={applying}
          reordering={reordering}
          deletingId={deleting}
          onRetryProducts={retryProducts}
          onAddRule={() => setShowModal(true)}
          onApply={applyPrices}
          onDeleteRequest={setConfirmRuleId}
          onEdit={setEditRule}
          onMove={(id, dir) => moveRule(rules, id, dir)}
        >
          {(pageRules, page) => (
            <>
              {pageRules.map((r, idx) => (
                <RuleCard
                  key={r._id}
                  rule={r}
                  deleting={deleting === r._id}
                  sequenceIndex={page * 40 - 40 + idx}
                  totalRules={rules.length}
                  onDelete={() => setConfirmRuleId(r._id)}
                  onEdit={() => setEditRule(r)}
                  onMoveUp={() => moveRule(rules, r._id, 'up')}
                  onMoveDown={() => moveRule(rules, r._id, 'down')}
                />
              ))}
            </>
          )}
        </PanelRulesTab>
      )}

      {tab === 'ecommerce' && (
        <div className="flex flex-1 items-center justify-center text-xs text-gray-400">
          Ecommerce settings coming soon
        </div>
      )}

      <PanelModals
        products={products}
        showModal={showModal}
        editRule={editRule}
        confirmRuleId={confirmRuleId}
        deleting={deleting}
        onCreateSave={(r) => handleSaveRule(r, false)}
        onSaveNew={(r) => handleSaveRule(r, true)}
        onCloseCreate={() => setShowModal(false)}
        onSaveEdit={handleEditSave}
        onCloseEdit={() => setEditRule(null)}
        onConfirmDelete={handleConfirmDelete}
        onCancelDelete={() => setConfirmRuleId(null)}
      />
    </div>
  );
}
