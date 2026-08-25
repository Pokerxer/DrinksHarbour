'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { PiX, PiSpinner, PiWarning, PiInfo } from 'react-icons/pi';
import { BRAND, RULE_TYPE_META } from '@/app/shared/point-of-sale/pricelist-constants';
import type { PricelistRule, RuleFormValues, SubProductLite } from '../types';
import ProductPicker from '../product-picker';
import RuleTypePicker from './rule-type-picker';
import TypeFields from './type-fields';
import PricePreview, { computeRulePreview } from './price-preview';

const META = RULE_TYPE_META as unknown as Record<
  string,
  {
    label: string;
    color: string;
    bg: string;
    border: string;
    hint?: string;
    modalHint?: string;
  }
>;

export const RULE_EMPTY: RuleFormValues = {
  applyTo: 'product',
  subProduct: '',
  appliedOn: '',
  priceType: 'discount',
  fixedPrice: '',
  markupPercentage: '',
  discountType: 'percentage',
  discountPercentage: '',
  discountAmount: '',
  flashSalePercentage: '',
  flashSaleQty: '',
  bundleName: '',
  bundleQuantity: '2',
  bundleDiscount: '',
  bundleDiscountType: 'percentage',
  bundleTargetSubProduct: '',
  bundleTargetName: '',
  thresholdAmount: '',
  minQuantity: '',
  startDate: '',
  endDate: '',
};

type RulePayload = ReturnType<typeof buildPayload>;

function toDateStr(d: unknown): string {
  if (!d) return '';
  const date = new Date(String(d));
  return isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

const asId = (v: SubProductLite | string | undefined): string =>
  !v ? '' : typeof v === 'string' ? v : v._id;

function ruleToFormValues(rule: PricelistRule): RuleFormValues {
  const spId = asId(rule.subProduct);
  const tgt = rule.bundleTargetSubProduct;
  return {
    applyTo: spId ? 'product' : 'all',
    subProduct: spId,
    appliedOn: rule.appliedOn || '',
    priceType: rule.priceType,
    fixedPrice: rule.fixedPrice ? String(rule.fixedPrice) : '',
    markupPercentage: rule.markupPercentage ? String(rule.markupPercentage) : '',
    discountType: rule.discountType || 'percentage',
    discountPercentage: rule.discountPercentage
      ? String(rule.discountPercentage)
      : '',
    discountAmount: rule.discountAmount ? String(rule.discountAmount) : '',
    flashSalePercentage: rule.flashSalePercentage
      ? String(rule.flashSalePercentage)
      : '',
    flashSaleQty: rule.flashSaleQty ? String(rule.flashSaleQty) : '',
    bundleName: rule.bundleName || '',
    bundleQuantity: rule.bundleQuantity ? String(rule.bundleQuantity) : '2',
    bundleDiscount: rule.bundleDiscount ? String(rule.bundleDiscount) : '',
    bundleDiscountType: rule.bundleDiscountType || 'percentage',
    bundleTargetSubProduct: asId(tgt),
    bundleTargetName:
      (tgt && typeof tgt === 'object'
        ? tgt.product?.name || tgt.sku || ''
        : '') || '',
    thresholdAmount: rule.thresholdAmount ? String(rule.thresholdAmount) : '',
    minQuantity: rule.minQuantity ? String(rule.minQuantity) : '',
    startDate: toDateStr(rule.startDate),
    endDate: toDateStr(rule.endDate),
  };
}

function validate(form: RuleFormValues): Record<string, string> {
  const e: Record<string, string> = {};
  const num = (s: string) => parseFloat(s) || 0;

  if (form.priceType === 'fixed' && !num(form.fixedPrice))
    e.fixedPrice = 'Enter a price';

  if (form.priceType === 'formula' && !num(form.markupPercentage))
    e.markupPercentage = 'Enter a markup %';

  if (
    form.priceType === 'discount' ||
    form.priceType === 'cart_threshold'
  ) {
    if (form.discountType === 'percentage' && !num(form.discountPercentage))
      e.discountPercentage = 'Enter a discount %';
    if (form.discountType === 'fixed' && !num(form.discountAmount))
      e.discountAmount = 'Enter an amount';
  }

  if (form.priceType === 'flash_sale' && !num(form.flashSalePercentage))
    e.flashSalePercentage = 'Enter a discount %';

  if (form.priceType === 'bundle') {
    if (num(form.bundleQuantity) < 2) e.bundleQuantity = 'Min 2 units';
    if (form.bundleDiscountType !== 'no_discount' && !num(form.bundleDiscount))
      e.bundleDiscount =
        form.bundleDiscountType === 'markup_on_cost'
          ? 'Enter a markup %'
          : 'Enter a discount';
  }

  if (form.priceType === 'cart_threshold' && !num(form.thresholdAmount))
    e.thresholdAmount = 'Enter a spend threshold';

  if (
    form.startDate &&
    form.endDate &&
    new Date(form.startDate) > new Date(form.endDate)
  )
    e.endDate = 'End must be after start';

  return e;
}

function buildPayload(form: RuleFormValues) {
  const num = (s: string) => parseFloat(s) || 0;
  const qty = num(form.bundleQuantity) || 2;
  const disc = num(form.bundleDiscount);
  const bundleName =
    form.bundleName ||
    `Buy ${qty}+ · ${
      form.bundleDiscountType === 'fixed' ? `₦${disc}` : `${disc}%`
    } off`;
  return {
    subProduct: form.subProduct || undefined,
    appliedOn: form.subProduct ? form.appliedOn : 'All products',
    priceType: form.priceType,
    fixedPrice: num(form.fixedPrice),
    markupPercentage: num(form.markupPercentage),
    discountType: form.discountType,
    discountPercentage: num(form.discountPercentage),
    discountAmount: num(form.discountAmount),
    flashSalePercentage: num(form.flashSalePercentage),
    flashSaleQty: num(form.flashSaleQty),
    bundleName,
    bundleQuantity: qty,
    bundleDiscount: form.bundleDiscountType === 'no_discount' ? 0 : disc,
    bundleDiscountType: form.bundleDiscountType,
    bundleTargetSubProduct: form.bundleTargetSubProduct || undefined,
    thresholdAmount: num(form.thresholdAmount),
    minQuantity: num(form.minQuantity),
    startDate: form.startDate || undefined,
    endDate: form.endDate || undefined,
  };
}

interface Props {
  products: SubProductLite[];
  onSave(payload: RulePayload): Promise<void>;
  onSaveNew?(payload: RulePayload): Promise<void>;
  onDiscard(): void;
  initialValues?: PricelistRule | null;
}

export default function CreateRuleModal({
  products,
  onSave,
  onSaveNew,
  onDiscard,
  initialValues = null,
}: Props) {
  const isEdit = !!initialValues;
  const [form, setForm] = useState<RuleFormValues>(
    isEdit ? ruleToFormValues(initialValues) : { ...RULE_EMPTY }
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<'close' | 'new' | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onDiscard();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [saving, onDiscard]);

  const f = (k: keyof RuleFormValues, v: string) => {
    setForm((p) => ({ ...p, [k]: v }));
    setErrors((p) => {
      if (!p[k as string]) return p;
      const n = { ...p };
      delete n[k as string];
      return n;
    });
  };

  function switchType(type: RuleFormValues['priceType']) {
    setForm((p) => ({
      ...p,
      priceType: type,
      fixedPrice: '',
      markupPercentage: '',
      discountPercentage: '',
      discountAmount: '',
      flashSalePercentage: '',
      flashSaleQty: '',
      bundleName: '',
      bundleDiscount: '',
    }));
    setErrors({});
  }

  const selProduct = useMemo(
    () => products.find((p) => p._id === form.subProduct),
    [products, form.subProduct]
  );
  const basePrice = Number(selProduct?.baseSellingPrice) || 0;
  const costPrice = Number(selProduct?.costPrice) || 0;

  // Conflict: selected product already has same promotion type active
  const conflict = (() => {
    if (!selProduct) return null;
    const pt = form.priceType;
    if (pt === 'flash_sale' && selProduct.flashSale?.isActive)
      return `This product already has an active flash sale (${selProduct.flashSale.discountPercentage}% off). Applying will overwrite it.`;
    if (
      pt === 'discount' &&
      selProduct.isOnSale &&
      (selProduct.saleDiscountValue ?? 0) > 0
    )
      return `This product already has an active discount (${
        selProduct.saleType === 'fixed'
          ? `₦${selProduct.saleDiscountValue}`
          : `${selProduct.saleDiscountValue}%`
      } off). Applying will overwrite it.`;
    if (pt === 'bundle' && (selProduct.bundleDeals?.length ?? 0) > 0)
      return `This product has ${selProduct.bundleDeals!.length} existing bundle deal${
        selProduct.bundleDeals!.length > 1 ? 's' : ''
      }. A new one will be added.`;
    return null;
  })();

  const preview = computeRulePreview(form, basePrice, costPrice);
  const typeMeta = META[form.priceType] || META.discount;
  const errorCount = Object.keys(errors).length;

  async function handle(mode: 'close' | 'new') {
    const errs = validate(form);
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setSaving(mode);
    try {
      const payload = buildPayload(form);
      if (mode === 'close') {
        await onSave(payload);
      } else if (onSaveNew) {
        await onSaveNew(payload);
        setForm((p) => ({
          ...RULE_EMPTY,
          priceType: p.priceType,
          discountType: p.discountType,
          bundleDiscountType: p.bundleDiscountType,
        }));
        setErrors({});
      }
    } catch (err: unknown) {
      // Surface server-side field-keyed validation errors (400 with
      // { success:false, errors: { field: 'message' } }) per-field.
      const e = err as {
        body?: { errors?: Record<string, string> };
        message?: string;
      };
      if (e.body?.errors && typeof e.body.errors === 'object') {
        setErrors((prev) => ({ ...prev, ...e.body!.errors }));
      } else if (e.message) {
        toast.error(e.message);
      }
    } finally {
      setSaving(null);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onDiscard}
        aria-hidden
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? 'Edit price rule' : 'Add price rule'}
        className="relative flex w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        style={{ maxHeight: '92vh' }}
      >
        <div
          className="h-1 w-full shrink-0"
          style={{ backgroundColor: typeMeta.color }}
        />

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-3.5">
          <div>
            <p className="text-sm font-bold text-gray-900">
              {isEdit ? 'Edit Price Rule' : 'Add Price Rule'}
            </p>
            <p className="text-[11px] text-gray-400">
              {typeMeta.modalHint || typeMeta.hint}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onDiscard}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <PiX className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <RuleTypePicker
            value={form.priceType}
            onChange={(t) => switchType(t as RuleFormValues['priceType'])}
          />

          {/* Product picker */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-gray-600">
              Product
            </label>
            <ProductPicker
              products={products}
              value={form.subProduct}
              displayValue={
                form.appliedOn && form.appliedOn !== 'All products'
                  ? form.appliedOn
                  : ''
              }
              placeholder="Search or leave blank for all products…"
              allowAll
              onChange={(p) => {
                if (!p) {
                  f('subProduct', '');
                  f('appliedOn', '');
                } else {
                  f('subProduct', p._id);
                  f('appliedOn', p.product?.name || p.sku || '');
                }
              }}
            />
            <p className="mt-1 text-[11px] text-gray-400">
              Leave blank to apply to all products
            </p>
          </div>

          {conflict && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] text-amber-800">
              <PiWarning className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              {conflict}
            </div>
          )}

          {/* Type-specific fields */}
          <div
            className="space-y-3 rounded-xl border bg-gray-50 p-4"
            style={{ borderColor: typeMeta.border }}
          >
            <TypeFields form={form} errors={errors} f={f} />

            {form.priceType === 'bundle' && (
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-gray-600">
                  Get product (optional)
                </label>
                <ProductPicker
                  products={products}
                  value={form.bundleTargetSubProduct}
                  displayValue={form.bundleTargetName}
                  allowAll={false}
                  placeholder="Search product to discount…"
                  onChange={(p) => {
                    if (!p) {
                      f('bundleTargetSubProduct', '');
                      f('bundleTargetName', '');
                    } else {
                      f('bundleTargetSubProduct', p._id);
                      f('bundleTargetName', p.product?.name || p.sku || '');
                    }
                  }}
                />
                <p className="mt-1 text-[11px] text-gray-400">
                  Blank = same-product bundle. Set to discount a different product
                  when the trigger qty is met.
                </p>
              </div>
            )}
          </div>

          {/* Min qty + validity */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">
                Min Order Qty
              </label>
              <input
                type="number"
                min="0"
                step="1"
                aria-label="Minimum order quantity"
                placeholder="0"
                value={form.minQuantity}
                onChange={(e) => f('minQuantity', e.target.value)}
                className="h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm tabular-nums outline-none focus:border-[#b20202]"
              />
              <p className="mt-1 text-[11px] text-gray-400">0 = any quantity</p>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">
                Valid From
              </label>
              <input
                type="date"
                aria-label="Valid from"
                min={today}
                value={form.startDate}
                onChange={(e) => f('startDate', e.target.value)}
                className="h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none focus:border-[#b20202]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">
                Valid Until
              </label>
              <input
                type="date"
                aria-label="Valid until"
                min={form.startDate || today}
                value={form.endDate}
                onChange={(e) => f('endDate', e.target.value)}
                className={`h-9 w-full rounded-lg border bg-white px-3 text-sm outline-none ${
                  errors.endDate
                    ? 'border-red-400'
                    : 'border-gray-200 focus:border-[#b20202]'
                }`}
              />
              {errors.endDate && (
                <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-500">
                  <PiWarning className="h-3 w-3" /> {errors.endDate}
                </p>
              )}
            </div>
          </div>

          <PricePreview preview={preview} />

          {!form.subProduct && (
            <div className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-[11px] text-blue-700">
              <PiInfo className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
              <span>
                No product selected — this rule will apply to{' '}
                <strong>all products</strong> when the pricelist is applied.
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center gap-2 border-t border-gray-100 bg-white px-5 py-3">
          <button
            type="button"
            onClick={() => handle('close')}
            disabled={!!saving}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: BRAND }}
          >
            {saving === 'close' && (
              <PiSpinner className="h-3.5 w-3.5 animate-spin" />
            )}
            {isEdit ? 'Save Changes' : 'Save & Close'}
          </button>
          {!isEdit && onSaveNew && (
            <button
              type="button"
              onClick={() => handle('new')}
              disabled={!!saving}
              className="flex items-center gap-1.5 rounded-lg border-2 px-4 py-2 text-sm font-bold transition-colors hover:bg-opacity-10 disabled:opacity-50"
              style={{ borderColor: BRAND, color: BRAND }}
            >
              {saving === 'new' && (
                <PiSpinner className="h-3.5 w-3.5 animate-spin" />
              )}
              Save &amp; New
            </button>
          )}
          <button
            type="button"
            onClick={onDiscard}
            disabled={!!saving}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-50 disabled:opacity-50"
          >
            {isEdit ? 'Cancel' : 'Discard'}
          </button>
          {errorCount > 0 && (
            <span className="ml-auto flex items-center gap-1 text-[11px] font-semibold text-red-500">
              <PiWarning className="h-3.5 w-3.5" />
              {errorCount} error{errorCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
