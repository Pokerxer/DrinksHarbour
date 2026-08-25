'use client';

import React from 'react';
import { refName, type RuleFormValues, type SubProductLite } from '../types';
import ProductPicker from '../product-picker';

interface Props {
  label: string;
  products: SubProductLite[];
  form: RuleFormValues;
  f(k: keyof RuleFormValues, v: string): void;
  /** Which form fields this picker writes to. */
  target: 'main' | 'bundleTarget';
  hint: string;
}

/** Labeled ProductPicker wired to the rule-form fields. */
export default function PickerField({
  label,
  products,
  form,
  f,
  target,
  hint,
}: Props) {
  const isMain = target === 'main';
  const value = isMain ? form.subProduct : form.bundleTargetSubProduct;
  const displayValue = isMain
    ? form.appliedOn && form.appliedOn !== 'All products'
      ? form.appliedOn
      : ''
    : form.bundleTargetName;

  function handleSelect(p: SubProductLite | null) {
    if (isMain) {
      if (!p) {
        f('subProduct', '');
        f('appliedOn', '');
      } else {
        f('subProduct', p._id);
        f('appliedOn', refName(p.product) || p.sku || '');
      }
    } else {
      if (!p) {
        f('bundleTargetSubProduct', '');
        f('bundleTargetName', '');
      } else {
        f('bundleTargetSubProduct', p._id);
        f('bundleTargetName', refName(p.product) || p.sku || '');
      }
    }
  }

  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-gray-600">
        {label}
      </label>
      <ProductPicker
        products={products}
        value={value}
        displayValue={displayValue}
        placeholder={
          isMain ? 'Search or leave blank for all products…' : 'Search product to discount…'
        }
        allowAll={isMain}
        onChange={handleSelect}
      />
      <p className="mt-1 text-[11px] text-gray-400">{hint}</p>
    </div>
  );
}
