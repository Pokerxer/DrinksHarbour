'use client';

import { use, useEffect, useCallback, useState } from 'react';
import { useSession } from 'next-auth/react';
import { purchaseOrderService } from '@/services/purchaseOrder.service';
import type { PurchaseOrder } from '@/app/shared/purchases/types';

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
  return `${cur} ${(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'RFQ / DRAFT',
  confirmed: 'PURCHASE ORDER',
  received: 'RECEIVED',
  validated: 'VALIDATED',
  billed: 'BILLED',
  cancelled: 'CANCELLED',
  cancel: 'CANCELLED',
};
const STATUS_COLOR: Record<string, string> = {
  draft: '#6b7280',
  confirmed: '#2563eb',
  received: '#16a34a',
  validated: '#16a34a',
  billed: '#7c3aed',
  cancelled: '#6b7280',
  cancel: '#6b7280',
};

export default function POPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';

  const [po, setPO] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [triggered, setTriggered] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await purchaseOrderService.getPurchaseOrder(id, token);
      setPO(res.data);
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!loading && po && !triggered) {
      setTriggered(true);
      const t = setTimeout(() => window.print(), 500);
      return () => clearTimeout(t);
    }
  }, [loading, po, triggered]);

  if (loading || !po) {
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
        {loading ? 'Preparing purchase order…' : 'Order not found.'}
      </div>
    );
  }

  const totalCost = po.items.reduce(
    (s, it) =>
      s +
      (it.totalCost ??
        ((it as any).unitCost ?? it.unitPrice ?? 0) * it.quantity),
    0
  );
  const statusColor = STATUS_COLOR[po.status] ?? '#6b7280';
  const docType = ['confirmed', 'received', 'validated', 'billed'].includes(
    po.status
  )
    ? 'Purchase Order'
    : 'Request for Quotation';

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
            position: fixed !important;
            top: 0 !important; left: 0 !important; right: 0 !important;
            margin: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            max-width: none !important;
            width: 100% !important;
          }
        }
        @page { margin: 8mm; size: A4 portrait; }
      `}</style>

      {/* toolbar */}
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
          <span style={{ color: '#64748b' }}>{docType}</span>
          <span style={{ color: '#94a3b8' }}>·</span>
          <span style={{ color: '#e2e8f0', fontWeight: 600 }}>
            {po.poNumber}
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
            {STATUS_LABEL[po.status] ?? po.status}
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

      {/* invoice page */}
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
        {/* header band */}
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
              {docType}
            </div>
            <div
              style={{
                fontSize: 24,
                fontWeight: 900,
                color: '#fff',
                letterSpacing: '-0.5px',
              }}
            >
              {po.poNumber}
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
              {STATUS_LABEL[po.status] ?? po.status}
            </div>
          </div>
        </div>

        {/* body */}
        <div style={{ padding: '20px 32px 24px' }}>
          {/* from / to */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
              marginBottom: 16,
            }}
          >
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
                From (Buyer)
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
            </div>
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
                To (Vendor / Supplier)
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  color: '#111827',
                  lineHeight: 1.2,
                }}
              >
                {po.vendorName || '—'}
              </div>
              {po.vendorReference && (
                <div style={{ fontSize: 10, color: '#6b7280', marginTop: 3 }}>
                  Vendor Ref: {po.vendorReference}
                </div>
              )}
            </div>
          </div>

          {/* meta row */}
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
              {
                label: 'Order Date',
                value: fmtDate(po.confirmationDate ?? po.createdAt),
              },
              { label: 'Expected Arrival', value: fmtDate(po.expectedArrival) },
              { label: 'Currency', value: po.currency },
              {
                label: 'Agreement',
                value: po.agreementType
                  ? po.agreementType.replace(/_/g, ' ')
                  : 'Standard',
              },
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
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#1f2937',
                    textTransform: 'capitalize',
                  }}
                >
                  {value}
                </div>
              </div>
            ))}
          </div>

          {/* line items */}
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
                    { label: 'Product', align: 'left', w: '32%' },
                    { label: 'SKU', align: 'left', w: '14%' },
                    { label: 'Ordered', align: 'right', w: '9%' },
                    { label: 'Received', align: 'right', w: '9%' },
                    { label: 'Unit Price', align: 'right', w: '18%' },
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
                        textAlign: align as any,
                        width: w,
                      }}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {po.items.map((item, i) => {
                  const name =
                    (item as any).subProductName ?? item.productName ?? '';
                  const size = (item as any).sizeName;
                  const displayName =
                    size && !name.includes(size) ? `${name} – ${size}` : name;
                  const unitCost =
                    (item as any).unitCost ?? item.unitPrice ?? 0;
                  const lineCost = item.totalCost ?? unitCost * item.quantity;
                  const fullyReceived = item.receivedQty >= item.quantity;
                  return (
                    <tr
                      key={i}
                      style={{
                        borderBottom:
                          i < po.items.length - 1
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
                          {displayName || '—'}
                        </div>
                      </td>
                      <td
                        style={{
                          padding: '9px 12px',
                          fontSize: 9,
                          color: '#9ca3af',
                          fontFamily: 'monospace',
                        }}
                      >
                        {item.sku}
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
                          fontWeight: 600,
                          color: fullyReceived ? '#16a34a' : '#d97706',
                        }}
                      >
                        {item.receivedQty}
                        {!fullyReceived && item.receivedQty > 0 && (
                          <div
                            style={{
                              fontSize: 9,
                              color: '#d97706',
                              fontWeight: 400,
                            }}
                          >
                            {item.quantity - item.receivedQty} pending
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
                        {fmtAmt(unitCost, po.currency)}
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
                        {fmtAmt(lineCost, po.currency)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
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
                    Order Total
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
                    {fmtAmt(totalCost, po.currency)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* terms / notes */}
          {(po.termsConditions || po.notes) && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  po.termsConditions && po.notes ? '1fr 1fr' : '1fr',
                gap: 12,
                marginBottom: 20,
              }}
            >
              {po.termsConditions && (
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
                    Terms & Conditions
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: '#374151',
                      lineHeight: 1.6,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {po.termsConditions}
                  </div>
                </div>
              )}
              {po.notes && (
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
                    {po.notes}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* signature lines */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 40,
              marginTop: po.termsConditions || po.notes ? 4 : 24,
            }}
          >
            {['Authorised by (DrinksHarbour)', 'Acknowledged by (Vendor)'].map(
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

        {/* footer */}
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
            Generated{' '}
            {new Date().toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </div>
          <div
            style={{
              fontSize: 9,
              color: '#d1d5db',
              letterSpacing: '0.06em',
              fontWeight: 600,
            }}
          >
            DRINKSHARBOUR · {po.poNumber}
          </div>
          <div style={{ fontSize: 9, color: '#9ca3af' }}>
            accounts@drinksharbour.com
          </div>
        </div>
      </div>
    </>
  );
}
