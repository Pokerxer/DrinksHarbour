'use client';
import { useEffect, useRef } from 'react';
import type { KioskProduct } from './types';
import { formatMoney } from './money';
import { typeLabel } from './metrics';

const STOCK: Record<string, string> = {
  IN_STOCK: 'In stock',
  LOW_STOCK: 'Low stock',
  OUT_OF_STOCK: 'Out of stock',
};

/** Bottom-sheet product record — opened by tapping any result card. */
export function PhoneDetail({
  product,
  currency,
  onClose,
}: {
  product: KioskProduct;
  currency: string;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  const money = (value: number) => formatMoney(value, currency);
  return (
    <div
      className="phone-detail-backdrop"
      onClick={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        className="phone-detail"
        role="dialog"
        aria-modal="true"
        aria-label={`Product details — ${product.name}`}
      >
        <button
          ref={closeRef}
          className="phone-detail-close"
          aria-label="Close details"
          onClick={onClose}
        >
          ✕
        </button>
        {product.image && (
          <img
            src={product.image}
            alt={product.name}
            referrerPolicy="no-referrer"
            onError={(event) => (event.currentTarget.style.visibility = 'hidden')}
          />
        )}
        {product.brand && <p className="kiosk-eyebrow">{product.brand}</p>}
        <h2>{product.name}</h2>
        <p className="phone-detail-price">
          {money(product.price)}
          {product.originalPrice !== undefined && (
            <>
              {' '}
              <del>{money(product.originalPrice)}</del>
              {product.savings !== undefined && (
                <span className="phone-badged">Save {money(product.savings)}</span>
              )}
            </>
          )}
        </p>
        <p className="phone-toned">{product.taxLabel}</p>
        <dl className="phone-detail-rows">
          {product.size && (
            <>
              <dt>Size</dt>
              <dd>{product.size}</dd>
            </>
          )}
          {product.abv !== undefined && (
            <>
              <dt>ABV</dt>
              <dd>{product.abv}% ABV</dd>
            </>
          )}
          {product.volume && (
            <>
              <dt>Volume</dt>
              <dd>{product.volume}</dd>
            </>
          )}
          {product.origin && (
            <>
              <dt>Origin</dt>
              <dd>{product.origin}</dd>
            </>
          )}
          {product.beverageType && (
            <>
              <dt>Type</dt>
              <dd>{typeLabel(product.beverageType) ?? product.beverageType}</dd>
            </>
          )}
          {product.availability && (
            <>
              <dt>Stock</dt>
              <dd>
                <span
                  className={`phone-stock ${product.availability.toLowerCase()}`}
                >
                  {STOCK[product.availability]}
                </span>
              </dd>
            </>
          )}
          {product.barcode && (
            <>
              <dt>Barcode</dt>
              <dd className="phone-mono">{product.barcode}</dd>
            </>
          )}
        </dl>
      </section>
    </div>
  );
}
