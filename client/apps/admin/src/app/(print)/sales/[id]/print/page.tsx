'use client';

import { use, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  salesOrderService,
  type SalesOrder,
  type SalesLineItem,
} from '@/services/salesOrder.service';

const COMPANY = {
  name: 'DrinksHarbour',
  address: '39 Gana St, Maitama',
  city: 'Abuja, Nigeria',
  email: 'accounts@drinksharbour.com',
};

function fmtDate(s?: string) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
function fmtAmt(n: number, cur = 'NGN') {
  return `${cur} ${(n ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const QUOTE_STATUS_LABEL: Record<string, string> = {
  draft: 'DRAFT',
  sent: 'SENT',
  accepted: 'ACCEPTED',
  rejected: 'REJECTED',
  expired: 'EXPIRED',
  converted: 'CONVERTED',
};
const ORDER_STATUS_LABEL: Record<string, string> = {
  draft: 'DRAFT',
  confirmed: 'CONFIRMED',
  partially_fulfilled: 'PARTIAL',
  fulfilled: 'FULFILLED',
  cancelled: 'CANCELLED',
};
const STATUS_COLOR: Record<string, string> = {
  draft: '#6b7280',
  sent: '#2563eb',
  accepted: '#16a34a',
  rejected: '#dc2626',
  expired: '#d97706',
  converted: '#7c3aed',
  confirmed: '#2563eb',
  partially_fulfilled: '#d97706',
  fulfilled: '#16a34a',
  cancelled: '#6b7280',
};

function isSection(item: SalesLineItem) {
  return item.lineType === 'section';
}
function isNote(item: SalesLineItem) {
  return item.lineType === 'note';
}

export default function SalesQuotationPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const isProforma = searchParams.get('type') === 'proforma';

  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';

  const [so, setSo] = useState<SalesOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [triggered, setTriggered] = useState(false);

  useEffect(() => {
    if (!token) return;
    salesOrderService
      .get(id, token)
      .then((r) => setSo(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id, token]);

  useEffect(() => {
    if (!loading && so && !triggered) {
      setTriggered(true);
      const t = setTimeout(() => window.print(), 500);
      return () => clearTimeout(t);
    }
  }, [loading, so, triggered]);

  if (loading || !so) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          color: '#9ca3af',
          fontSize: 14,
          fontFamily: 'system-ui,sans-serif',
        }}
      >
        {loading ? 'Preparing document…' : 'Document not found.'}
      </div>
    );
  }

  const isQuotation = so.docType === 'quotation';
  const rawStatus = isQuotation
    ? (so.quoteStatus ?? 'draft')
    : (so.orderStatus ?? 'draft');
  const statusLabel = isQuotation
    ? (QUOTE_STATUS_LABEL[rawStatus] ?? rawStatus.toUpperCase())
    : (ORDER_STATUS_LABEL[rawStatus] ?? rawStatus.toUpperCase());
  const statusColor = STATUS_COLOR[rawStatus] ?? '#6b7280';

  const docTitle = isProforma
    ? 'PRO-FORMA INVOICE'
    : isQuotation
      ? 'QUOTATION'
      : 'SALES ORDER';

  const productLines = so.items.filter((i) => !isSection(i) && !isNote(i));
  const untaxed = productLines.reduce((s, l) => s + (l.lineTotal ?? 0), 0);
  const taxAmt =
    so.taxTotal ?? productLines.reduce((s, l) => s + (l.taxAmount ?? 0), 0);
  const discAmt = so.discountTotal ?? 0;

  const ship = so.deliveryAddress;
  const hasShipTo =
    ship &&
    (ship.name || ship.street || ship.city) &&
    JSON.stringify(ship) !== JSON.stringify(so.invoiceAddress);

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #e8eaed; font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; }
        .no-print { display: flex; }
        @media print {
          .no-print { display: none !important; }
          * { visibility: hidden !important; }
          .page, .page * { visibility: visible !important; }
          .page {
            position: fixed !important; top: 0 !important; left: 0 !important;
            right: 0 !important; margin: 0 !important;
            border-radius: 0 !important; box-shadow: none !important;
            max-width: none !important; width: 100% !important;
          }
        }
        @page { margin: 8mm; size: A4 portrait; }
      `}</style>

      {/* Toolbar */}
      <div
        className="no-print"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          background: '#0f172a',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 24px',
          fontSize: 13,
          gap: 12,
          borderBottom: '1px solid #1e293b',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: '#b20202', fontWeight: 800, fontSize: 15 }}>
            DH
          </span>
          <span style={{ color: '#64748b' }}>{docTitle}</span>
          <span style={{ color: '#94a3b8' }}>·</span>
          <span style={{ color: '#e2e8f0', fontWeight: 600 }}>
            {so.soNumber}
          </span>
          <span
            style={{
              background: statusColor + '20',
              color: statusColor,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.08em',
              padding: '2px 8px',
              borderRadius: 99,
              textTransform: 'uppercase',
            }}
          >
            {statusLabel}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => window.print()}
            style={{
              background: '#b20202',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '6px 16px',
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            Print / Save as PDF
          </button>
          <button
            onClick={() => window.close()}
            style={{
              background: '#1e293b',
              color: '#94a3b8',
              border: '1px solid #334155',
              borderRadius: 6,
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            ✕ Close
          </button>
        </div>
      </div>

      {/* Document page */}
      <div
        className="page"
        style={{
          maxWidth: 860,
          margin: '44px auto 32px',
          background: '#fff',
          borderRadius: 12,
          boxShadow:
            '0 4px 6px -1px rgba(0,0,0,0.07), 0 20px 60px rgba(0,0,0,0.14)',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Red header band */}
        <div
          style={{
            background: 'linear-gradient(135deg, #b20202 0%, #8b0000 100%)',
            padding: '20px 36px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
          }}
        >
          <div>
            <div
              style={{
                fontSize: 24,
                fontWeight: 900,
                color: '#fff',
                letterSpacing: '-0.5px',
                lineHeight: 1,
              }}
            >
              DrinksHarbour
            </div>
            <div
              style={{
                fontSize: 10,
                color: 'rgba(255,255,255,0.65)',
                marginTop: 5,
                lineHeight: 1.6,
              }}
            >
              {COMPANY.address} · {COMPANY.city}
              <br />
              {COMPANY.email}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '0.18em',
                color: 'rgba(255,255,255,0.55)',
                textTransform: 'uppercase',
                marginBottom: 3,
              }}
            >
              {docTitle}
            </div>
            <div
              style={{
                fontSize: 24,
                fontWeight: 900,
                color: '#fff',
                letterSpacing: '-0.5px',
              }}
            >
              {so.soNumber}
            </div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                marginTop: 6,
                background: 'rgba(255,255,255,0.15)',
                color: '#fff',
                padding: '3px 12px',
                borderRadius: 99,
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                border: '1px solid rgba(255,255,255,0.25)',
              }}
            >
              {statusLabel}
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 32px 24px' }}>
          {/* Address cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: hasShipTo ? '1fr 1fr 1fr' : '1fr 1fr',
              gap: 12,
              marginBottom: 16,
            }}
          >
            {/* Bill To */}
            <div
              style={{
                border: '1px solid #fecaca',
                borderTop: '3px solid #b20202',
                borderRadius: 8,
                padding: '10px 14px',
                background: '#fff8f8',
              }}
            >
              <div
                style={{
                  fontSize: 8,
                  fontWeight: 800,
                  letterSpacing: '0.16em',
                  color: '#b20202',
                  textTransform: 'uppercase',
                  marginBottom: 6,
                }}
              >
                Bill To
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  color: '#111827',
                  lineHeight: 1.2,
                }}
              >
                {so.customerSnapshot?.name ?? 'Walk-in Customer'}
              </div>
              {so.customerSnapshot?.phone && (
                <div style={{ fontSize: 10, color: '#6b7280', marginTop: 3 }}>
                  {so.customerSnapshot.phone}
                </div>
              )}
              {so.customerSnapshot?.email && (
                <div style={{ fontSize: 10, color: '#6b7280' }}>
                  {so.customerSnapshot.email}
                </div>
              )}
              {so.invoiceAddress?.street && (
                <div style={{ fontSize: 10, color: '#6b7280', marginTop: 3 }}>
                  {so.invoiceAddress.street}
                </div>
              )}
              {(so.invoiceAddress?.city || so.invoiceAddress?.state) && (
                <div style={{ fontSize: 10, color: '#6b7280' }}>
                  {[
                    so.invoiceAddress.city,
                    so.invoiceAddress.state,
                    so.invoiceAddress.country,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                </div>
              )}
            </div>

            {/* Deliver To (conditional) */}
            {hasShipTo && (
              <div
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  padding: '10px 14px',
                  background: '#fafafa',
                }}
              >
                <div
                  style={{
                    fontSize: 8,
                    fontWeight: 800,
                    letterSpacing: '0.16em',
                    color: '#9ca3af',
                    textTransform: 'uppercase',
                    marginBottom: 6,
                  }}
                >
                  Deliver To
                </div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 800,
                    color: '#111827',
                    lineHeight: 1.2,
                  }}
                >
                  {ship?.name ?? so.customerSnapshot?.name ?? '—'}
                </div>
                {ship?.phone && (
                  <div style={{ fontSize: 10, color: '#6b7280', marginTop: 3 }}>
                    {ship.phone}
                  </div>
                )}
                {ship?.street && (
                  <div style={{ fontSize: 10, color: '#6b7280', marginTop: 3 }}>
                    {ship.street}
                  </div>
                )}
                {(ship?.city || ship?.state) && (
                  <div style={{ fontSize: 10, color: '#6b7280' }}>
                    {[ship?.city, ship?.state, ship?.country]
                      .filter(Boolean)
                      .join(', ')}
                  </div>
                )}
              </div>
            )}

            {/* Issued by */}
            <div
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                padding: '10px 14px',
                background: '#fafafa',
              }}
            >
              <div
                style={{
                  fontSize: 8,
                  fontWeight: 800,
                  letterSpacing: '0.16em',
                  color: '#9ca3af',
                  textTransform: 'uppercase',
                  marginBottom: 6,
                }}
              >
                Issued By
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  color: '#111827',
                  lineHeight: 1.2,
                }}
              >
                {COMPANY.name}
              </div>
              <div style={{ fontSize: 10, color: '#6b7280', marginTop: 3 }}>
                {COMPANY.address}, {COMPANY.city}
              </div>
              <div style={{ fontSize: 10, color: '#6b7280' }}>
                {COMPANY.email}
              </div>
            </div>
          </div>

          {/* Meta band */}
          <div
            style={{
              display: 'flex',
              gap: 0,
              marginBottom: 16,
              background: '#f9fafb',
              borderRadius: 8,
              border: '1px solid #f3f4f6',
              overflow: 'hidden',
            }}
          >
            {[
              { label: 'Issue Date', value: fmtDate(so.createdAt) },
              { label: 'Valid Until', value: fmtDate(so.validUntil) },
              {
                label: 'Payment Terms',
                value: (() => {
                  const map: Record<string, string> = {
                    immediate: 'Immediate',
                    net_7: 'Net 7 days',
                    net_15: 'Net 15 days',
                    net_30: 'Net 30 days',
                    net_45: 'Net 45 days',
                    net_60: 'Net 60 days',
                    end_of_month: 'End of Month',
                  };
                  return map[so.paymentTerms ?? ''] ?? 'Immediate';
                })(),
              },
              { label: 'Currency', value: so.currency ?? 'NGN' },
            ].map(({ label, value }, i, arr) => (
              <div
                key={label}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRight:
                    i < arr.length - 1 ? '1px solid #e5e7eb' : 'none',
                }}
              >
                <div
                  style={{
                    fontSize: 8,
                    fontWeight: 700,
                    color: '#9ca3af',
                    textTransform: 'uppercase',
                    letterSpacing: '0.12em',
                    marginBottom: 3,
                  }}
                >
                  {label}
                </div>
                <div
                  style={{ fontSize: 11, fontWeight: 700, color: '#1f2937' }}
                >
                  {value}
                </div>
              </div>
            ))}
          </div>

          {/* Line items */}
          <div
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              overflow: 'hidden',
              marginBottom: 16,
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#b20202' }}>
                  {[
                    { label: 'Item', align: 'left', w: '35%' },
                    { label: 'Qty', align: 'right', w: '8%' },
                    { label: 'Unit Price', align: 'right', w: '17%' },
                    { label: 'Discount', align: 'right', w: '13%' },
                    { label: 'Tax', align: 'right', w: '9%' },
                    { label: 'Total', align: 'right', w: '18%' },
                  ].map(({ label, align, w }) => (
                    <th
                      key={label}
                      style={{
                        padding: '8px 12px',
                        fontSize: 8,
                        fontWeight: 700,
                        color: 'rgba(255,255,255,0.9)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.12em',
                        textAlign: align as 'left' | 'right',
                        width: w,
                      }}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {so.items.map((item, i) => {
                  if (isSection(item)) {
                    return (
                      <tr key={item._id} style={{ background: '#f3f4f6' }}>
                        <td
                          colSpan={6}
                          style={{
                            padding: '6px 12px',
                            fontSize: 10,
                            fontWeight: 800,
                            color: '#374151',
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em',
                            borderBottom: '1px solid #e5e7eb',
                          }}
                        >
                          {item.name}
                        </td>
                      </tr>
                    );
                  }
                  if (isNote(item)) {
                    return (
                      <tr key={item._id}>
                        <td
                          colSpan={6}
                          style={{
                            padding: '5px 12px 5px 20px',
                            fontSize: 10,
                            color: '#6b7280',
                            fontStyle: 'italic',
                            borderBottom:
                              i < so.items.length - 1
                                ? '1px solid #f3f4f6'
                                : 'none',
                          }}
                        >
                          {item.name}
                        </td>
                      </tr>
                    );
                  }
                  return (
                    <tr
                      key={item._id}
                      style={{
                        borderBottom:
                          i < so.items.length - 1
                            ? '1px solid #f3f4f6'
                            : 'none',
                        background: i % 2 === 1 ? '#fafafa' : '#fff',
                      }}
                    >
                      <td style={{ padding: '9px 12px' }}>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: '#111827',
                          }}
                        >
                          {item.name ?? '—'}
                        </div>
                        {item.description && (
                          <div
                            style={{
                              fontSize: 9,
                              color: '#9ca3af',
                              marginTop: 2,
                            }}
                          >
                            {item.description}
                          </div>
                        )}
                        {item.sku && (
                          <div
                            style={{
                              fontSize: 9,
                              color: '#d1d5db',
                              fontFamily: 'monospace',
                              marginTop: 1,
                            }}
                          >
                            {item.sku}
                          </div>
                        )}
                      </td>
                      <td
                        style={{
                          padding: '9px 12px',
                          textAlign: 'right',
                          fontSize: 12,
                          color: '#374151',
                        }}
                      >
                        {item.quantity}
                      </td>
                      <td
                        style={{
                          padding: '9px 12px',
                          textAlign: 'right',
                          fontSize: 12,
                          color: '#374151',
                        }}
                      >
                        {fmtAmt(item.unitPrice, so.currency)}
                      </td>
                      <td
                        style={{
                          padding: '9px 12px',
                          textAlign: 'right',
                          fontSize: 12,
                          color: '#374151',
                        }}
                      >
                        {item.discount > 0
                          ? item.discountType === 'percentage'
                            ? `${item.discount}%`
                            : fmtAmt(item.discount, so.currency)
                          : '—'}
                      </td>
                      <td
                        style={{
                          padding: '9px 12px',
                          textAlign: 'right',
                          fontSize: 12,
                          color: '#374151',
                        }}
                      >
                        {item.taxRate ? `${item.taxRate}%` : '—'}
                      </td>
                      <td
                        style={{
                          padding: '9px 12px',
                          textAlign: 'right',
                          fontSize: 12,
                          fontWeight: 700,
                          color: '#111827',
                        }}
                      >
                        {fmtAmt(item.lineTotal, so.currency)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                {discAmt > 0 && (
                  <tr
                    style={{
                      borderTop: '1px solid #f3f4f6',
                      background: '#fff',
                    }}
                  >
                    <td
                      colSpan={5}
                      style={{
                        padding: '6px 12px',
                        textAlign: 'right',
                        fontSize: 9,
                        fontWeight: 700,
                        color: '#9ca3af',
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                      }}
                    >
                      Subtotal
                    </td>
                    <td
                      style={{
                        padding: '6px 12px',
                        textAlign: 'right',
                        fontSize: 12,
                        color: '#374151',
                      }}
                    >
                      {fmtAmt(untaxed, so.currency)}
                    </td>
                  </tr>
                )}
                {discAmt > 0 && (
                  <tr style={{ background: '#fff' }}>
                    <td
                      colSpan={5}
                      style={{
                        padding: '4px 12px',
                        textAlign: 'right',
                        fontSize: 9,
                        fontWeight: 700,
                        color: '#9ca3af',
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                      }}
                    >
                      Discount
                    </td>
                    <td
                      style={{
                        padding: '4px 12px',
                        textAlign: 'right',
                        fontSize: 12,
                        color: '#dc2626',
                      }}
                    >
                      −{fmtAmt(discAmt, so.currency)}
                    </td>
                  </tr>
                )}
                {taxAmt > 0 && (
                  <tr style={{ background: '#fff' }}>
                    <td
                      colSpan={5}
                      style={{
                        padding: '4px 12px',
                        textAlign: 'right',
                        fontSize: 9,
                        fontWeight: 700,
                        color: '#9ca3af',
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                      }}
                    >
                      Tax
                    </td>
                    <td
                      style={{
                        padding: '4px 12px',
                        textAlign: 'right',
                        fontSize: 12,
                        color: '#374151',
                      }}
                    >
                      {fmtAmt(taxAmt, so.currency)}
                    </td>
                  </tr>
                )}
                <tr
                  style={{
                    borderTop: '2px solid #e5e7eb',
                    background: '#f9fafb',
                  }}
                >
                  <td
                    colSpan={5}
                    style={{
                      padding: '10px 12px',
                      textAlign: 'right',
                      fontSize: 10,
                      fontWeight: 700,
                      color: '#6b7280',
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                    }}
                  >
                    Total
                  </td>
                  <td
                    style={{
                      padding: '10px 12px',
                      textAlign: 'right',
                      fontSize: 15,
                      fontWeight: 900,
                      color: '#111827',
                    }}
                  >
                    {fmtAmt(so.total, so.currency)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Notes / Terms */}
          {(so.notes || so.terms) && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: so.notes && so.terms ? '1fr 1fr' : '1fr',
                gap: 12,
                marginBottom: 20,
              }}
            >
              {so.terms && (
                <div
                  style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    padding: '10px 14px',
                    background: '#f9fafb',
                  }}
                >
                  <div
                    style={{
                      fontSize: 8,
                      fontWeight: 800,
                      color: '#9ca3af',
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      marginBottom: 5,
                    }}
                  >
                    Terms &amp; Conditions
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: '#374151',
                      lineHeight: 1.6,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {so.terms}
                  </div>
                </div>
              )}
              {so.notes && (
                <div
                  style={{
                    padding: '10px 14px',
                    background: '#fffbeb',
                    borderRadius: 8,
                    borderLeft: '3px solid #f59e0b',
                  }}
                >
                  <div
                    style={{
                      fontSize: 8,
                      fontWeight: 800,
                      color: '#92400e',
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      marginBottom: 5,
                    }}
                  >
                    Notes
                  </div>
                  <div
                    style={{ fontSize: 11, color: '#78350f', lineHeight: 1.6 }}
                  >
                    {so.notes}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Pro-forma disclaimer */}
          {isProforma && (
            <div
              style={{
                marginBottom: 16,
                padding: '8px 14px',
                background: '#eff6ff',
                borderRadius: 8,
                border: '1px solid #bfdbfe',
              }}
            >
              <div style={{ fontSize: 10, color: '#1e40af', lineHeight: 1.5 }}>
                <strong>Pro-Forma Invoice:</strong> This document is issued for
                advance payment or customs purposes only and does not constitute
                a tax invoice. A formal VAT invoice will be issued upon
                confirmation and delivery.
              </div>
            </div>
          )}

          {/* Signature lines */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 40,
              marginTop: 8,
            }}
          >
            {['Authorised by (DrinksHarbour)', 'Accepted by (Customer)'].map(
              (label) => (
                <div key={label}>
                  <div
                    style={{ borderTop: '1.5px solid #e5e7eb', paddingTop: 10 }}
                  >
                    <div
                      style={{
                        fontSize: 8,
                        fontWeight: 700,
                        color: '#9ca3af',
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                      }}
                    >
                      {label}
                    </div>
                    <div
                      style={{ marginTop: 24, fontSize: 9, color: '#e5e7eb' }}
                    >
                      Name / Date / Stamp
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        </div>

        {/* Footer band */}
        <div
          style={{
            background: '#f9fafb',
            borderTop: '1px solid #e5e7eb',
            padding: '10px 36px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ fontSize: 9, color: '#9ca3af' }}>
            Generated {fmtDate(new Date().toISOString())}
          </div>
          <div
            style={{
              fontSize: 9,
              color: '#d1d5db',
              letterSpacing: '0.06em',
              fontWeight: 600,
            }}
          >
            DRINKSHARBOUR · {so.soNumber}
          </div>
          <div style={{ fontSize: 9, color: '#9ca3af' }}>{COMPANY.email}</div>
        </div>
      </div>
    </>
  );
}
