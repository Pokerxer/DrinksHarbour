'use client';

import { PiInfo } from 'react-icons/pi';
import { RULE_TYPE_META } from '@/app/shared/point-of-sale/pricelist-constants';
import {
  basisCoverage,
  hasWholesalePrice,
  subproductWholesalePrice,
  type RuleFormValues,
  type SubProductLite,
} from '../types';
import { RuleField, RuleInput, Seg, PctChips } from './controls';
import BundleFields from './bundle-fields';
import { fmt } from '../rule-format';

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
  form: RuleFormValues;
  errors: Record<string, string>;
  f(k: keyof RuleFormValues, v: string): void;
  /** Currently selected product, used to decide markup base options. */
  selProduct?: SubProductLite;
  /** Whole catalogue — measures basis coverage for an all-products rule. */
  products?: SubProductLite[];
}

/**
 * Warns that a wholesale-based rule will do nothing on most of the catalogue.
 * Only shown for an all-products rule: with a product selected the basis
 * picker already prints that product's actual wholesale price.
 */
export function WholesaleCoverageNote({
  products,
  selProduct,
}: {
  products?: SubProductLite[];
  selProduct?: SubProductLite;
}) {
  if (selProduct) return null;
  const cov = basisCoverage(products);
  if (cov.total === 0 || cov.withoutWholesale === 0) return null;
  const none = cov.withWholesale === 0;
  return (
    <div
      className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 text-[11px] leading-relaxed ${
        none
          ? 'border-red-200 bg-red-50 text-red-700'
          : 'border-amber-200 bg-amber-50 text-amber-700'
      }`}
    >
      <PiInfo className="mt-px h-3.5 w-3.5 shrink-0" />
      <span>
        {none ? (
          <>
            <b className="font-semibold">
              None of your {cov.total} products has a wholesale price
            </b>{' '}
            — this rule would change no price at all. Pick <b>Cost</b>, or set a
            wholesale price on the sizes first.
          </>
        ) : (
          <>
            Only <b className="font-semibold">{cov.withWholesale}</b> of{' '}
            {cov.total} products has a wholesale price. The other{' '}
            {cov.withoutWholesale} keep their current price — this rule does
            nothing for them.
          </>
        )}
      </span>
    </div>
  );
}

export default function TypeFields({
  form,
  errors,
  f,
  selProduct,
  products,
}: Props) {
  switch (form.priceType) {
    case 'fixed':
      return (
        <RuleField
          label="Selling Price"
          error={errors.fixedPrice}
          hint="Current price shows once a product is selected"
        >
          <RuleInput
            hasError={!!errors.fixedPrice}
            prefix="₦"
            type="number"
            min="0"
            step="0.01"
            placeholder="e.g. 5000"
            value={form.fixedPrice}
            onChange={(e) => f('fixedPrice', e.target.value)}
            autoFocus
          />
        </RuleField>
      );

    case 'formula': {
      const wp = subproductWholesalePrice(selProduct);
      const hasWp = hasWholesalePrice(selProduct);
      const baseLabel =
        form.markupBase === 'wholesale' && hasWp
          ? `wholesale (${fmt(wp)})`
          : `cost${selProduct?.costPrice ? ` (${fmt(selProduct.costPrice)})` : ''}`;
      return (
        <>
          <RuleField label="Markup on">
            <Seg
              options={[
                ['cost', 'Cost'],
                ['wholesale', hasWp ? `Wholesale · ${fmt(wp)}` : 'Wholesale'],
              ]}
              value={form.markupBase === 'wholesale' ? 'wholesale' : 'cost'}
              onChange={(v) => f('markupBase', v)}
              activeColor={META.formula.color}
            />
          </RuleField>
          <RuleField
            label="Markup %"
            error={errors.markupPercentage}
            hint={`New price = ${baseLabel} × (1 + markup%)`}
          >
            <RuleInput
              hasError={!!errors.markupPercentage}
              suffix="%"
              type="number"
              min="0"
              step="0.1"
              placeholder="e.g. 25"
              value={form.markupPercentage}
              onChange={(e) => f('markupPercentage', e.target.value)}
              autoFocus
            />
          </RuleField>
          <div className="flex items-center gap-2 text-[11px] text-amber-700">
            <PiInfo className="h-3.5 w-3.5 shrink-0" />
            {form.markupBase === 'wholesale'
              ? `Products using the wholesale base are skipped when no wholesale price is set`
              : `Products without a cost price will be skipped when applied.`}
          </div>
          {form.markupBase === 'wholesale' && (
            <WholesaleCoverageNote
              products={products}
              selProduct={selProduct}
            />
          )}
        </>
      );
    }

    case 'discount':
      return (
        <>
          <Seg
            options={[
              ['percentage', '% Off'],
              ['fixed', '₦ Off'],
            ]}
            value={form.discountType}
            onChange={(v) => f('discountType', v)}
            activeColor={META.discount.color}
          />
          {form.discountType === 'percentage' ? (
            <RuleField label="Discount %" error={errors.discountPercentage}>
              <RuleInput
                hasError={!!errors.discountPercentage}
                suffix="%"
                type="number"
                min="0"
                max="100"
                step="0.1"
                placeholder="e.g. 15"
                value={form.discountPercentage}
                onChange={(e) => f('discountPercentage', e.target.value)}
                autoFocus
              />
              <PctChips
                value={form.discountPercentage}
                onChange={(v) => f('discountPercentage', v)}
                activeColor={META.discount.color}
              />
            </RuleField>
          ) : (
            <RuleField label="Amount Off (₦)" error={errors.discountAmount}>
              <RuleInput
                hasError={!!errors.discountAmount}
                prefix="₦"
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 500"
                value={form.discountAmount}
                onChange={(e) => f('discountAmount', e.target.value)}
                autoFocus
              />
            </RuleField>
          )}
        </>
      );

    case 'flash_sale':
      return (
        <>
          <RuleField
            label="Flash Discount %"
            error={errors.flashSalePercentage}
          >
            <RuleInput
              hasError={!!errors.flashSalePercentage}
              suffix="%"
              type="number"
              min="0"
              max="100"
              step="0.1"
              placeholder="e.g. 30"
              value={form.flashSalePercentage}
              onChange={(e) => f('flashSalePercentage', e.target.value)}
              autoFocus
            />
            <PctChips
              value={form.flashSalePercentage}
              onChange={(v) => f('flashSalePercentage', v)}
              activeColor={META.flash_sale.color}
            />
          </RuleField>
          <RuleField label="Limited Qty" hint="Leave blank for unlimited">
            <RuleInput
              type="number"
              min="0"
              step="1"
              placeholder="e.g. 50"
              value={form.flashSaleQty}
              onChange={(e) => f('flashSaleQty', e.target.value)}
            />
          </RuleField>
        </>
      );

    case 'bundle':
      return (
        <BundleFields
          form={form}
          errors={errors}
          f={f}
          selProduct={selProduct}
          products={products}
        />
      );

    case 'cart_threshold':
      return (
        <>
          <RuleField
            label="Spend threshold"
            error={errors.thresholdAmount}
            hint="Discount activates when the cart subtotal reaches this amount"
          >
            <RuleInput
              type="number"
              min="0"
              step="any"
              prefix="₦"
              value={form.thresholdAmount}
              hasError={!!errors.thresholdAmount}
              onChange={(e) => f('thresholdAmount', e.target.value)}
            />
          </RuleField>

          <RuleField label="Discount type">
            <Seg
              options={[
                ['percentage', '% Off'],
                ['fixed', '₦ Off'],
              ]}
              value={form.discountType}
              onChange={(v) => f('discountType', v)}
              activeColor={META.cart_threshold.color}
            />
          </RuleField>

          <RuleField
            label={
              form.discountType === 'fixed'
                ? 'Discount amount'
                : 'Discount percentage'
            }
            error={
              form.discountType === 'fixed'
                ? errors.discountAmount
                : errors.discountPercentage
            }
          >
            <RuleInput
              type="number"
              min="0"
              step="any"
              prefix={form.discountType === 'fixed' ? '₦' : undefined}
              suffix={form.discountType !== 'fixed' ? '%' : undefined}
              value={
                form.discountType === 'fixed'
                  ? form.discountAmount
                  : form.discountPercentage
              }
              hasError={
                !!(form.discountType === 'fixed'
                  ? errors.discountAmount
                  : errors.discountPercentage)
              }
              onChange={(e) =>
                f(
                  form.discountType === 'fixed'
                    ? 'discountAmount'
                    : 'discountPercentage',
                  e.target.value
                )
              }
            />
            {form.discountType !== 'fixed' && (
              <PctChips
                value={form.discountPercentage}
                onChange={(v) => f('discountPercentage', v)}
                activeColor={META.cart_threshold.color}
              />
            )}
          </RuleField>
        </>
      );

    default:
      return null;
  }
}
