'use client';

import { useState } from 'react';
import { refName, type PricelistRule, type RuleFormValues, type SubProductLite } from '../types';

export const RULE_EMPTY: RuleFormValues = {
  applyTo: 'product',
  subProduct: '',
  appliedOn: '',
  priceType: 'discount',
  fixedPrice: '',
  markupPercentage: '',
  markupBase: 'cost',
  discountType: 'percentage',
  discountPercentage: '',
  discountAmount: '',
  flashSalePercentage: '',
  flashSaleQty: '',
  bundleName: '',
  bundleQuantity: '2',
  bundleDiscount: '',
  bundleDiscountType: 'percentage',
  bundleMarkupBase: 'cost',
  bundleUnitsMode: 'manual',
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
    markupBase: rule.markupBase || 'cost',
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
    bundleMarkupBase: rule.bundleMarkupBase || 'cost',
    bundleUnitsMode: rule.bundleUnitsMode || 'manual',
    bundleTargetSubProduct: asId(tgt),
    bundleTargetName:
      (tgt && typeof tgt === 'object'
        ? refName(tgt.product) || tgt.sku || ''
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

  if (form.priceType === 'discount' || form.priceType === 'cart_threshold') {
    if (form.discountType === 'percentage' && !num(form.discountPercentage))
      e.discountPercentage = 'Enter a discount %';
    if (form.discountType === 'fixed' && !num(form.discountAmount))
      e.discountAmount = 'Enter an amount';
  }

  if (form.priceType === 'flash_sale' && !num(form.flashSalePercentage))
    e.flashSalePercentage = 'Enter a discount %';

  if (form.priceType === 'bundle') {
    if (form.bundleUnitsMode !== 'pack' && num(form.bundleQuantity) < 2)
      e.bundleQuantity = 'Min 2 units';
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
      form.bundleDiscountType === 'no_discount'
        ? 'No discount'
        : form.bundleDiscountType === 'fixed'
          ? `₦${disc} off`
          : form.bundleDiscountType === 'markup_on_cost'
            ? form.bundleMarkupBase === 'wholesale'
              ? `Wholesale +${disc}% markup`
              : `Cost +${disc}% markup`
            : `${disc}% off`
    }`;
  return {
    subProduct: form.subProduct || undefined,
    appliedOn: form.subProduct ? form.appliedOn : 'All products',
    priceType: form.priceType,
    fixedPrice: num(form.fixedPrice),
    markupPercentage: num(form.markupPercentage),
    markupBase: form.markupBase || 'cost',
    discountType: form.discountType,
    discountPercentage: num(form.discountPercentage),
    discountAmount: num(form.discountAmount),
    flashSalePercentage: num(form.flashSalePercentage),
    flashSaleQty: num(form.flashSaleQty),
    bundleName,
    bundleQuantity: qty,
    bundleDiscount: form.bundleDiscountType === 'no_discount' ? 0 : disc,
    bundleDiscountType: form.bundleDiscountType,
    bundleMarkupBase: form.bundleMarkupBase || 'cost',
    bundleUnitsMode: form.bundleUnitsMode || 'manual',
    bundleTargetSubProduct: form.bundleTargetSubProduct || undefined,
    thresholdAmount: num(form.thresholdAmount),
    minQuantity: num(form.minQuantity),
    startDate: form.startDate || undefined,
    endDate: form.endDate || undefined,
  };
}

/** Form state machine for the create/edit rule modal. */
export function useRuleForm(initialValues: PricelistRule | null) {
  const isEdit = !!initialValues;
  const [form, setForm] = useState<RuleFormValues>(
    isEdit ? ruleToFormValues(initialValues) : { ...RULE_EMPTY }
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

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
      markupBase: 'cost',
      discountPercentage: '',
      discountAmount: '',
      flashSalePercentage: '',
      flashSaleQty: '',
      bundleName: '',
      bundleDiscount: '',
      bundleMarkupBase: 'cost',
      bundleUnitsMode: 'manual',
    }));
    setErrors({});
  }

  function resetKeepingTypes() {
    setForm((p) => ({
      ...RULE_EMPTY,
      priceType: p.priceType,
      discountType: p.discountType,
      bundleDiscountType: p.bundleDiscountType,
      bundleMarkupBase: p.bundleMarkupBase,
      bundleUnitsMode: p.bundleUnitsMode,
    }));
    setErrors({});
  }

  /** Validates and returns the payload, or null after setting field errors. */
  function submit(): RulePayload | null {
    const errs = validate(form);
    if (Object.keys(errs).length) {
      setErrors(errs);
      return null;
    }
    return buildPayload(form);
  }

  function applyServerErrors(errorsObj: Record<string, string>) {
    setErrors((prev) => ({ ...prev, ...errorsObj }));
  }

  return {
    isEdit,
    form,
    errors,
    f,
    switchType,
    resetKeepingTypes,
    submit,
    applyServerErrors,
  };
}
