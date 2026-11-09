'use client';
import React, { useState } from 'react';
import type { KioskConfig, KioskProduct } from './types';
import { ScannerMark } from './scanner-mark';
import { useCountUp } from './use-count-up';
import { useCopy } from './copy';

export function ProductResult({
  product,
  config,
  compareSlot,
}: {
  product: KioskProduct;
  config: KioskConfig;
  compareSlot?: { added: boolean; full: boolean; onAdd: () => void };
}) {
  const { t } = useCopy();
  const [confirmed, setConfirmed] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const reduced =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const countedPrice = useCountUp(product.price, reduced);
  const money = (value: number) =>
    new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: product.currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
  if (product.alcoholic && !confirmed)
    return (
      <section className="kiosk-status" aria-labelledby="age-title">
        <span className="kiosk-eyebrow">{t('ageEyebrow')}</span>
        <h1 id="age-title">{t('ageTitle')}</h1>
        <p>{t('ageBody')}</p>
        <button className="kiosk-primary" onClick={() => setConfirmed(true)}>
          {t('ageYes')}
        </button>
        <p className="kiosk-small">{t('ageSkip')}</p>
      </section>
    );
  return (
    <section
      className={`kiosk-result ${!config.settings.displayImages ? 'without-image' : ''}`}
      aria-label={t('resultAria')}
    >
      {config.settings.displayImages && (
        <div className="kiosk-image">
          {product.image && !imageFailed ? (
            <img
              src={product.image}
              alt={product.name}
              onError={() => setImageFailed(true)}
              referrerPolicy="no-referrer"
            />
          ) : (
            <ScannerMark />
          )}
        </div>
      )}
      <div className="kiosk-details">
        {product.brand && <p className="kiosk-eyebrow">{product.brand}</p>}
        <h1>{product.name}</h1>
        {product.size && <p className="kiosk-size">{product.size}</p>}
        <div className="kiosk-price-block">
          {product.originalPrice !== undefined && <del>{money(product.originalPrice)}</del>}
          <p className="kiosk-price">{money(countedPrice)}</p>
          {product.taxLabel && <p className="kiosk-small">{product.taxLabel}</p>}
          {product.savings !== undefined && (
            <p className="kiosk-saving">
              {t('save', { value: money(product.savings) })}
              {product.discountPercentage !== undefined
                ? ` · ${t('pctOff', { pct: product.discountPercentage })}`
                : ''}
            </p>
          )}
        </div>
        {product.availability && (
          <p className={`kiosk-stock ${product.availability.toLowerCase()}`}>
            <span />
            {
              {
                IN_STOCK: t('inStock'),
                LOW_STOCK: t('lowStock'),
                OUT_OF_STOCK: t('outOfStock'),
              }[product.availability]
            }
          </p>
        )}
        {product.quantity !== undefined && (
          <p>{t('unitsAvailable', { qty: product.quantity })}</p>
        )}
        {product.staffMessage && <p>{product.staffMessage}</p>}
        {config.store && (
          <p className="kiosk-store">
            {t('atStore', {
              store: config.store.name,
              location: config.store.location,
            })}
          </p>
        )}
        {config.tenantName && <p>{t('soldBy', { name: config.tenantName })}</p>}
        {product.barcode && (
          <p className="kiosk-small">{t('barcodeValue', { code: product.barcode })}</p>
        )}
        {config.settings.resultMessage && (
          <p className="kiosk-small">{config.settings.resultMessage}</p>
        )}
        {compareSlot && (
          <button
            className="kiosk-primary kiosk-add"
            onClick={compareSlot.onAdd}
            disabled={compareSlot.full && !compareSlot.added}
          >
            {compareSlot.added
              ? t('added')
              : compareSlot.full
                ? t('trayFullRemove')
                : t('addCompare')}
          </button>
        )}
      </div>
    </section>
  );
}
