'use client';

import { use, useEffect, useCallback, useState } from 'react';
import { useSession } from 'next-auth/react';
import { vendorBillService } from '@/services/vendorBill.service';
import type { VendorBill } from '@/services/vendorBill.service';

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
  draft: 'DRAFT',
  confirmed: 'CONFIRMED',
  paid: 'PAID',
  partial: 'PARTIAL',
  overdue: 'OVERDUE',
  cancelled: 'CANCELLED',
};
const STATUS_COLOR: Record<string, string> = {
  draft: '#6b7280',
  confirmed: '#2563eb',
  paid: '#16a34a',
  partial: '#d97706',
  overdue: '#b20202',
  cancelled: '#6b7280',
};
const STAMP_COLOR: Record<string, string> = {
  paid: '#16a34a',
  overdue: '#b20202',
  cancelled: '#6b7280',
};

export default function BillPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';

  const [bill, setBill] = useState<VendorBill | null>(null);
  const [loading, setLoading] = useState(true);
  const [triggered, setTriggered] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await vendorBillService.getVendorBill(id, token);
      setBill(res.data);
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!loading && bill && !triggered) {
      setTriggered(true);
      const t = setTimeout(() => window.print(), 500);
      return () => clearTimeout(t);
    }
  }, [loading, bill, triggered]);

  if (loading || !bill) {
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
        {loading ? 'Preparing invoice…' : 'Bill not found.'}
      </div>
    );
  }

  const balanceDue = bill.totalAmount - bill.paidAmount;
  const statusColor = STATUS_COLOR[bill.status] ?? '#6b7280';
  const stampColor = STAMP_COLOR[bill.status];

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
        .stamp { position: absolute; top: 50%; right: 60px; transform: translateY(-50%) rotate(-22deg); font-size: 52px; font-weight: 900; letter-spacing: 0.06em; opacity: 0.08; text-transform: uppercase; pointer-events: none; user-select: none; white-space: nowrap; }
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
          <span style={{ color: '#64748b' }}>Vendor Bill</span>
          <span style={{ color: '#94a3b8' }}>·</span>
          <span style={{ color: '#e2e8f0', fontWeight: 600 }}>
            {bill.billNumber}
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
            {STATUS_LABEL[bill.status] ?? bill.status}
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
        {stampColor && (
          <div className="stamp" style={{ color: stampColor }}>
            {STATUS_LABEL[bill.status]}
          </div>
        )}

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
              Vendor Bill
            </div>
            <div
              style={{
                fontSize: 24,
                fontWeight: 900,
                color: '#fff',
                letterSpacing: '-0.5px',
              }}
            >
              {bill.billNumber}
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
              {STATUS_LABEL[bill.status] ?? bill.status}
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
                Bill From
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  color: '#111827',
                  lineHeight: 1.2,
                }}
              >
                {bill.vendorName || '—'}
              </div>
            </div>
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
                {COMPANY.name}
              </div>
              <div style={{ fontSize: 10, color: '#6b7280', marginTop: 3 }}>
                {COMPANY.address}, {COMPANY.city}
              </div>
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
              { label: 'Bill Date', value: fmtDate(bill.billDate) },
              { label: 'Due Date', value: fmtDate(bill.dueDate) },
              { label: 'Currency', value: bill.currency },
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
                  style={{ fontSize: 12, fontWeight: 700, color: '#1f2937' }}
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
                    { label: 'Product', align: 'left', w: '40%' },
                    { label: 'Qty', align: 'right', w: '8%' },
                    { label: 'Unit Price', align: 'right', w: '18%' },
                    { label: 'Tax', align: 'right', w: '10%' },
                    { label: 'Amount', align: 'right', w: '18%' },
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
                {bill.items.map((item, i) => (
                  <tr
                    key={i}
                    style={{
                      borderBottom:
                        i < bill.items.length - 1
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
                        {item.subProductName ?? '—'}
                      </div>
                      {item.sizeName && (
                        <div
                          style={{
                            fontSize: 10,
                            color: '#6b7280',
                            marginTop: 1,
                          }}
                        >
                          {item.sizeName}
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
                      {fmtAmt(item.unitPrice, bill.currency)}
                    </td>
                    <td
                      style={{
                        padding: '9px 12px',
                        textAlign: 'right',
                        fontSize: 11,
                        color: '#9ca3af',
                      }}
                    >
                      {item.taxRate ?? 0}%
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
                      {fmtAmt(item.amount, bill.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* totals */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div
              style={{
                width: 300,
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                overflow: 'hidden',
              }}
            >
              <div style={{ background: '#f9fafb' }}>
                {[
                  {
                    label: 'Subtotal',
                    value: fmtAmt(bill.subtotal, bill.currency),
                  },
                  {
                    label: 'Tax',
                    value: fmtAmt(bill.taxAmount, bill.currency),
                  },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '7px 16px',
                      borderBottom: '1px solid #f3f4f6',
                      fontSize: 12,
                      color: '#6b7280',
                    }}
                  >
                    <span>{label}</span>
                    <span>{value}</span>
                  </div>
                ))}
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '10px 16px',
                  fontSize: 14,
                  fontWeight: 900,
                  color: '#111827',
                  background: '#fff',
                  borderBottom: '1px solid #e5e7eb',
                }}
              >
                <span>Total</span>
                <span>{fmtAmt(bill.totalAmount, bill.currency)}</span>
              </div>
              {bill.paidAmount > 0 && (
                <>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '7px 16px',
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#16a34a',
                      background: '#f0fdf4',
                      borderBottom: '1px solid #dcfce7',
                    }}
                  >
                    <span>Amount Paid</span>
                    <span>− {fmtAmt(bill.paidAmount, bill.currency)}</span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '10px 16px',
                      fontSize: 13,
                      fontWeight: 900,
                      color: balanceDue > 0.01 ? '#b20202' : '#16a34a',
                      background: balanceDue > 0.01 ? '#fff1f1' : '#f0fdf4',
                    }}
                  >
                    <span>Balance Due</span>
                    <span>
                      {balanceDue > 0.01
                        ? fmtAmt(balanceDue, bill.currency)
                        : 'PAID IN FULL ✓'}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* notes */}
          {bill.notes && (
            <div
              style={{
                marginTop: 16,
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
                  marginBottom: 4,
                }}
              >
                Notes
              </div>
              <div style={{ fontSize: 12, color: '#78350f', lineHeight: 1.6 }}>
                {bill.notes}
              </div>
            </div>
          )}
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
            DRINKSHARBOUR · {bill.billNumber}
          </div>
          <div style={{ fontSize: 9, color: '#9ca3af' }}>
            accounts@drinksharbour.com
          </div>
        </div>
      </div>
    </>
  );
}
