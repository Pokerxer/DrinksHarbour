'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Image from 'next/image';
import toast from 'react-hot-toast';
import {
  PiX,
  PiCheckCircle,
  PiPrinter,
  PiUser,
  PiFileText,
  PiCurrencyNgn,
  PiCreditCard,
  PiBank,
  PiDeviceMobile,
  PiArrowLeft,
  PiArrowRight,
  PiTicket,
  PiLightningBold,
  PiShoppingCart,
  PiGift,
  PiWarning,
  PiStar,
  PiWallet,
} from 'react-icons/pi';
import {
  usePOSCart,
  usePOSAuth,
  usePOSUI,
  usePOSSaleSignal,
  usePOSPricelist,
  computeRewardDiscount,
  getEffectiveBundlePrice,
  getEffectiveBundlePriceForItem,
  usePOSSettings,
  usePOSActiveShop,
  usePOSWarehouse,
  usePOSLinkedSalesOrder,
} from '@/app/shared/point-of-sale/store';
import { posApi } from '@/app/shared/point-of-sale/api';
import { createOrder as createOrderOffline } from '@/app/shared/point-of-sale/offline/api';
import { useOnlineStatus } from '@/app/shared/point-of-sale/offline/use-online-status';
import { formatCurrency } from '@/app/shared/point-of-sale/utils';
import { POSOrderResponse } from '@/app/shared/point-of-sale/types';
import cn from '@core/utils/class-names';

// ── Types & constants ─────────────────────────────────────────────────────────

type PaymentLine = {
  id: string;
  method: string;
  label: string;
  amount: number;
};

const METHODS = [
  { value: 'cash', label: 'Cash', icon: <PiCurrencyNgn className="h-5 w-5" /> },
  {
    value: 'card',
    label: 'Card / POS',
    icon: <PiCreditCard className="h-5 w-5" />,
  },
  {
    value: 'bank_transfer',
    label: 'Bank Transfer',
    icon: <PiBank className="h-5 w-5" />,
  },
  {
    value: 'mobile_money',
    label: 'Mobile Money',
    icon: <PiDeviceMobile className="h-5 w-5" />,
  },
];

// Quick-add denominations (Nigerian naira)
const QUICK = [1_000, 2_000, 5_000];

// ── Receipt ───────────────────────────────────────────────────────────────────

const METHOD_LABELS: Record<string, string> = {
  cash: 'CASH',
  card: 'CARD / POS',
  bank_transfer: 'BANK TRANSFER',
  mobile_money: 'MOBILE MONEY',
  wallet: 'WALLET',
  split: 'SPLIT',
};

// All receipt colours are inline — bypasses Next.js dark-mode class overrides.
const R = {
  paper: { backgroundColor: '#ffffff', color: '#111111' },
  muted: { color: '#555555' },
  red: { color: '#b20202' },
  green: { color: '#15803d' },
  bold: { fontWeight: 700 as const },
  center: { textAlign: 'center' as const },
  divider: { borderTop: '1px dashed #aaaaaa', margin: '7px 0' },
  rule: { borderTop: '2px solid #222222', margin: '7px 0' },
};

function ReceiptScreen({
  order,
  paymentLines = [],
  onNewSale,
  cartSnapshot = [],
  appliedCode,
  autoDiscounts = [],
  nextOrderCode,
  nocSettings,
}: {
  order: POSOrderResponse;
  paymentLines?: PaymentLine[];
  onNewSale: () => void;
  cartSnapshot?: import('@/app/shared/point-of-sale/types').POSCartItem[];
  appliedCode?: AppliedCode;
  autoDiscounts?: AppliedDiscount[];
  nextOrderCode?: string | null;
  nocSettings?: Partial<
    import('@/app/shared/point-of-sale/types').POSNextOrderCouponConfig
  >;
}) {
  const { staff, tenant: posTenant } = usePOSAuth();
  const posTenantName = posTenant?.name;
  const settings = usePOSSettings();
  const {
    subtotal: cartSubtotal,
    discountAmount: cartDiscount,
    customer,
    note: cartNote,
  } = usePOSCart();
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (settings.autoPrintReceipt) {
      const t = setTimeout(() => handlePrint(), 600);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const storeName = (posTenantName || 'DRINKS HARBOUR').toUpperCase();
  const staffName = staff
    ? staff.posName || `${staff.firstName} ${staff.lastName}`.trim()
    : '—';
  const hasCustomer = !!customer.customerId;
  const custName = hasCustomer
    ? `${customer.firstName} ${customer.lastName}`.trim()
    : null;

  const displaySubtotal = order.subtotal ?? cartSubtotal;
  const displayDiscount = order.discountTotal ?? cartDiscount;
  const displayNote = order.note || cartNote;

  const receiptDate = new Date(order.placedAt).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  function handlePrint() {
    const el = printRef.current;
    if (!el) return;
    const win = window.open(
      '',
      '_blank',
      'width=400,height=750,scrollbars=yes'
    );
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head>
      <title>${order.receiptNumber}</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:'Courier New',Courier,monospace;font-size:12px;
             background:#fff;color:#111;max-width:384px;margin:0 auto;padding:8px 12px}
        @page{margin:0}
        @media print{body{width:100%;max-width:100%;padding:4px 6px;font-size:11px}}
      </style>
    </head><body>${el.innerHTML}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
      win.close();
    }, 400);
  }

  // Shared row: label left, value right — all inline styles
  function Row({
    label,
    value,
    vStyle,
  }: {
    label: string;
    value: string;
    vStyle?: React.CSSProperties;
  }) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          lineHeight: '1.7',
        }}
      >
        <span
          style={{
            flex: 1,
            textTransform: 'uppercase',
            letterSpacing: '0.02em',
          }}
        >
          {label}
        </span>
        <span
          style={{
            whiteSpace: 'nowrap',
            fontVariantNumeric: 'tabular-nums',
            ...vStyle,
          }}
        >
          {value}
        </span>
      </div>
    );
  }

  return (
    /* Transparent overlay — the sell page shows through the blur behind */
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        padding: '24px 16px',
        overflow: 'hidden',
      }}
    >
      {/* Receipt card — scrollable when tall */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '100%',
          width: 380,
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,.6)',
        }}
      >
        {/* Success banner */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            backgroundColor: (order as any).isOffline ? '#b45309' : '#16a34a',
            padding: '12px 20px',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              backgroundColor: 'rgba(255,255,255,.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <PiCheckCircle style={{ width: 20, height: 20, color: '#fff' }} />
          </div>
          <div>
            <p style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>
              {(order as any).isOffline
                ? 'Recorded offline'
                : 'Payment successful'}
            </p>
            <p
              style={{
                color: (order as any).isOffline ? '#fde68a' : '#bbf7d0',
                fontSize: 12,
              }}
            >
              {formatCurrency(order.total)} &nbsp;·&nbsp;{' '}
              {METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod}
              {(order as any).isOffline && ' · will sync when online'}
            </p>
          </div>
        </div>

        {/* Receipt paper — scrollable */}
        <div style={{ overflowY: 'auto', backgroundColor: '#ffffff' }}>
          <div
            ref={printRef}
            style={{
              ...R.paper,
              fontFamily: "'Courier New', Courier, monospace",
              fontSize: 12,
              lineHeight: 1.6,
              padding: '24px 20px 20px',
            }}
          >
            {/* Store header — name from POS tenant, address from settings */}
            {!settings.basicReceipt && (
              <div style={{ ...R.center, marginBottom: 8 }}>
                <p style={{ ...R.bold, fontSize: 15, letterSpacing: '0.1em' }}>
                  {storeName}
                </p>
                {settings.receiptHeader ? (
                  <p
                    style={{
                      ...R.muted,
                      fontSize: 10,
                      whiteSpace: 'pre-line',
                      marginTop: 2,
                    }}
                  >
                    {settings.receiptHeader}
                  </p>
                ) : null}
              </div>
            )}

            <div style={R.rule} />

            {/* Order meta */}
            <Row label="Receipt #" value={order.receiptNumber} />
            {settings.showOrderNumber && order.orderNumber && (
              <Row label="Order #" value={order.orderNumber} />
            )}
            <Row label="Date" value={receiptDate} />
            {settings.showCashierName && (
              <Row label="Cashier" value={staffName} />
            )}
            {custName && <Row label="Customer" value={custName} />}
            <Row
              label="Items"
              value={String(
                (order.items || []).reduce((s, it) => s + it.quantity, 0)
              )}
            />

            <div style={R.rule} />

            {/* Column headers */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                ...R.muted,
                fontSize: 10,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              <span style={{ flex: 1 }}>Description</span>
              <span>Amount</span>
            </div>
            <div style={R.divider} />

            {/* Items — grouped by combo when cartSnapshot is available */}
            {(() => {
              // Augment server receipt items with comboRef from the cart snapshot
              // (server items and cart items are in the same order)
              const augmented = (order.items || []).map((item, i) => ({
                ...item,
                comboRef: cartSnapshot[i]?.comboRef,
              }));

              // Build display groups: combo items grouped under a header
              type Group =
                | { kind: 'item'; idx: number }
                | {
                    kind: 'combo';
                    instanceId: string;
                    comboName: string;
                    indices: number[];
                  };

              const seen = new Set<string>();
              const groups: Group[] = [];

              augmented.forEach((item, i) => {
                if (item.comboRef?.instanceId) {
                  const id = item.comboRef.instanceId;
                  if (!seen.has(id)) {
                    seen.add(id);
                    groups.push({
                      kind: 'combo',
                      instanceId: id,
                      comboName: item.comboRef.comboName,
                      indices: augmented
                        .map((a, j) => (a.comboRef?.instanceId === id ? j : -1))
                        .filter((j) => j >= 0),
                    });
                  }
                } else {
                  groups.push({ kind: 'item', idx: i });
                }
              });

              function renderLine(
                item: (typeof augmented)[0],
                i: number,
                indent = false
              ) {
                const isGet = item.bxgyRole === 'get';
                const price = item.priceAtPurchase ?? 0;
                const lineTotal = item.itemSubtotal ?? price * item.quantity;
                const label =
                  (item.name || 'Item') +
                  (item.variant ? ` (${item.variant})` : '');
                const maxLen = indent ? 23 : 26;
                const truncated =
                  label.length > maxLen
                    ? label.slice(0, maxLen - 1) + '…'
                    : label;
                const discPct =
                  price > 0 && item.discountAmount > 0
                    ? Math.round(
                        (item.discountAmount / (price * item.quantity)) * 100
                      )
                    : 0;
                return (
                  <div
                    key={i}
                    style={{
                      marginBottom: indent ? 5 : 8,
                      paddingLeft: indent ? 8 : 0,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        ...R.bold,
                      }}
                    >
                      <span style={{ flex: 1, paddingRight: 8 }}>
                        {truncated}
                        {isGet && (
                          <span
                            style={{
                              display: 'inline-block',
                              background: '#d1fae5',
                              color: '#059669',
                              fontSize: 9,
                              fontWeight: 700,
                              padding: '1px 5px',
                              borderRadius: 3,
                              marginLeft: 4,
                              verticalAlign: 'middle',
                            }}
                          >
                            GET
                          </span>
                        )}
                      </span>
                      <span
                        style={{
                          whiteSpace: 'nowrap',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {formatCurrency(lineTotal)}
                      </span>
                    </div>
                    <div
                      style={{
                        paddingLeft: indent ? 0 : 8,
                        fontSize: 10,
                        ...R.muted,
                      }}
                    >
                      {item.quantity} ×{' '}
                      {isGet ? formatCurrency(0) : formatCurrency(price)}
                      {isGet && (
                        <span style={{ marginLeft: 4, color: '#059669' }}>
                          FREE
                        </span>
                      )}
                      {!isGet && item.discountAmount > 0 && (
                        <span style={{ marginLeft: 6, ...R.red }}>
                          combo -{discPct}% (-
                          {formatCurrency(item.discountAmount)})
                        </span>
                      )}
                    </div>
                  </div>
                );
              }

              return groups.map((group, gi) => {
                if (group.kind === 'item') {
                  return renderLine(augmented[group.idx], group.idx, false);
                }

                // Combo group
                const groupItems = group.indices.map((j) => augmented[j]);
                const comboTotal = groupItems.reduce(
                  (s, it) => s + (it.itemSubtotal ?? 0),
                  0
                );
                const comboSaving = groupItems.reduce(
                  (s, it) => s + (it.discountAmount ?? 0),
                  0
                );
                const comboName =
                  group.comboName.length > 24
                    ? group.comboName.slice(0, 23) + '…'
                    : group.comboName;

                return (
                  <div key={group.instanceId} style={{ marginBottom: 10 }}>
                    {/* Combo header */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 10,
                        ...R.bold,
                        ...R.red,
                        borderTop: '1px dashed #e0e0e0',
                        paddingTop: 6,
                        marginTop: 4,
                      }}
                    >
                      <span>🎁 {comboName.toUpperCase()}</span>
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {formatCurrency(comboTotal)}
                      </span>
                    </div>
                    {/* Combo saving line */}
                    {comboSaving > 0 && (
                      <div
                        style={{ fontSize: 9, ...R.green, paddingBottom: 3 }}
                      >
                        Combo saving: -{formatCurrency(comboSaving)}
                      </div>
                    )}
                    {/* Combo items */}
                    {groupItems.map((item, ii) =>
                      renderLine(item, group.indices[ii], true)
                    )}
                    <div
                      style={{
                        borderBottom: '1px dashed #e0e0e0',
                        marginBottom: 4,
                      }}
                    />
                  </div>
                );
              });
            })()}

            <div style={R.divider} />

            {/* Totals */}
            {(() => {
              // Sum all item-level discounts (combo discounts, cashier discounts)
              const totalItemDisc = (order.items || []).reduce(
                (s, it) => s + (it.discountAmount ?? 0),
                0
              );
              // Gross before any discounts = sum(priceAtPurchase × qty)
              const grossSubtotal = (order.items || []).reduce(
                (s, it) => s + (it.priceAtPurchase ?? 0) * it.quantity,
                0
              );
              const hasItemDisc = totalItemDisc > 0.005;
              const hasOrderDisc = displayDiscount > 0.005;
              const hasPricelist = (order.pricelistSavings ?? 0) > 0.005;
              const showBreakdown = hasItemDisc || hasOrderDisc || hasPricelist;

              // Build named discount rows; fall back to a single generic row
              const autoTotal = autoDiscounts.reduce(
                (s, d) => s + d.discount,
                0
              );
              // Code's share = whatever the server stored minus the auto-discounts we computed
              const codePortion =
                appliedCode && hasOrderDisc
                  ? Math.max(0, displayDiscount - autoTotal)
                  : 0;

              return (
                <>
                  {showBreakdown && (
                    <>
                      {hasPricelist && (
                        <>
                          <Row
                            label="Original Subtotal"
                            value={formatCurrency(
                              order.originalSubtotal ?? grossSubtotal
                            )}
                          />
                          <Row
                            label={
                              order.pricelistName
                                ? `Pricelist (${order.pricelistName})`
                                : 'Pricelist'
                            }
                            value={`-${formatCurrency(order.pricelistSavings!)}`}
                            vStyle={R.green}
                          />
                          <div style={R.divider} />
                        </>
                      )}
                      <Row
                        label="Gross Subtotal"
                        value={formatCurrency(grossSubtotal)}
                      />
                      {hasItemDisc && (
                        <Row
                          label="Item Discounts"
                          value={`-${formatCurrency(totalItemDisc)}`}
                          vStyle={R.red}
                        />
                      )}
                      {/* Named auto-discounts (promotions + bxgy) */}
                      {autoDiscounts.map((d) => (
                        <Row
                          key={d.id}
                          label={d.name}
                          value={`-${formatCurrency(d.discount)}`}
                          vStyle={R.red}
                        />
                      ))}
                      {/* Code row */}
                      {codePortion > 0 && (
                        <Row
                          label={
                            appliedCode
                              ? `${appliedCode.kind === 'coupon' ? 'Coupon' : 'Code'} (${appliedCode.code})`
                              : 'Code Discount'
                          }
                          value={`-${formatCurrency(codePortion)}`}
                          vStyle={R.red}
                        />
                      )}
                      {/* Fallback: no named discounts but server recorded one (e.g. cart-level cashier discount) */}
                      {autoDiscounts.length === 0 &&
                        !appliedCode &&
                        hasOrderDisc && (
                          <Row
                            label="Order Discount"
                            value={`-${formatCurrency(displayDiscount)}`}
                            vStyle={R.red}
                          />
                        )}
                      {/* Cart-level cashier discount alongside named discounts */}
                      {(autoDiscounts.length > 0 || appliedCode) &&
                        hasOrderDisc &&
                        autoTotal + codePortion < displayDiscount - 0.005 && (
                          <Row
                            label="Order Discount"
                            value={`-${formatCurrency(displayDiscount - autoTotal - codePortion)}`}
                            vStyle={R.red}
                          />
                        )}
                    </>
                  )}
                </>
              );
            })()}
            <div style={R.rule} />
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                ...R.bold,
                fontSize: 14,
              }}
            >
              <span>TOTAL</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatCurrency(order.total)}
              </span>
            </div>
            <div style={R.rule} />

            {/* Payment */}
            {paymentLines.length > 1 ? (
              paymentLines.map((ln, i) => (
                <Row
                  key={i}
                  label={ln.label}
                  value={formatCurrency(ln.amount)}
                />
              ))
            ) : (
              <>
                <Row
                  label={
                    METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod
                  }
                  value={formatCurrency(order.total)}
                />
                {order.amountTendered != null &&
                  order.amountTendered !== order.total && (
                    <Row
                      label="TENDERED"
                      value={formatCurrency(order.amountTendered)}
                      vStyle={R.muted}
                    />
                  )}
              </>
            )}
            {order.change > 0 && (
              <Row
                label="CHANGE"
                value={formatCurrency(order.change)}
                vStyle={{ ...R.green, ...R.bold }}
              />
            )}

            {/* Note */}
            {displayNote && (
              <>
                <div style={R.divider} />
                <p style={{ fontSize: 10, fontStyle: 'italic', ...R.muted }}>
                  Note: {displayNote}
                </p>
              </>
            )}

            <div style={R.rule} />

            {/* Tax line (estimated — prices assumed VAT-inclusive) */}
            {settings.showTaxOnReceipt && settings.taxRate > 0 && (
              <>
                <div style={R.divider} />
                <Row
                  label={`VAT ${settings.taxRate}%`}
                  value={formatCurrency(
                    (order.total * settings.taxRate) / (100 + settings.taxRate)
                  )}
                  vStyle={R.muted}
                />
              </>
            )}

            {/* Footer */}
            <div
              style={{ ...R.center, fontSize: 10, ...R.muted, marginTop: 4 }}
            >
              {settings.receiptFooter ? (
                <p style={{ whiteSpace: 'pre-line', marginBottom: 4 }}>
                  {settings.receiptFooter}
                </p>
              ) : (
                <>
                  <p style={{ ...R.bold, color: '#222' }}>
                    *** THANK YOU FOR YOUR PURCHASE ***
                  </p>
                  <p style={{ marginTop: 3 }}>
                    Goods are not returnable unless defective.
                  </p>
                  <p>Please retain this receipt for reference.</p>
                </>
              )}
              <p style={{ marginTop: 8, fontSize: 9, color: '#aaa' }}>
                {order.receiptNumber}
              </p>
            </div>

            {/* Next-order coupon */}
            {nextOrderCode && nocSettings && (
              <>
                <div style={R.divider} />
                <div style={{ ...R.center, marginTop: 4 }}>
                  <p style={{ fontSize: 10, ...R.bold, color: '#222' }}>
                    🎁 YOUR NEXT ORDER COUPON
                  </p>
                  <p
                    style={{
                      fontFamily: 'monospace',
                      fontSize: 14,
                      ...R.bold,
                      letterSpacing: '0.12em',
                      color: '#b20202',
                      marginTop: 4,
                    }}
                  >
                    {nextOrderCode}
                  </p>
                  <p style={{ fontSize: 9, ...R.muted, marginTop: 2 }}>
                    {nocSettings.type === 'pct'
                      ? `${nocSettings.value}% off`
                      : `₦${(nocSettings.value ?? 0).toLocaleString()} off`}{' '}
                    your next order
                  </p>
                  <p style={{ fontSize: 9, ...R.muted }}>
                    Valid for {nocSettings.validDays ?? 30} days
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
        {/* end scrollable */}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 0, flexShrink: 0 }}>
          <button
            type="button"
            onClick={handlePrint}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              border: 'none',
              borderTop: '1px solid #e5e7eb',
              padding: '14px 0',
              fontSize: 13,
              fontWeight: 600,
              color: '#374151',
              backgroundColor: '#f9fafb',
              cursor: 'pointer',
            }}
          >
            <PiPrinter style={{ width: 15, height: 15 }} /> Print
          </button>
          <button
            type="button"
            onClick={onNewSale}
            style={{
              flex: 1,
              border: 'none',
              borderTop: '1px solid #b20202',
              padding: '14px 0',
              fontSize: 13,
              fontWeight: 700,
              color: '#fff',
              backgroundColor: '#b20202',
              cursor: 'pointer',
            }}
          >
            New Sale
          </button>
        </div>
      </div>
      {/* end receipt card */}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

// ── Discount engine ───────────────────────────────────────────────────────────

import type {
  POSSettings,
  POSCartItem,
  POSDiscountReward,
  POSRewardApplyOn,
  POSCoupon,
  POSDiscountCode,
  POSPromotion,
  POSBuyXGetY,
} from '@/app/shared/point-of-sale/types';
import type { CartPendingCode } from '@/app/shared/point-of-sale/store';

// AppliedCode is the same shape as CartPendingCode — one canonical type
type AppliedCode = CartPendingCode;

interface AppliedDiscount {
  id: string;
  name: string;
  kind: 'code' | 'promotion' | 'bxgy';
  discount: number; // ₦ amount
  color?: string;
  detail?: string; // human-readable e.g. "10% off order"
}

// Resolve the effective reward from a coupon/code (reward obj beats legacy fields)
function resolveReward(item: {
  reward?: POSDiscountReward;
  type: string;
  value: number;
}) {
  return {
    discType: (item.reward?.discountType ?? item.type) as 'pct' | 'fixed',
    discValue: item.reward?.discountValue ?? item.value,
    applyOn: (item.reward?.applyOn ?? 'order') as POSRewardApplyOn,
    maxDiscount: item.reward?.maxDiscount ?? 0,
  };
}

// Apply a reward to the cart; returns ₦ discount amount
function applyReward(
  items: POSCartItem[],
  cartTotal: number,
  discType: 'pct' | 'fixed',
  discValue: number,
  applyOn: POSRewardApplyOn,
  maxDiscount: number
): number {
  if (discValue <= 0) return 0;
  let base = cartTotal;
  if (applyOn === 'cheapest' && items.length) {
    // Apply to the single cheapest unit price (not the line total)
    base = Math.min(...items.map((i) => i.price));
  } else if (applyOn === 'most_expensive' && items.length) {
    base = Math.max(...items.map((i) => i.price));
  }
  const raw =
    discType === 'pct'
      ? Math.round(((base * discValue) / 100) * 100) / 100
      : Math.min(discValue, base);
  return Math.max(0, maxDiscount > 0 ? Math.min(raw, maxDiscount) : raw);
}

// Validate a typed code (coupon or discount code) and return AppliedCode or error string
function validateCode(
  code: string,
  settings: POSSettings | undefined,
  cartTotal: number,
  cartQty: number,
  selectedPricelistId?: string
): AppliedCode | string {
  if (!code.trim()) return 'Enter a code';
  const upper = code.trim().toUpperCase();
  const now = new Date();

  // ── Coupons ─────────────────────────────────────────────────────────────────
  for (const c of settings?.coupons ?? []) {
    if (!c.active || c.code.toUpperCase() !== upper) continue;
    // Channel check
    if (c.availableOn && c.availableOn.pos === false)
      return 'This coupon is not valid at the POS';
    // Date window
    if (c.validFrom && new Date(c.validFrom) > now)
      return 'Coupon not yet valid';
    if (c.validTo && new Date(c.validTo) < now) return 'Coupon has expired';
    // Usage limit
    if ((c.maxUsage ?? 0) > 0 && (c.usageCount ?? 0) >= c.maxUsage!)
      return 'Coupon usage limit reached';
    // Rules
    const minOrder = c.rules?.minOrderValue ?? c.minOrderValue ?? 0;
    const minQty = c.rules?.minQty ?? 0;
    if (minOrder > cartTotal)
      return `Min. order ${formatCurrency(minOrder)} required`;
    if (minQty > cartQty)
      return `Min. ${minQty} item${minQty > 1 ? 's' : ''} in cart required`;
    // Pricelist restriction
    if (
      c.pricelistIds?.length &&
      selectedPricelistId &&
      !c.pricelistIds.includes(selectedPricelistId)
    )
      return 'Coupon is restricted to a different pricelist';
    const r = resolveReward(c);
    return {
      id: c.code,
      code: c.code,
      name: c.name,
      kind: 'coupon' as const,
      ...r,
    };
  }

  // ── Discount codes ───────────────────────────────────────────────────────────
  for (const d of settings?.discountCodes ?? []) {
    if (!d.active || d.code.toUpperCase() !== upper) continue;
    // Channel check
    if (d.availableOn && d.availableOn.pos === false)
      return 'This code is not valid at the POS';
    // Date window
    if (d.validFrom && new Date(d.validFrom) > now) return 'Code not yet valid';
    if (d.validTo && new Date(d.validTo) < now) return 'Code has expired';
    // Usage limit
    if ((d.maxUsage ?? 0) > 0 && (d.usageCount ?? 0) >= d.maxUsage!)
      return 'Code usage limit reached';
    // Rules
    const minOrder = d.rules?.minOrderValue ?? d.minOrderValue ?? 0;
    const minQty = d.rules?.minQty ?? 0;
    if (minOrder > cartTotal)
      return `Min. order ${formatCurrency(minOrder)} required`;
    if (minQty > cartQty)
      return `Min. ${minQty} item${minQty > 1 ? 's' : ''} in cart required`;
    // Pricelist restriction
    if (
      d.pricelistIds?.length &&
      selectedPricelistId &&
      !d.pricelistIds.includes(selectedPricelistId)
    )
      return 'Code is restricted to a different pricelist';
    const r = resolveReward(d);
    return {
      id: d.code,
      code: d.code,
      name: d.name,
      kind: 'discount_code' as const,
      ...r,
      color: d.color,
    };
  }

  return 'Code not found or inactive';
}

// ── Next-order coupon code generator ─────────────────────────────────────────

function generateNextOrderCode(prefix: string): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return (
    prefix +
    Array.from(
      { length: 8 },
      () => chars[Math.floor(Math.random() * chars.length)]
    ).join('')
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function POSPaymentModal() {
  const {
    items,
    total,
    subtotal,
    discountAmount,
    customer,
    note,
    discountType,
    discountValue,
    clearCart,
    appliedRewards,
    rewardsDiscountTotal,
  } = usePOSCart();

  // Snapshot of cart items at the moment the order completes — needed for
  // combo receipt grouping since the cart is cleared on "New Sale".
  const [cartSnapshot, setCartSnapshot] = useState<
    import('@/app/shared/point-of-sale/types').POSCartItem[]
  >([]);
  const { setActiveView } = usePOSUI();
  const { token, terminal, tenant } = usePOSAuth();
  const { notifySale } = usePOSSaleSignal();
  const { selectedPricelist, shopKey } = usePOSPricelist();
  const { activeShop } = usePOSActiveShop();
  const posSettings = tenant?.posSettings;
  const settings = usePOSSettings();
  const isOnline = useOnlineStatus();
  const { warehouseId } = usePOSWarehouse();
  const { linkedSalesOrderId, setLinkedSalesOrderId } = usePOSLinkedSalesOrder();

  const [fulfillStatus, setFulfillStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [fulfillError, setFulfillError] = useState<string | null>(null);

  const [lines, setLines] = useState<PaymentLine[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [inputStr, setInputStr] = useState('0');
  const [freshInput, setFreshInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const [orderResult, setOrderResult] = useState<POSOrderResponse | null>(null);
  const [nextOrderCode, setNextOrderCode] = useState<string | null>(null);

  // ── Discount computation ──────────────────────────────────────────────────────
  // `total` from the cart already includes rewards (subtotal - cartDiscount - rewardsDiscount).
  // `effectiveTotal` IS the cart total — no further deduction needed here.
  const effectiveTotal = total; // cart store owns all discount arithmetic

  // ── Customer / Loyalty helpers ───────────────────────────────────────────────
  const hasCustomer = !!customer.customerId;
  const customerLabel = hasCustomer
    ? `${customer.firstName} ${customer.lastName}`.trim()
    : null;
  const loyaltyEnabled = posSettings?.loyaltyEnabled ?? false;
  const loyaltyPtsPerN = posSettings?.loyaltyPointsPerNaira ?? 0.01;
  const earnedPts =
    hasCustomer && loyaltyEnabled
      ? Math.round(effectiveTotal * loyaltyPtsPerN)
      : 0;
  const currentPts = customer.loyaltyPoints ?? 0;
  const loyaltyR = appliedRewards.find((r) => r.kind === 'loyalty');
  const redeemedPts = loyaltyR
    ? Math.round(
        (loyaltyR.discValue ?? 0) / (posSettings?.loyaltyPointsValue ?? 1)
      )
    : 0;
  const newBalance = Math.max(0, currentPts + earnedPts - redeemedPts);

  // ── Wallet (store credit) ────────────────────────────────────────────────────
  // Wallet is a FULL-payment single tender: the server only debits the wallet for
  // paymentMethod === 'wallet' as a lone tender, never inside a split. So the
  // button is offered only to a real customer whose balance covers the whole
  // total, and selecting it replaces all lines with one fixed wallet line.
  const walletBalance = customer.walletBalance ?? 0;
  const walletEligible =
    hasCustomer && effectiveTotal > 0 && walletBalance >= effectiveTotal;

  // Build AppliedDiscount list from appliedRewards for the breakdown UI + receipt
  const autoDiscounts: AppliedDiscount[] = appliedRewards.map((r) => ({
    id: r.id,
    name: r.name,
    kind: (r.kind === 'promotion'
      ? 'promotion'
      : r.kind === 'bxgy'
        ? 'bxgy'
        : 'code') as AppliedDiscount['kind'],
    discount: computeRewardDiscount(
      r,
      items,
      Math.max(0, subtotal - discountAmount)
    ),
    color: r.color,
    detail: r.detail,
  }));

  // Code reward (coupon / discount_code) — shown separately in the UI
  const appliedCode =
    (appliedRewards.find(
      (r) => r.kind === 'coupon' || r.kind === 'discount_code'
    ) as AppliedCode | undefined) ?? null;
  const codeDiscount = appliedCode
    ? computeRewardDiscount(
        appliedCode,
        items,
        Math.max(0, subtotal - discountAmount)
      )
    : 0;

  const paidTotal = lines.reduce((s, l) => s + l.amount, 0);
  const remaining = effectiveTotal - paidTotal;
  const change = Math.max(0, paidTotal - effectiveTotal);
  const canValidate = remaining <= 0.01 && lines.length > 0;
  const activeLine = lines.find((l) => l.id === activeId) ?? null;

  // ── Line helpers ─────────────────────────────────────────────────────────────

  function applyAmount(id: string, amount: number) {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, amount } : l)));
  }

  function addMethod(method: string, label: string) {
    const existing = lines.find((l) => l.method === method);
    if (existing) {
      setActiveId(existing.id);
      setInputStr(String(existing.amount));
      setFreshInput(true);
      return;
    }
    // When split payments are disabled, replace the current line instead of adding
    if (!settings.splitPayments && lines.length > 0) {
      setLines([]);
      setActiveId(null);
    }
    const amt = parseFloat(Math.max(0, remaining).toFixed(2));
    const id = `ln-${Date.now()}`;
    setLines((prev) => [...prev, { id, method, label, amount: amt }]);
    setActiveId(id);
    setInputStr(amt === 0 ? '0' : String(amt));
    setFreshInput(true);
  }

  // Wallet pays the entire order as a single fixed tender. Clear any other lines
  // and don't make it the active numpad line — its amount must stay at the total.
  function selectWallet() {
    const id = `ln-wallet-${Date.now()}`;
    setLines([
      { id, method: 'wallet', label: 'Wallet', amount: effectiveTotal },
    ]);
    setActiveId(null);
    setInputStr('0');
    setFreshInput(false);
  }

  function removeLine(id: string) {
    setLines((prev) => prev.filter((l) => l.id !== id));
    if (activeId === id) {
      setActiveId(null);
      setInputStr('0');
      setFreshInput(false);
    }
  }

  function selectLine(line: PaymentLine) {
    setActiveId(line.id);
    setInputStr(line.amount === 0 ? '0' : String(line.amount));
    setFreshInput(true);
  }

  function setExact() {
    if (!activeId || remaining <= 0) return;
    const amt = parseFloat(Math.max(0, remaining).toFixed(2));
    setInputStr(String(amt));
    setFreshInput(false);
    applyAmount(activeId, amt);
  }

  // ── Numpad callbacks ─────────────────────────────────────────────────────────

  const pushDigit = useCallback(
    (d: string) => {
      if (!activeId) return;
      let next: string;
      if (freshInput) {
        // First keystroke after selecting — replace the pre-filled value
        next = d === '.' ? '0.' : d === '0' ? '0' : d;
        setFreshInput(false);
      } else if (d === '.') {
        next = inputStr.includes('.')
          ? inputStr
          : inputStr === '0'
            ? '0.'
            : inputStr + '.';
      } else {
        next =
          inputStr === '0'
            ? d
            : inputStr.length >= 10
              ? inputStr
              : inputStr + d;
      }
      setInputStr(next);
      applyAmount(activeId, parseFloat(next) || 0);
    },
    [activeId, inputStr, freshInput]
  ); // eslint-disable-line react-hooks/exhaustive-deps

  const pushBackspace = useCallback(() => {
    if (!activeId) return;
    setFreshInput(false);
    const next = inputStr.length > 1 ? inputStr.slice(0, -1) : '0';
    setInputStr(next);
    applyAmount(activeId, parseFloat(next) || 0);
  }, [activeId, inputStr]); // eslint-disable-line react-hooks/exhaustive-deps

  const pushClear = useCallback(() => {
    if (!activeId) return;
    setInputStr('0');
    setFreshInput(false);
    applyAmount(activeId, 0);
  }, [activeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const addQuick = useCallback(
    (delta: number) => {
      if (!activeId) return;
      const base = parseFloat(inputStr) || 0;
      const next = parseFloat((base + delta).toFixed(2));
      setInputStr(String(next));
      setFreshInput(false);
      applyAmount(activeId, next);
    },
    [activeId, inputStr]
  ); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Physical keyboard ────────────────────────────────────────────────────────

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        pushDigit(e.key);
      } else if (e.key === '.') {
        e.preventDefault();
        pushDigit('.');
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        pushBackspace();
      } else if (e.key === 'Delete') {
        e.preventDefault();
        pushClear();
      } else if (e.key === 'Enter' && canValidate) {
        e.preventDefault();
        handleValidate();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setActiveView('sell');
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pushDigit, pushBackspace, pushClear, canValidate]); // eslint-disable-line

  // ── Auto-validate when fully paid and setting is on ──────────────────────────
  useEffect(() => {
    if (settings.autoValidateOrder && canValidate && !loading && !orderResult) {
      handleValidate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canValidate, settings.autoValidateOrder]);

  // ── Validate ─────────────────────────────────────────────────────────────────

  async function handleValidate() {
    if (!canValidate || loading || !token) return;

    // Wallet single-tender contract — the server is authoritative, but enforce it
    // here too: a wallet line must be the ONLY line, exactly cover the total, and
    // be backed by sufficient balance. Never allow wallet inside a split.
    if (lines.some((l) => l.method === 'wallet')) {
      const ok =
        lines.length === 1 &&
        Math.abs(lines[0].amount - effectiveTotal) < 0.01 &&
        (customer.walletBalance ?? 0) >= effectiveTotal;
      if (!ok) {
        toast.error(
          'Wallet must cover the full order total as the only payment method.'
        );
        return;
      }
    }

    setLoading(true);
    try {
      const orderItems = items.map((item) => {
        const isGet = item.bxgyRef?.role === 'get';
        const effectivePrice = getEffectiveBundlePriceForItem(
          item,
          selectedPricelist
        ).price;
        return {
          subProductId: item.subProductId,
          productId: item.productId,
          sizeId: item.sizeId || undefined,
          quantity: item.quantity,
          // BXGY get items: send the original pre-BXGY price for audit clarity.
          // The server ignores client price and recomputes its own, but offline
          // queues and receipt snapshots use this value.
          price: isGet
            ? (item.bxgyRef?.originalPrice ?? item.price)
            : item.price,
          // Authoritative client-computed price after pricelist + bundle rules.
          // Server uses this as priceAtPurchase when present, ensuring the receipt
          // charge matches what the cart displayed.
          clientPrice: effectivePrice,
          // BXGY get items: 0% item discount — the reward is applied at the
          // order level via totalDisc. Non-BXGY items pass their cashier discount.
          discount: isGet ? 0 : item.discount,
          sku: item.sku,
          variant: item.variant,
          name: item.name,
          bxgyRole: item.bxgyRef?.role, // 'buy' | 'get' — for receipt display
        };
      });

      let paymentMethod: string;
      let amountTendered = 0;
      let splitPayments: { method: string; amount: number }[] = [];

      if (lines.length === 1) {
        paymentMethod = lines[0].method;
        amountTendered = lines[0].amount;
      } else {
        paymentMethod = 'split';
        splitPayments = lines.map((l) => ({
          method: l.method,
          amount: l.amount,
        }));
        amountTendered = lines.find((l) => l.method === 'cash')?.amount ?? 0;
      }

      // Total discount = cart-level discount + all rewards (including BXGY).
      // BXGY is now part of the order-level discount instead of item-level,
      // so the receipt shows it as a named auto-discount rather than doubling
      // it under "Item Discounts".
      const cartDiscFixed =
        discountValue > 0
          ? discountType === 'fixed'
            ? discountValue
            : (subtotal * discountValue) / 100
          : 0;
      const totalDisc = cartDiscFixed + rewardsDiscountTotal;
      const effDiscType = totalDisc > 0 ? 'fixed' : undefined;
      const effDiscValue = totalDisc > 0 ? totalDisc : 0;

      // Pre-pricelist "normal" subtotal as the cashier saw it in the cart.
      // The server uses this to compute pricelist savings on the receipt.
      // BXGY get items use bxgyRef.originalPrice (pre-BXGY baseline) since the
      // BXGY discount is already embedded in item.discount (→ server's discountAmount).
      const cartOriginalSubtotal = items.reduce((s, i) => {
        const unitPrice =
          i.bxgyRef?.role === 'get'
            ? (i.bxgyRef.originalPrice ?? i.price)
            : i.price;
        return s + unitPrice * i.quantity;
      }, 0);

      const result = await createOrderOffline(token, terminal ?? 'retail', {
        items: orderItems,
        customer,
        paymentMethod,
        total: effectiveTotal,
        amountTendered,
        splitPayments,
        discountType: effDiscType,
        discountValue: effDiscValue,
        cartOriginalSubtotal,
        note: note || undefined,
        terminalType: terminal ?? 'retail',
        pricelistId: selectedPricelist?._id ?? undefined,
        // Send the resolved shop key (custom shop _id OR built-in 'retail'/
        // 'wholesale'), matching how the allowed pricelists were fetched — so the
        // server honors the selected pricelist instead of silently dropping it.
        shopId: activeShop?._id ?? shopKey,
      });

      setCartSnapshot([...items]);
      setOrderResult(result.order);
      notifySale();

      // Auto-fulfill the linked sales order (non-blocking — cashier can print/new-sale regardless)
      if (linkedSalesOrderId && token) {
        setFulfillStatus('running');
        posApi.fulfillSalesOrder(token, linkedSalesOrderId, {
          warehouseId: warehouseId || '',
          items: orderItems.map((i: any) => ({
            subProductId: i.subProductId,
            sizeId: i.sizeId,
            quantity: i.quantity,
          })),
        })
          .then(() => { setFulfillStatus('done'); setLinkedSalesOrderId(null); })
          .catch((err: unknown) => {
            setFulfillStatus('error');
            setFulfillError(err instanceof Error ? err.message : 'Fulfillment failed');
          });
      }

      // Increment usage counts for all applied rewards (best-effort, non-blocking)
      if (token && posSettings && appliedRewards.length > 0) {
        const patch: Partial<typeof posSettings> = {};
        const couponIds = new Set(
          appliedRewards
            .filter((r) => r.kind === 'coupon')
            .map((r) => r.code!.toUpperCase())
        );
        const codeIds = new Set(
          appliedRewards
            .filter((r) => r.kind === 'discount_code')
            .map((r) => r.code!.toUpperCase())
        );
        const promoIds = new Set(
          appliedRewards.filter((r) => r.kind === 'promotion').map((r) => r.id)
        );
        const bxgyIds = new Set(
          appliedRewards.filter((r) => r.kind === 'bxgy').map((r) => r.id)
        );

        if (couponIds.size)
          patch.coupons = (posSettings.coupons ?? []).map((c) =>
            couponIds.has(c.code.toUpperCase())
              ? { ...c, usageCount: (c.usageCount ?? 0) + 1 }
              : c
          );
        if (codeIds.size)
          patch.discountCodes = (posSettings.discountCodes ?? []).map((d) =>
            codeIds.has(d.code.toUpperCase())
              ? { ...d, usageCount: (d.usageCount ?? 0) + 1 }
              : d
          );
        if (promoIds.size)
          patch.promotions = (posSettings.promotions ?? []).map((p) =>
            promoIds.has(p._id!)
              ? { ...p, usageCount: (p.usageCount ?? 0) + 1 }
              : p
          );
        if (bxgyIds.size)
          patch.buyXGetY = (posSettings.buyXGetY ?? []).map((b) =>
            bxgyIds.has(b._id!)
              ? { ...b, usageCount: (b.usageCount ?? 0) + 1 }
              : b
          );

        if (Object.keys(patch).length > 0)
          posApi.updatePOSSettings(token, patch).catch(() => {});
      }

      // Update customer loyalty balance (earn + redeem) — best-effort, non-blocking
      if (
        token &&
        customer.customerId &&
        (posSettings?.loyaltyEnabled ?? false)
      ) {
        const loyaltyPtsPerN = posSettings?.loyaltyPointsPerNaira ?? 0.01;
        const earned = Math.round(
          (effectiveTotal / 100) * loyaltyPtsPerN * 100
        );
        const loyaltyR = appliedRewards.find((r) => r.kind === 'loyalty');
        const ptVal = posSettings?.loyaltyPointsValue ?? 1;
        const redeemed = loyaltyR
          ? Math.round((loyaltyR.discValue ?? 0) / (ptVal || 1))
          : 0;
        posApi
          .updateCustomerLoyalty(
            token,
            customer.customerId,
            earned,
            redeemed,
            effectiveTotal,
            result.order?._id
          )
          .catch(() => {});
      }

      // Generate next-order coupon if enabled and order qualifies
      const noc = posSettings?.nextOrderCoupon;
      if (noc?.enabled && effectiveTotal >= (noc.minOrderForCoupon ?? 0)) {
        setNextOrderCode(generateNextOrderCode(noc.codePrefix ?? 'NOC-'));
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setLoading(false);
    }
  }

  function handleNewSale() {
    clearCart(); // also clears appliedRewards via store
    setActiveView('sell');
    setOrderResult(null);
    setLines([]);
    setActiveId(null);
    setInputStr('0');
    setFreshInput(false);
    setNextOrderCode(null);
  }

  // ── Receipt ───────────────────────────────────────────────────────────────────

  if (orderResult)
    return (
      <div className="relative">
        <ReceiptScreen
          order={orderResult}
          paymentLines={lines}
          onNewSale={handleNewSale}
          cartSnapshot={cartSnapshot}
          appliedCode={appliedCode ?? undefined}
          autoDiscounts={autoDiscounts}
          nextOrderCode={nextOrderCode}
          nocSettings={posSettings?.nextOrderCoupon}
        />
        {fulfillStatus !== 'idle' && (
          <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2">
            {fulfillStatus === 'running' && (
              <div className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-medium text-white shadow-lg">
                <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeOpacity=".3"/><path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/></svg>
                Fulfilling linked sales order…
              </div>
            )}
            {fulfillStatus === 'done' && (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-medium text-white shadow-lg">
                ✓ Sales order fulfilled
              </div>
            )}
            {fulfillStatus === 'error' && (
              <div className="rounded-xl bg-red-600 px-4 py-2.5 text-xs font-medium text-white shadow-lg">
                Fulfillment failed: {fulfillError} — fulfill manually from Sales module.
              </div>
            )}
          </div>
        )}
      </div>
    );

  // ── Numpad display value ──────────────────────────────────────────────────────

  const displayValue = activeId
    ? formatCurrency(parseFloat(inputStr) || 0)
    : '—';

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex bg-[#f0f0f0]">
      {/* ══ LEFT PANEL ════════════════════════════════════════════════════════ */}
      <div className="flex w-[340px] shrink-0 flex-col border-r border-gray-200 bg-[#f0f0f0]">
        {/* Payment method buttons */}
        <div className="flex-1 space-y-1.5 overflow-y-auto px-3 pt-3">
          {!isOnline && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
              <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-amber-400" />
              <span className="font-medium">Offline Order</span>
              <span className="text-amber-600">
                — will sync when connection returns
              </span>
            </div>
          )}
          {METHODS.filter((m) =>
            settings.enabledPaymentMethods.includes(m.value)
          ).map((m) => {
            const inUse = lines.some((l) => l.method === m.value);
            const isActive = activeLine?.method === m.value;
            return (
              <button
                key={m.value}
                type="button"
                onClick={() => addMethod(m.value, m.label)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left text-sm font-semibold shadow-sm transition-all active:scale-[0.98]',
                  isActive
                    ? 'border-[#b20202] bg-red-50 text-[#b20202]'
                    : inUse
                      ? 'border-green-300 bg-green-50 text-green-700 hover:border-green-400'
                      : 'border-gray-200 bg-white text-gray-800 hover:border-[#b20202] hover:shadow-md'
                )}
              >
                <span
                  className={
                    isActive
                      ? 'text-[#b20202]'
                      : inUse
                        ? 'text-green-600'
                        : 'text-gray-400'
                  }
                >
                  {m.icon}
                </span>
                <span className="flex-1">
                  {m.label}
                  {!isOnline && m.value !== 'cash' && (
                    <p className="mt-0.5 text-[11px] text-amber-600">
                      Record only — no terminal. Verify with customer on
                      reconnect.
                    </p>
                  )}
                </span>
                {inUse && (
                  <span
                    className={cn(
                      'text-[10px] font-bold uppercase tracking-wide',
                      isActive ? 'text-[#b20202]' : 'text-green-600'
                    )}
                  >
                    {isActive ? 'editing' : 'added'}
                  </span>
                )}
              </button>
            );
          })}

          {/* Wallet — full-payment single tender, only when the customer's store
              credit covers the whole total (server only debits a lone 'wallet'). */}
          {walletEligible &&
            (() => {
              const inUse = lines.some((l) => l.method === 'wallet');
              return (
                <button
                  type="button"
                  onClick={selectWallet}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left text-sm font-semibold shadow-sm transition-all active:scale-[0.98]',
                    inUse
                      ? 'border-green-300 bg-green-50 text-green-700 hover:border-green-400'
                      : 'border-gray-200 bg-white text-gray-800 hover:border-[#b20202] hover:shadow-md'
                  )}
                >
                  <span className={inUse ? 'text-green-600' : 'text-gray-400'}>
                    <PiWallet className="h-5 w-5" />
                  </span>
                  <span className="flex-1">
                    Wallet
                    <p className="mt-0.5 text-[11px] text-gray-500">
                      Balance {formatCurrency(walletBalance)}
                    </p>
                  </span>
                  {inUse && (
                    <span className="text-[10px] font-bold uppercase tracking-wide text-green-600">
                      added
                    </span>
                  )}
                </button>
              );
            })()}
        </div>

        {/* Tips — shown when tipsEnabled */}
        {settings.tipsEnabled && (
          <div className="border-t border-gray-200 px-3 py-2">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              Tip
            </p>
            <div className="flex gap-1.5">
              {[5, 10, 15, 20].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => addMethod('tip', `Tip ${pct}%`)}
                  className="flex-1 rounded-lg border border-gray-200 bg-white py-1.5 text-xs font-semibold text-gray-700 hover:border-[#b20202] hover:text-[#b20202]"
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Customer info */}
        <div className="border-t border-gray-200 px-3 py-2">
          <button
            type="button"
            onClick={() => setActiveView('sell')}
            className={cn(
              'flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors hover:bg-gray-50',
              hasCustomer
                ? 'border-[#b20202]/30 bg-red-50 text-[#b20202]'
                : 'border-gray-200 bg-white text-gray-500'
            )}
          >
            <PiUser className="h-3.5 w-3.5 shrink-0" />
            <span className="flex-1 truncate text-left">
              {hasCustomer ? customerLabel : 'Walk-in Customer'}
            </span>
            {hasCustomer && loyaltyEnabled && currentPts > 0 && (
              <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                {currentPts.toLocaleString()}pts
              </span>
            )}
          </button>
        </div>

        {/* ── Calculator display ── */}
        <div className="mx-3 mb-2 overflow-hidden rounded-xl bg-gray-900">
          <div className="px-4 pb-3 pt-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">
              {activeLine ? activeLine.label : 'Select a method'}
            </p>
            <p
              className={cn(
                'mt-0.5 text-right text-3xl font-bold tabular-nums transition-colors',
                freshInput ? 'text-gray-400' : 'text-white'
              )}
            >
              {displayValue}
            </p>
          </div>

          {/* Exact shortcut inside display */}
          {activeId && remaining > 0.01 && (
            <button
              type="button"
              onClick={setExact}
              className="flex w-full items-center justify-between border-t border-gray-700 px-4 py-2 text-xs font-semibold text-green-400 hover:bg-gray-800"
            >
              <span className="flex items-center gap-1.5">
                <PiArrowRight className="h-3 w-3" /> Exact amount
              </span>
              <span>{formatCurrency(remaining)}</span>
            </button>
          )}
        </div>

        {/* ── Numpad ── */}
        <div className="shrink-0 px-3 pb-2">
          <div className="grid grid-cols-4 gap-1.5">
            {/* Rows 1-3: digits + quick-add */}
            {(['1', '2', '3'] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => pushDigit(d)}
                className="flex h-12 items-center justify-center rounded-xl border border-gray-200 bg-white text-base font-semibold text-gray-800 shadow-sm transition-all hover:bg-gray-50 active:scale-95"
              >
                {d}
              </button>
            ))}
            <button
              type="button"
              onClick={() => addQuick(QUICK[0])}
              disabled={!activeId}
              className="flex h-12 items-center justify-center rounded-xl bg-green-500 text-sm font-bold text-white shadow-sm transition-all hover:bg-green-600 active:scale-95 disabled:opacity-30"
            >
              +{QUICK[0] / 1000}k
            </button>

            {(['4', '5', '6'] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => pushDigit(d)}
                className="flex h-12 items-center justify-center rounded-xl border border-gray-200 bg-white text-base font-semibold text-gray-800 shadow-sm transition-all hover:bg-gray-50 active:scale-95"
              >
                {d}
              </button>
            ))}
            <button
              type="button"
              onClick={() => addQuick(QUICK[1])}
              disabled={!activeId}
              className="flex h-12 items-center justify-center rounded-xl bg-green-500 text-sm font-bold text-white shadow-sm transition-all hover:bg-green-600 active:scale-95 disabled:opacity-30"
            >
              +{QUICK[1] / 1000}k
            </button>

            {(['7', '8', '9'] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => pushDigit(d)}
                className="flex h-12 items-center justify-center rounded-xl border border-gray-200 bg-white text-base font-semibold text-gray-800 shadow-sm transition-all hover:bg-gray-50 active:scale-95"
              >
                {d}
              </button>
            ))}
            <button
              type="button"
              onClick={() => addQuick(QUICK[2])}
              disabled={!activeId}
              className="flex h-12 items-center justify-center rounded-xl bg-green-500 text-sm font-bold text-white shadow-sm transition-all hover:bg-green-600 active:scale-95 disabled:opacity-30"
            >
              +{QUICK[2] / 1000}k
            </button>

            {/* Row 4 */}
            <button
              type="button"
              onClick={pushClear}
              disabled={!activeId}
              className="flex h-12 items-center justify-center rounded-xl border border-amber-200 bg-amber-100 text-sm font-bold text-amber-700 shadow-sm transition-all hover:bg-amber-200 active:scale-95 disabled:opacity-30"
            >
              C
            </button>
            <button
              type="button"
              onClick={() => pushDigit('0')}
              className="flex h-12 items-center justify-center rounded-xl border border-gray-200 bg-white text-base font-semibold text-gray-800 shadow-sm transition-all hover:bg-gray-50 active:scale-95"
            >
              0
            </button>
            <button
              type="button"
              onClick={() => pushDigit('.')}
              className="flex h-12 items-center justify-center rounded-xl border border-orange-100 bg-orange-50 text-base font-semibold text-orange-500 shadow-sm transition-all hover:bg-orange-100 active:scale-95"
            >
              .
            </button>
            <button
              type="button"
              onClick={pushBackspace}
              disabled={!activeId}
              className="flex h-12 items-center justify-center rounded-xl border border-red-200 bg-red-100 text-red-600 shadow-sm transition-all hover:bg-red-200 active:scale-95 disabled:opacity-30"
            >
              ⌫
            </button>
          </div>
        </div>

        {/* ── Back + Validate ── */}
        <div className="grid grid-cols-2 border-t border-gray-300">
          <button
            type="button"
            onClick={() => setActiveView('sell')}
            className="flex items-center justify-center gap-2 bg-gray-200 py-4 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-300"
          >
            <PiArrowLeft className="h-4 w-4" /> Back
          </button>
          <button
            type="button"
            onClick={handleValidate}
            disabled={!canValidate || loading}
            className={cn(
              'flex items-center justify-center gap-2 py-4 text-sm font-bold text-white transition-all hover:opacity-90',
              canValidate ? 'opacity-100' : 'cursor-not-allowed opacity-40'
            )}
            style={{ backgroundColor: '#b20202' }}
          >
            {loading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              'Validate'
            )}
          </button>
        </div>
      </div>

      {/* ══ RIGHT PANEL ═══════════════════════════════════════════════════════ */}
      <div className="flex flex-1 flex-col bg-white">
        {/* Order total */}
        <div className="flex flex-1 flex-col items-center justify-center gap-1 px-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
            Order Total
          </p>
          <p
            className={cn(
              'text-6xl font-bold tabular-nums transition-colors',
              canValidate ? 'text-green-600' : 'text-gray-900'
            )}
          >
            {formatCurrency(effectiveTotal)}
          </p>
          {/* Discount breakdown — cart discount + all applied rewards */}
          {(discountAmount > 0 || rewardsDiscountTotal > 0) && (
            <div className="mt-2 w-full space-y-1">
              {discountAmount > 0 && (
                <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-1.5 text-xs text-gray-600">
                  <span>Cart discount</span>
                  <span className="font-bold text-gray-800">
                    −{formatCurrency(discountAmount)}
                  </span>
                </div>
              )}
              {autoDiscounts.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between rounded-xl px-3 py-1.5 text-xs"
                  style={{
                    backgroundColor: `${d.color ?? '#b20202'}12`,
                    color: d.color ?? '#b20202',
                  }}
                >
                  <span className="flex min-w-0 items-center gap-1.5 truncate font-semibold">
                    <PiStar className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{d.name}</span>
                    {(d as any).code && (
                      <span className="shrink-0 font-mono">
                        ({(d as any).code})
                      </span>
                    )}
                  </span>
                  <span className="ml-2 shrink-0 font-bold">
                    −{formatCurrency(d.discount)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {change > 0 && (
            <div className="mt-2 flex items-center gap-2 rounded-full bg-green-50 px-4 py-1.5">
              <span className="text-sm font-semibold text-green-600">
                Change: {formatCurrency(change)}
              </span>
            </div>
          )}

          {/* Loyalty earn/balance preview */}
          {hasCustomer &&
            loyaltyEnabled &&
            earnedPts > 0 &&
            settings.showLoyaltyBalanceAtCheckout && (
              <div className="mt-2 flex items-center gap-2 rounded-full bg-amber-50 px-4 py-1.5">
                <span className="text-xs font-semibold text-amber-700">
                  +{earnedPts} pts earned · new balance:{' '}
                  {newBalance.toLocaleString()} pts
                </span>
              </div>
            )}
        </div>

        {/* Payment lines + remaining */}
        <div className="shrink-0 space-y-1.5 border-t border-gray-100 px-8 pb-8 pt-5">
          {/* Applied rewards summary — managed via cart Rewards panel */}
          {appliedRewards.length > 0 && (
            <div className="mb-1 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-[10px] text-gray-500">
              <PiStar className="mr-1 inline h-3 w-3 text-[#b20202]" />
              {appliedRewards.length} reward
              {appliedRewards.length > 1 ? 's' : ''} applied · −
              {formatCurrency(rewardsDiscountTotal)}
            </div>
          )}

          {/* Remaining */}
          <div
            className={cn(
              'flex items-center justify-between rounded-xl px-5 py-3 text-sm font-bold transition-colors',
              remaining <= 0.01
                ? 'bg-green-50 text-green-700'
                : 'bg-amber-50 text-amber-700'
            )}
          >
            <span>{remaining <= 0.01 ? 'Fully paid' : 'Remaining'}</span>
            <span>{formatCurrency(Math.max(0, remaining))}</span>
          </div>

          {/* Applied lines */}
          {lines.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-sm text-gray-400">
              Select a payment method on the left to continue
            </div>
          ) : (
            lines.map((line) => (
              <button
                key={line.id}
                type="button"
                onClick={() => selectLine(line)}
                className={cn(
                  'flex w-full items-center justify-between rounded-xl border px-5 py-3.5 text-left text-sm transition-all',
                  activeId === line.id
                    ? 'border-[#b20202] bg-red-50 shadow-sm'
                    : 'border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100'
                )}
              >
                <span
                  className={cn(
                    'font-semibold',
                    activeId === line.id ? 'text-[#b20202]' : 'text-gray-800'
                  )}
                >
                  {line.label}
                </span>
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      'text-base font-bold tabular-nums',
                      activeId === line.id ? 'text-[#b20202]' : 'text-gray-700'
                    )}
                  >
                    {activeId === line.id
                      ? formatCurrency(parseFloat(inputStr) || 0)
                      : formatCurrency(line.amount)}
                  </span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeLine(line.id);
                    }}
                    onKeyDown={(e) =>
                      e.key === 'Enter' &&
                      (e.stopPropagation(), removeLine(line.id))
                    }
                    className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-red-400 transition-colors hover:bg-red-100 hover:text-red-600"
                  >
                    <PiX className="h-3.5 w-3.5" />
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
