'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { PiX, PiSpinner, PiWarning, PiInfo } from 'react-icons/pi';
import { BRAND, RULE_TYPE_META } from '@/app/shared/point-of-sale/pricelist-constants';
import { refName, subproductWholesalePrice, type PricelistRule, type SubProductLite } from '../types';
import ModalFooter from './modal-footer';
import ModalHeader from './modal-header';
import PickerField from './picker-field';
import RuleTypePicker from './rule-type-picker';
import TypeFields from './type-fields';
import BundleFields from './bundle-fields';
import PricePreview, { computeRulePreview } from './price-preview';
import { useRuleForm } from './use-rule-form';

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

interface Props {
  products: SubProductLite[];
  onSave(payload: Record<string, unknown>): Promise<void>;
  onSaveNew?(payload: Record<string, unknown>): Promise<void>;
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
  const {
    isEdit,
    form,
    errors,
    f,
    switchType,
    resetKeepingTypes,
    submit,
    applyServerErrors,
  } = useRuleForm(initialValues);
  const [saving, setSaving] = useState<'close' | 'new' | null>(null);

  // Escape closes; body scroll locked while open.
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

  async function handle(mode: 'close' | 'new') {
    const payload = submit();
    if (!payload) return;
    setSaving(mode);
    try {
      if (mode === 'close') {
        await onSave(payload);
      } else if (onSaveNew) {
        await onSaveNew(payload);
        resetKeepingTypes();
      }
    } catch (err: unknown) {
      // Surface server-side field-keyed validation errors
      // ({ success:false, errors: { field: 'message' } }) per-field.
      const e = err as {
        body?: { errors?: Record<string, string> };
        message?: string;
      };
      if (e.body?.errors && typeof e.body.errors === 'object') {
        applyServerErrors(e.body.errors);
      } else if (e.message) {
        toast.error(e.message);
      }
    } finally {
      setSaving(null);
    }
  }

  const typeMeta = META[form.priceType] || META.discount;
  const errorCount = Object.keys(errors).length;

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
        <ModalHeader
          isEdit={isEdit}
          hint={typeMeta.modalHint || typeMeta.hint}
          onClose={onDiscard}
        />

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <RuleTypePicker
            value={form.priceType}
            onChange={(t) => switchType(t as Parameters<typeof switchType>[0])}
          />

          <PickerField
            label="Product"
            products={products}
            form={form}
            f={f}
            target="main"
            hint="Leave blank to apply to all products"
          />

          {conflict && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] text-amber-800">
              <PiWarning className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              {conflict}
            </div>
          )}

          <div
            className="space-y-3 rounded-xl border bg-gray-50 p-4"
            style={{ borderColor: typeMeta.border }}
          >
            <TypeFields
              form={form}
              errors={errors}
              f={f}
              selProduct={selProduct}
              products={products}
            />

            {form.priceType === 'bundle' && (
              <PickerField
                label="Get product (optional)"
                products={products}
                form={form}
                f={f}
                target="bundleTarget"
                hint="Blank = same-product bundle. Set to discount a different product when the trigger qty is met."
              />
            )}
          </div>

          <ValidityFields form={form} errors={errors} f={f} />

          <PricePreview
            preview={computeRulePreview(
              form,
              basePrice,
              costPrice,
              subproductWholesalePrice(selProduct)
            )}
          />

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

        <ModalFooter
          isEdit={isEdit}
          saving={saving}
          errorCount={errorCount}
          onSaveClose={() => handle('close')}
          onSaveNew={() => handle('new')}
          onDiscard={onDiscard}
        />
      </div>
    </div>,
    document.body
  );
}


function ValidityFields({
  form,
  errors,
  f,
}: {
  form: ReturnType<typeof useRuleForm>['form'];
  errors: Record<string, string>;
  f: ReturnType<typeof useRuleForm>['f'];
}) {
  const today = new Date().toISOString().slice(0, 10);
  return (
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
  );
}
