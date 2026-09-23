'use client';
import React, { useState } from 'react';
import type { KioskConfig, KioskProduct } from './types';
import { ScannerMark } from './scanner-mark';
export function ProductResult({ product, config }: { product: KioskProduct; config: KioskConfig }) {
  const [confirmed, setConfirmed] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
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
        <span className="kiosk-eyebrow">Age-restricted product</span>
        <h1 id="age-title">Are you 18 or older?</h1>
        <p>Confirm your age to view this alcoholic beverage.</p>
        <button className="kiosk-primary" onClick={() => setConfirmed(true)}>
          I am 18 or older
        </button>
        <p className="kiosk-small">You can also scan a different product.</p>
      </section>
    );
  return (
    <section
      className={`kiosk-result ${!config.settings.displayImages ? 'without-image' : ''}`}
      aria-label="Product price"
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
          <p className="kiosk-price">{money(product.price)}</p>
          {product.taxLabel && <p className="kiosk-small">{product.taxLabel}</p>}
          {product.savings !== undefined && (
            <p className="kiosk-saving">
              Save {money(product.savings)}
              {product.discountPercentage !== undefined
                ? ` · ${product.discountPercentage}% off`
                : ''}
            </p>
          )}
        </div>
        {product.availability && (
          <p className={`kiosk-stock ${product.availability.toLowerCase()}`}>
            <span />
            {
              {
                IN_STOCK: 'In stock',
                LOW_STOCK: 'Low stock',
                OUT_OF_STOCK: 'Out of stock',
              }[product.availability]
            }
          </p>
        )}
        {product.quantity !== undefined && <p>{product.quantity} units available</p>}
        {product.staffMessage && <p>{product.staffMessage}</p>}
        {config.store && (
          <p className="kiosk-store">
            At {config.store.name} · {config.store.location}
          </p>
        )}
        {config.tenantName && <p>Sold by {config.tenantName}</p>}
        {product.barcode && <p className="kiosk-small">Barcode {product.barcode}</p>}
        {config.settings.resultMessage && (
          <p className="kiosk-small">{config.settings.resultMessage}</p>
        )}
      </div>
    </section>
  );
}
