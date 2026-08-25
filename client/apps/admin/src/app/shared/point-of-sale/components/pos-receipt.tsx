'use client';

import { useEffect, useRef } from 'react';
import { PiCheckCircle, PiPrinter } from 'react-icons/pi';
import {
  usePOSCart,
  usePOSAuth,
  usePOSSettings,
} from '@/app/shared/point-of-sale/store';
import { formatCurrency } from '@/app/shared/point-of-sale/utils';
import {
  POSOrderResponse,
  POSCartItem,
  POSNextOrderCouponConfig,
} from '@/app/shared/point-of-sale/types';
import type {
  PaymentLine,
  AppliedCode,
  AppliedDiscount,
} from './pos-payment-types';

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

export default function ReceiptScreen({
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
  cartSnapshot?: POSCartItem[];
  appliedCode?: AppliedCode;
  autoDiscounts?: AppliedDiscount[];
  nextOrderCode?: string | null;
  nocSettings?: Partial<POSNextOrderCouponConfig>;
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
              const hasThreshold = (order.thresholdDiscount ?? 0) > 0.005;
              const showBreakdown =
                hasItemDisc || hasOrderDisc || hasPricelist || hasThreshold;

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
                      {/* Pricelist cart spend-threshold discount */}
                      {hasThreshold && (
                        <Row
                          label={
                            order.pricelistName
                              ? `Spend Discount (${order.pricelistName})`
                              : 'Spend Discount'
                          }
                          value={`-${formatCurrency(order.thresholdDiscount!)}`}
                          vStyle={R.green}
                        />
                      )}
                    </>
                  )}
                </>
              );
            })()}

            {/* Tip and rounding sit between the discount breakdown and TOTAL:
                `order.total` already includes both, so showing them here is
                what makes the arithmetic on the slip add up for the customer. */}
            {(order.tipAmount ?? 0) > 0 && (
              <Row label="Tip" value={`+${formatCurrency(order.tipAmount ?? 0)}`} />
            )}
            {(order.roundingAmount ?? 0) !== 0 && (
              <Row
                label={`Rounding`}
                value={`${(order.roundingAmount ?? 0) > 0 ? '+' : '-'}${formatCurrency(
                  Math.abs(order.roundingAmount ?? 0)
                )}`}
                vStyle={R.muted}
              />
            )}

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

            {/* Tax line (estimated — prices assumed VAT-inclusive).
                Computed on the goods only: a tip is a gratuity, not a taxable
                supply, and the rounding delta is not consideration for goods
                either. Using order.total here would overstate the VAT by a
                fraction of whatever the customer chose to leave. */}
            {settings.showTaxOnReceipt && settings.taxRate > 0 && (
              <>
                <div style={R.divider} />
                <Row
                  label={`VAT ${settings.taxRate}%`}
                  value={formatCurrency(
                    ((order.total -
                      (order.tipAmount ?? 0) -
                      (order.roundingAmount ?? 0)) *
                      settings.taxRate) /
                      (100 + settings.taxRate)
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
