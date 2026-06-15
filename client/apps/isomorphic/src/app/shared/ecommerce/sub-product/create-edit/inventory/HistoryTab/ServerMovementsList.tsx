// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useTenant } from '@/context/TenantContext';
import {
  PiPlus,
  PiMinus,
  PiArrowsLeftRight,
  PiSliders,
  PiTrash,
  PiArrowClockwise,
  PiPackage,
  PiSpinner,
  PiStorefront,
  PiShoppingCart,
  PiWrench,
  PiReceipt,
  PiArrowCounterClockwise,
  PiX,
  PiMagnifyingGlass,
  PiUser,
  PiCurrencyNgn,
  PiTag,
  PiCalendar,
  PiArrowSquareOut,
  PiTruck,
  PiCheckCircle,
  PiWarehouse,
  PiPhone,
  PiMapPin,
  PiClipboardText,
  PiListBullets,
  PiHourglass,
  PiPrinter,
} from 'react-icons/pi';
import { inventoryService } from '@/services/inventory.service';
import type { InventoryMovement } from '@/services/inventory.service';
import { posApi } from '@/app/shared/point-of-sale/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

interface ServerMovementsListProps {
  movements: InventoryMovement[];
  isLoading: boolean;
  onRefresh: () => void;
  onCancel: (id: string) => void;
}

const ITEMS_PER_PAGE = 15;
type CategoryFilter =
  | 'all'
  | 'in'
  | 'out'
  | 'transfer'
  | 'adjustment'
  | 'sale'
  | 'return';

// ── Helpers ──────────────────────────────────────────────────────────────────

function getCategory(m: InventoryMovement): CategoryFilter {
  if (m.type === 'sold' || m.type === 'shipped') return 'sale';
  if (m.type === 'return' || m.type === 'return_in') return 'return';
  if (m.type === 'adjustment_in' || m.type === 'adjustment_out')
    return 'adjustment';
  if (m.category === 'in') return 'in';
  if (m.category === 'out') return 'out';
  if (m.category === 'transfer') return 'transfer';
  return 'in';
}

function getCatStyle(cat: CategoryFilter) {
  switch (cat) {
    case 'in':
      return {
        bg: 'bg-green-100',
        text: 'text-green-700',
        icon: <PiPlus className="h-3.5 w-3.5" />,
      };
    case 'out':
      return {
        bg: 'bg-red-100',
        text: 'text-red-700',
        icon: <PiMinus className="h-3.5 w-3.5" />,
      };
    case 'sale':
      return {
        bg: 'bg-red-100',
        text: 'text-red-700',
        icon: <PiShoppingCart className="h-3.5 w-3.5" />,
      };
    case 'return':
      return {
        bg: 'bg-amber-100',
        text: 'text-amber-700',
        icon: <PiArrowCounterClockwise className="h-3.5 w-3.5" />,
      };
    case 'transfer':
      return {
        bg: 'bg-blue-100',
        text: 'text-blue-700',
        icon: <PiArrowsLeftRight className="h-3.5 w-3.5" />,
      };
    case 'adjustment':
      return {
        bg: 'bg-purple-100',
        text: 'text-purple-700',
        icon: <PiSliders className="h-3.5 w-3.5" />,
      };
    default:
      return {
        bg: 'bg-gray-100',
        text: 'text-gray-600',
        icon: <PiPlus className="h-3.5 w-3.5" />,
      };
  }
}

function getQtySign(cat: CategoryFilter) {
  if (cat === 'in' || cat === 'return') return '+';
  if (cat === 'out' || cat === 'sale') return '−';
  return '~';
}

function getQtyColor(cat: CategoryFilter) {
  if (cat === 'in' || cat === 'return') return 'text-green-600';
  if (cat === 'out' || cat === 'sale') return 'text-red-600';
  return 'text-blue-600';
}

function getSourceBadge(m: InventoryMovement) {
  const isPOS =
    m.source === 'order' || (m.notes && m.notes.toLowerCase().includes('pos'));
  const isOnline =
    !isPOS && m.relatedOrder && typeof m.relatedOrder === 'object';
  if (isPOS)
    return {
      label: 'POS',
      cls: 'bg-[#b20202]/10 text-[#b20202]',
      icon: <PiStorefront className="h-2.5 w-2.5" />,
    };
  if (isOnline)
    return {
      label: 'Online',
      cls: 'bg-blue-50 text-blue-700',
      icon: <PiShoppingCart className="h-2.5 w-2.5" />,
    };
  if (m.source === 'api')
    return {
      label: 'API',
      cls: 'bg-gray-100 text-gray-600',
      icon: <PiWrench className="h-2.5 w-2.5" />,
    };
  return {
    label: 'Manual',
    cls: 'bg-gray-100 text-gray-500',
    icon: <PiWrench className="h-2.5 w-2.5" />,
  };
}

function whLabel(w: any): string | null {
  if (!w) return null;
  if (typeof w === 'object') return w.name || w.code || null;
  return null; // bare id (unpopulated) → nothing to show
}

type WarehouseInfo =
  | { kind: 'single'; label: string }
  | { kind: 'route'; from: string; to: string }
  | null;

function getWarehouseInfo(m: InventoryMovement): WarehouseInfo {
  const from = whLabel((m as any).sourceWarehouse);
  const to = whLabel((m as any).destinationWarehouse);
  if (from && to) return { kind: 'route', from, to };
  const single = whLabel(m.warehouse) || from || to;
  return single ? { kind: 'single', label: single } : null;
}

function getOrderRef(m: InventoryMovement): string | null {
  if (m.relatedOrder && typeof m.relatedOrder === 'object')
    return m.relatedOrder.receiptNumber || m.relatedOrder.orderNumber || null;
  return m.reference || null;
}

function getOrderId(m: InventoryMovement): string | null {
  if (m.relatedOrder && typeof m.relatedOrder === 'object')
    return m.relatedOrder._id;
  if (m.relatedOrder && typeof m.relatedOrder === 'string')
    return m.relatedOrder;
  return null;
}

function formatDate(d: string) {
  try {
    const dt = new Date(d);
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    return `${dt.getDate().toString().padStart(2, '0')} ${months[dt.getMonth()]} ${dt.getFullYear()} · ${dt.getHours().toString().padStart(2, '0')}:${dt.getMinutes().toString().padStart(2, '0')}`;
  } catch {
    return d;
  }
}

function formatType(type: string) {
  return (
    type?.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || ''
  );
}

function fmtMoney(n: number, sym = '₦') {
  return `${sym}${(n ?? 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── Print helper ─────────────────────────────────────────────────────────────

function fmtDateShort(d: string | undefined) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return d;
  }
}

function generatePrintHTML(
  order: any,
  orderType: 'pos' | 'online' | 'purchase' | 'return' | 'po_return',
  tenant: { name?: string; logo?: { url: string } | null } | null,
  refund?: any,
  movement?: InventoryMovement
): string {
  const h = (s: any) =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  const ng = (v: number) =>
    `&#8358;${(v ?? 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const storeName = (tenant?.name || 'DRINKS HARBOUR').toUpperCase();
  const logoSrc =
    (typeof tenant?.logo === 'string'
      ? tenant?.logo
      : (tenant?.logo as any)?.url) || '/logo.png';

  const commonHead = `<!DOCTYPE html><html lang="en"><head>
    <meta charset="UTF-8">
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      html,body{height:100%;background:#fff}
      body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#111}
      @media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}@page{size:A4;margin:14mm 16mm}}
      table{width:100%;border-collapse:collapse}
    </style>
  </head><body>`;

  const pageOpen = `<div style="max-width:820px;margin:0 auto;padding:44px 52px 120px">`;
  const accentBar = `<div style="height:5px;background:linear-gradient(90deg,#b20202,#7f1d1d);border-radius:3px;margin-bottom:32px"></div>`;
  const logoRow = `<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px">
    <img src="${logoSrc}" alt="${h(storeName)}" style="height:54px;object-fit:contain;object-position:left center">
    <div style="text-align:right;font-size:12px;line-height:1.9;color:#4b5563;max-width:300px">
      <div style="font-size:14px;font-weight:800;color:#111;letter-spacing:0.03em;margin-bottom:2px">${h(storeName)}</div>
      <div>Nigeria</div>
      <div style="margin-top:2px">ADDRESS - 39 GANA STREET MAITAMA, ABUJA</div>
    </div>
  </div>`;
  const separator = `<div style="border-top:1px solid #e5e7eb;margin-bottom:24px"></div>`;
  const footer = `</div>
    <div style="position:fixed;bottom:0;left:0;right:0">
      <div style="max-width:820px;margin:0 auto;padding:14px 52px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center;font-size:11px;color:#9ca3af;background:#fff">
        <span>No Return Of Drinks</span><span>Page 1 / 1</span>
      </div>
    </div>
  </body></html>`;

  // ── PO Vendor Return ─────────────────────────────────────────────────────────
  if (orderType === 'po_return' && movement) {
    const po = order;
    const returnDate = (movement as any).performedAt || movement.createdAt;
    const poNumber = h(po.poNumber || movement.reference || '—');
    const vendorName = h(po.vendor?.name || po.vendorName || '—');
    const vendorEmail = po.vendor?.email ? h(po.vendor.email) : null;
    const isExchange =
      (movement.notes || '').toLowerCase().includes('exchange') ||
      (movement.reason || '').toLowerCase().includes('exchange');
    const performer = movement.performedBy
      ? h(
          movement.performedBy.posName ||
            `${movement.performedBy.firstName || ''} ${movement.performedBy.lastName || ''}`.trim() ||
            movement.performedBy.email ||
            '—'
        )
      : '—';
    const movSizeId =
      typeof movement.size === 'object'
        ? movement.size?._id
        : (movement.size as any);
    const movSizeName =
      typeof movement.size === 'object'
        ? movement.size?.displayName || movement.size?.size
        : movement.sizeName;
    const poLine =
      (po.items || []).find((it: any) => {
        const itSize =
          it.sizeId?._id?.toString() || it.sizeId?.toString() || null;
        if (movSizeId && itSize) return itSize === movSizeId;
        if (movSizeName && it.sizeName) return it.sizeName === movSizeName;
        return false;
      }) || (po.items?.length === 1 ? po.items[0] : null);
    const productName = h(
      poLine?.subProductId?.name || poLine?.subProductName || '—'
    );
    const sizeLabel = h(movSizeName || poLine?.sizeName || '');
    const qty = movement.quantity;
    const unitCost = movement.unitCost || poLine?.unitCost || 0;
    const totalValue = qty * unitCost;
    const reason = h(movement.reason || movement.notes || '');
    const dateStr = new Date(returnDate).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const timeStr = new Date(returnDate).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const statusColor = isExchange ? '#1d4ed8' : '#d97706';

    return `${commonHead}<title>${isExchange ? 'Exchange' : 'Vendor Return'} · ${poNumber}</title>
      ${pageOpen}${accentBar}${logoRow}${separator}
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
        <div>
          <div style="font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#9ca3af;margin-bottom:6px">${isExchange ? 'Return for Exchange' : 'Vendor Return'}</div>
          <div style="font-size:28px;font-weight:900;color:#b20202;letter-spacing:-0.5px;line-height:1">${poNumber}</div>
          <div style="font-size:11px;color:#9ca3af;margin-top:4px">Purchase Order</div>
        </div>
        <div style="padding-top:4px">
          <span style="display:inline-block;padding:4px 12px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;background:${statusColor}18;color:${statusColor};border:1px solid ${statusColor}40">${isExchange ? 'EXCHANGE' : 'RETURNED'}</span>
        </div>
      </div>
      <div style="display:flex;gap:0;margin:22px 0;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
        <div style="flex:1;padding:12px 16px;border-right:1px solid #e5e7eb">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#b20202;margin-bottom:4px">Return Date</div>
          <div style="font-size:13px;font-weight:600;color:#111">${dateStr}</div>
          <div style="font-size:10px;color:#6b7280;margin-top:1px">${timeStr}</div>
        </div>
        <div style="flex:1;padding:12px 16px;border-right:1px solid #e5e7eb">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#b20202;margin-bottom:4px">PO Number</div>
          <div style="font-size:13px;font-weight:600;color:#111">${poNumber}</div>
          ${po.status ? `<div style="font-size:10px;color:#6b7280;margin-top:1px;text-transform:capitalize">${h(po.status)}</div>` : ''}
        </div>
        <div style="flex:1;padding:12px 16px;border-right:1px solid #e5e7eb">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#b20202;margin-bottom:4px">Vendor</div>
          <div style="font-size:13px;font-weight:600;color:#111">${vendorName}</div>
          ${vendorEmail ? `<div style="font-size:10px;color:#6b7280;margin-top:1px">${vendorEmail}</div>` : ''}
        </div>
        <div style="flex:1;padding:12px 16px">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#b20202;margin-bottom:4px">Processed By</div>
          <div style="font-size:13px;font-weight:600;color:#111">${performer}</div>
        </div>
      </div>
      <table style="margin-bottom:0;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
        <thead><tr style="background:#f9fafb">
          <th style="padding:10px 16px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;border-bottom:1px solid #e5e7eb">Description</th>
          <th style="padding:10px 16px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;border-bottom:1px solid #e5e7eb;white-space:nowrap">Quantity</th>
          <th style="padding:10px 16px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;border-bottom:1px solid #e5e7eb;white-space:nowrap">Unit Cost</th>
          <th style="padding:10px 16px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;border-bottom:1px solid #e5e7eb">Total Value</th>
        </tr></thead>
        <tbody>
          <tr>
            <td style="padding:10px 16px;font-size:13px;color:#111">
              <span style="font-weight:500">${productName}</span>
              ${sizeLabel ? `<span style="color:#888;font-size:11px"> · ${sizeLabel}</span>` : ''}
            </td>
            <td style="padding:10px 16px;text-align:right;font-size:13px;color:#374151;white-space:nowrap">${qty}.00 Units</td>
            <td style="padding:10px 16px;text-align:right;font-size:13px;color:#374151;font-variant-numeric:tabular-nums">${ng(unitCost)}</td>
            <td style="padding:10px 16px;text-align:right;font-size:13px;font-weight:700;color:#b20202;font-variant-numeric:tabular-nums">&minus;${ng(totalValue)}</td>
          </tr>
        </tbody>
      </table>
      <div style="display:flex;justify-content:flex-end;margin-top:0;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;overflow:hidden">
        <div style="width:340px">
          ${unitCost > 0 ? `<div style="display:flex;justify-content:space-between;padding:10px 16px;border-bottom:1px solid #f3f4f6;font-size:13px"><span style="color:#6b7280">${qty} &times; ${ng(unitCost)}</span><span style="font-weight:600;color:#111">${ng(totalValue)}</span></div>` : ''}
          <div style="display:flex;justify-content:space-between;padding:13px 16px;background:#b20202">
            <span style="font-size:14px;font-weight:800;color:#fff;letter-spacing:0.02em">${isExchange ? 'Value Exchanged' : 'Total Value Returned'}</span>
            <span style="font-size:14px;font-weight:800;color:#fff">&minus;${ng(totalValue)}</span>
          </div>
        </div>
      </div>
      ${reason ? `<div style="margin-top:20px;font-size:12px;color:#6b7280"><span style="font-weight:600;color:#374151">${isExchange ? 'Exchange notes' : 'Return reason'}: </span>${reason}</div>` : ''}
      <div style="margin-top:28px;font-size:12px;color:#6b7280">
        <span style="font-weight:600;color:#374151">Terms &amp; Conditions: </span>
        <span style="color:#b20202">https://www.drinksharbour.com/terms</span>
      </div>
    ${footer}`;
  }

  // ── Return Receipt / Credit Note ────────────────────────────────────────────
  if (orderType === 'return') {
    const ret = refund || {};
    const returnNum = h(ret.receiptNumber || '—');
    const returnDate = ret.refundedAt
      ? new Date(ret.refundedAt).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        } as any)
      : '—';
    const payMethod = h(
      (ret.paymentMethod || '')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c: string) => c.toUpperCase()) || '—'
    );
    const refundLines = ret.items || [];
    const totalRef = ret.totalRefunded || 0;
    const reason = h(ret.reason || '');
    const customer = order.customer;
    const hasCustomer = customer?.firstName && customer.firstName !== 'Walk-in';
    const customerName = hasCustomer
      ? h(`${customer.firstName} ${customer.lastName || ''}`.trim())
      : 'Walk-in Customer';
    const customerPhone =
      hasCustomer && customer?.phone ? h(customer.phone) : '';
    const staff = order.posStaff;
    const staffName = staff
      ? h(
          staff.posName ||
            `${staff.firstName || ''} ${staff.lastName || ''}`.trim()
        )
      : '—';
    const orderItems = order.items || [];

    const lineRows = refundLines
      .map((line: any, i: number) => {
        const oi = orderItems[line.orderItemIndex];
        const name = h(
          oi?.product?.name || `Item ${(line.orderItemIndex ?? i) + 1}`
        );
        const variant = h(oi?.size?.displayName || oi?.size?.size || '');
        const rowBg = i % 2 === 1 ? 'background:#fafafa;' : '';
        return `<tr style="${rowBg}border-bottom:1px solid #f0f0f0">
        <td style="padding:10px 16px;font-size:13px;color:#111">
          <span style="font-weight:500">${name}</span>${variant ? `<span style="color:#888;font-size:11px"> · ${variant}</span>` : ''}
          ${line.discPct > 0 ? `<div style="font-size:10px;color:#d97706;margin-top:2px">&minus;${line.discPct}% disc</div>` : ''}
          ${line.reason ? `<div style="font-size:10px;color:#9ca3af;margin-top:2px;font-style:italic">${h(line.reason)}</div>` : ''}
        </td>
        <td style="padding:10px 16px;text-align:right;font-size:13px;color:#374151;white-space:nowrap">${line.quantity}.00 Units</td>
        <td style="padding:10px 16px;text-align:right;font-size:13px;color:#374151;font-variant-numeric:tabular-nums">${ng(line.unitPrice || 0)}</td>
        <td style="padding:10px 16px;text-align:right;font-size:12px;color:#d1d5db">—</td>
        <td style="padding:10px 16px;text-align:right;font-size:13px;font-weight:700;color:#b20202;font-variant-numeric:tabular-nums">&minus;${ng(line.amount || 0)}</td>
      </tr>`;
      })
      .join('');

    return `${commonHead}<title>Credit Note · ${returnNum}</title>
      ${pageOpen}${accentBar}${logoRow}${separator}
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
        <div>
          <div style="font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#9ca3af;margin-bottom:6px">Credit Note</div>
          <div style="font-size:28px;font-weight:900;color:#b20202;letter-spacing:-0.5px;line-height:1">${returnNum}</div>
          <div style="font-size:11px;color:#9ca3af;margin-top:4px">Original: ${h(order.receiptNumber || order.orderNumber || '—')}</div>
        </div>
        <div style="padding-top:4px">
          <span style="display:inline-block;padding:4px 12px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:0.06em;background:#fee2e218;color:#b20202;border:1px solid #b2020240">REFUNDED</span>
        </div>
      </div>
      <div style="display:flex;gap:0;margin:22px 0;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
        <div style="flex:1;padding:12px 16px;border-right:1px solid #e5e7eb">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#b20202;margin-bottom:4px">Return Date</div>
          <div style="font-size:13px;font-weight:600;color:#111">${returnDate}</div>
        </div>
        <div style="flex:1;padding:12px 16px;border-right:1px solid #e5e7eb">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#b20202;margin-bottom:4px">Cashier</div>
          <div style="font-size:13px;font-weight:600;color:#111">${staffName}</div>
        </div>
        <div style="flex:1;padding:12px 16px;border-right:1px solid #e5e7eb">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#b20202;margin-bottom:4px">Refund via</div>
          <div style="font-size:13px;font-weight:600;color:#111">${payMethod}</div>
        </div>
        <div style="flex:1;padding:12px 16px">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#b20202;margin-bottom:4px">Customer</div>
          <div style="font-size:13px;font-weight:600;color:#111">${customerName}</div>
          ${customerPhone ? `<div style="font-size:10px;color:#6b7280;margin-top:1px">${customerPhone}</div>` : ''}
        </div>
      </div>
      <table style="margin-bottom:0;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
        <thead><tr style="background:#f9fafb">
          <th style="padding:10px 16px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;border-bottom:1px solid #e5e7eb">Description</th>
          <th style="padding:10px 16px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;border-bottom:1px solid #e5e7eb;white-space:nowrap">Quantity</th>
          <th style="padding:10px 16px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;border-bottom:1px solid #e5e7eb;white-space:nowrap">Unit Price</th>
          <th style="padding:10px 16px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;border-bottom:1px solid #e5e7eb">Taxes</th>
          <th style="padding:10px 16px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;border-bottom:1px solid #e5e7eb">Amount</th>
        </tr></thead>
        <tbody>${lineRows}</tbody>
      </table>
      <div style="display:flex;justify-content:flex-end;margin-top:0;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;overflow:hidden">
        <div style="width:340px">
          ${
            (order.total ?? order.totalAmount)
              ? `
          <div style="display:flex;justify-content:space-between;padding:10px 16px;border-bottom:1px solid #f3f4f6;font-size:13px">
            <span style="color:#6b7280">Original order total</span><span style="font-weight:600;color:#111">${ng(order.total ?? order.totalAmount ?? 0)}</span>
          </div>`
              : ''
          }
          <div style="display:flex;justify-content:space-between;padding:13px 16px;background:#b20202">
            <span style="font-size:14px;font-weight:800;color:#fff;letter-spacing:0.02em">Total Refunded</span>
            <span style="font-size:14px;font-weight:800;color:#fff">&minus;${ng(totalRef)}</span>
          </div>
          ${
            (order.total ?? order.totalAmount) &&
            totalRef < (order.total ?? order.totalAmount ?? 0)
              ? `
          <div style="display:flex;justify-content:space-between;padding:9px 16px;background:#f9fafb;font-size:12px">
            <span style="color:#6b7280">Net paid</span><span style="font-weight:700;color:#111">${ng(Math.max(0, (order.total ?? order.totalAmount ?? 0) - totalRef))}</span>
          </div>`
              : ''
          }
        </div>
      </div>
      ${reason ? `<div style="margin-top:20px;font-size:12px;color:#6b7280"><span style="font-weight:600;color:#374151">Return reason: </span>${reason}</div>` : ''}
      <div style="margin-top:28px;font-size:12px;color:#6b7280">
        <span style="font-weight:600;color:#374151">Terms &amp; Conditions: </span>
        <span style="color:#b20202">https://www.drinksharbour.com/terms</span>
      </div>
    ${footer}`;
  }

  // ── POS / Online order ──────────────────────────────────────────────────────
  if (orderType === 'pos' || orderType === 'online') {
    const cashierName = order.posStaff
      ? order.posStaff.posName ||
        `${order.posStaff.firstName || ''} ${order.posStaff.lastName || ''}`.trim()
      : '—';
    const customer = order.customer;
    const hasCustomer = customer?.firstName && customer.firstName !== 'Walk-in';
    const customerName = hasCustomer
      ? `${customer.firstName} ${customer.lastName || ''}`.trim()
      : 'Walk-in Customer';
    const customerPhone = hasCustomer && customer?.phone ? customer.phone : '';
    const subtotal = order.subtotal ?? order.total ?? 0;
    const discount = order.discountTotal ?? 0;
    const splits = order.paymentDetails?.splitPayments ?? [];
    const change = order.paymentDetails?.change ?? 0;
    const orderDate = new Date(
      order.placedAt || order.createdAt
    ).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const totalRefunded = (order.refunds || []).reduce(
      (a: number, r: any) => a + (r.totalRefunded || 0),
      0
    );

    const isVoided = order.isVoided;
    const isFullyRefunded = order.paymentStatus === 'refunded';
    const isPartialRefund = order.paymentStatus === 'partially_refunded';
    const statusLabel = isVoided
      ? 'VOID'
      : isFullyRefunded
        ? 'REFUNDED'
        : isPartialRefund
          ? 'PART. REFUNDED'
          : 'PAID';
    const statusColor = isVoided
      ? '#64748b'
      : isFullyRefunded
        ? '#dc2626'
        : isPartialRefund
          ? '#d97706'
          : '#16a34a';

    const paymentLabel =
      splits.length > 0
        ? splits
            .map(
              (sp: any) =>
                `${(sp.method || '').replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())} ${ng(sp.amount)}`
            )
            .join(' + ')
        : (order.paymentMethod || '')
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (c: string) => c.toUpperCase());

    const refundedMap: Record<number, number> = {};
    (order.refunds || []).forEach((r: any) => {
      (r.items || []).forEach((ri: any) => {
        refundedMap[ri.orderItemIndex] =
          (refundedMap[ri.orderItemIndex] || 0) + ri.quantity;
      });
    });

    const itemRows = (order.items || [])
      .map((it: any, i: number) => {
        const ret = refundedMap[i] || 0;
        const crossed = ret >= it.quantity;
        const rowBg = i % 2 === 1 ? 'background:#fafafa;' : '';
        const name = h(it.product?.name || 'Product');
        const variant = h(it.size?.displayName || it.size?.size || '');
        return `<tr style="${rowBg}border-bottom:1px solid #f0f0f0;${crossed ? 'opacity:0.38;' : ''}">
        <td style="padding:10px 16px;font-size:13px;color:#111;${crossed ? 'text-decoration:line-through;' : ''}">
          <span style="font-weight:500">${name}</span>${variant ? `<span style="color:#888;font-size:11px"> · ${variant}</span>` : ''}
          ${ret > 0 && !crossed ? `<div style="font-size:10px;color:#dc2626;margin-top:2px;font-weight:600">&#8617; ${ret} returned</div>` : ''}
        </td>
        <td style="padding:10px 16px;text-align:right;font-size:13px;color:#374151;white-space:nowrap">${it.quantity}.00 Units</td>
        <td style="padding:10px 16px;text-align:right;font-size:13px;color:#374151;font-variant-numeric:tabular-nums">${ng(it.priceAtPurchase || 0)}</td>
        <td style="padding:10px 16px;text-align:right;font-size:12px;color:#d1d5db">—</td>
        <td style="padding:10px 16px;text-align:right;font-size:13px;font-weight:700;color:#111;font-variant-numeric:tabular-nums">${ng(it.itemSubtotal || 0)}</td>
      </tr>`;
      })
      .join('');

    const shippingInfo = order.shipping
      ? `<div style="font-size:12px;color:#6b7280;margin-top:4px">${h([order.shipping.address, order.shipping.city, order.shipping.state].filter(Boolean).join(', '))}</div>`
      : '';

    return `${commonHead}<title>Invoice · ${h(order.receiptNumber || order.orderNumber || '')}</title>
      ${pageOpen}${accentBar}${logoRow}${separator}
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
        <div>
          <div style="font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#9ca3af;margin-bottom:6px">Invoice</div>
          <div style="font-size:28px;font-weight:900;color:#b20202;letter-spacing:-0.5px;line-height:1">${h(order.receiptNumber || order.orderNumber || '—')}</div>
          ${order.orderNumber && order.receiptNumber ? `<div style="font-size:11px;color:#9ca3af;margin-top:4px">Order # ${h(order.orderNumber)}</div>` : ''}
        </div>
        <div style="padding-top:4px">
          <span style="display:inline-block;padding:4px 12px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:0.06em;background:${statusColor}18;color:${statusColor};border:1px solid ${statusColor}40">${statusLabel}</span>
        </div>
      </div>
      <div style="display:flex;gap:0;margin:22px 0;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
        <div style="flex:1;padding:12px 16px;border-right:1px solid #e5e7eb">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#b20202;margin-bottom:4px">Order Date</div>
          <div style="font-size:13px;font-weight:600;color:#111">${orderDate}</div>
        </div>
        <div style="flex:1;padding:12px 16px;border-right:1px solid #e5e7eb">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#b20202;margin-bottom:4px">Cashier</div>
          <div style="font-size:13px;font-weight:600;color:#111">${h(cashierName)}</div>
        </div>
        <div style="flex:1;padding:12px 16px;border-right:1px solid #e5e7eb">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#b20202;margin-bottom:4px">Payment</div>
          <div style="font-size:13px;font-weight:600;color:#111;text-transform:capitalize">${h(paymentLabel)}</div>
          ${change > 0 ? `<div style="font-size:10px;color:#6b7280;margin-top:1px">Change: ${ng(change)}</div>` : ''}
        </div>
        <div style="flex:1;padding:12px 16px">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#b20202;margin-bottom:4px">Customer</div>
          <div style="font-size:13px;font-weight:600;color:#111">${h(customerName)}</div>
          ${customerPhone ? `<div style="font-size:10px;color:#6b7280;margin-top:1px">${h(customerPhone)}</div>` : ''}
          ${shippingInfo}
        </div>
      </div>
      <table style="margin-bottom:0;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
        <thead><tr style="background:#f9fafb">
          <th style="padding:10px 16px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;border-bottom:1px solid #e5e7eb">Description</th>
          <th style="padding:10px 16px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;border-bottom:1px solid #e5e7eb;white-space:nowrap">Quantity</th>
          <th style="padding:10px 16px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;border-bottom:1px solid #e5e7eb;white-space:nowrap">Unit Price</th>
          <th style="padding:10px 16px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;border-bottom:1px solid #e5e7eb">Taxes</th>
          <th style="padding:10px 16px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;border-bottom:1px solid #e5e7eb">Amount</th>
        </tr></thead>
        <tbody>${itemRows}</tbody>
      </table>
      <div style="display:flex;justify-content:flex-end;margin-top:0;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;overflow:hidden">
        <div style="width:340px">
          ${discount > 0 ? `<div style="display:flex;justify-content:space-between;padding:10px 16px;border-bottom:1px solid #f3f4f6;font-size:13px"><span style="color:#6b7280">Discount</span><span style="color:#dc2626;font-weight:600">&minus;${ng(discount)}</span></div>` : ''}
          <div style="display:flex;justify-content:space-between;padding:10px 16px;border-bottom:1px solid #f3f4f6;font-size:13px">
            <span style="color:#6b7280">Untaxed Amount</span><span style="font-weight:600;color:#111">${ng(subtotal)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:13px 16px;background:#b20202">
            <span style="font-size:14px;font-weight:800;color:#fff;letter-spacing:0.02em">Total</span>
            <span style="font-size:14px;font-weight:800;color:#fff">${ng(order.total ?? order.totalAmount ?? 0)}</span>
          </div>
          ${
            totalRefunded > 0
              ? `
          <div style="display:flex;justify-content:space-between;padding:9px 16px;border-top:1px solid #fee2e2;background:#fff5f5;font-size:12px">
            <span style="color:#dc2626">Total Returned</span><span style="color:#dc2626;font-weight:700">&minus;${ng(totalRefunded)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:9px 16px;background:#fff5f5;border-top:1px dashed #fecaca;font-size:12px">
            <span style="color:#6b7280">Net Paid</span><span style="font-weight:700;color:#111">${ng(Math.max(0, (order.total ?? order.totalAmount ?? 0) - totalRefunded))}</span>
          </div>`
              : ''
          }
        </div>
      </div>
      <div style="margin-top:28px;font-size:12px;color:#6b7280">
        <span style="font-weight:600;color:#374151">Terms &amp; Conditions: </span>
        <span style="color:#b20202">https://www.drinksharbour.com/terms</span>
      </div>
    ${footer}`;
  }

  // ── Purchase Order ──────────────────────────────────────────────────────────
  const vendor = order.vendor || {};
  const vendorName = vendor.name || order.vendorName || 'Vendor';
  const items: any[] = order.items || [];
  const computedSub = items.reduce((a: number, it: any) => {
    const line = (it.unitCost || 0) * (it.quantity || 0);
    return a + line - (it.discount ? (line * it.discount) / 100 : 0);
  }, 0);
  const computedTax = items.reduce((a: number, it: any) => {
    const line = (it.unitCost || 0) * (it.quantity || 0);
    const after = line - (it.discount ? (line * it.discount) / 100 : 0);
    return a + (it.taxRate ? (after * it.taxRate) / 100 : 0);
  }, 0);
  const grandTotal =
    order.grandTotal || order.totalAmount || computedSub + computedTax;
  const partials: any[] = order.partialReceipts || [];
  const createdBy = order.createdBy
    ? h(order.createdBy.name || order.createdBy.email || '')
    : '—';
  const orderDate = new Date(
    order.orderDate || order.createdAt
  ).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const poStatusColor: Record<string, string> = {
    draft: '#64748b',
    confirmed: '#1d4ed8',
    received: '#16a34a',
    validated: '#16a34a',
    cancelled: '#dc2626',
  };
  const statusColor = poStatusColor[order.status] || '#64748b';

  const hasDiscount = items.some((it: any) => it.discount > 0);
  const hasTax = items.some((it: any) => it.taxRate > 0);

  const itemRows = items
    .map((it: any, i: number) => {
      const ord = it.quantity || 0;
      const rec = it.receivedQty ?? 0;
      const pct = ord > 0 ? Math.min(100, Math.round((rec / ord) * 100)) : 0;
      const fill = pct >= 100 ? '#16a34a' : pct > 0 ? '#d97706' : '#9ca3af';
      const lineAmt = (it.unitCost || 0) * ord;
      const disc = it.discount ? (lineAmt * it.discount) / 100 : 0;
      const lineTax = it.taxRate ? ((lineAmt - disc) * it.taxRate) / 100 : 0;
      const lineTotal = it.totalCost || lineAmt - disc + lineTax;
      const name = h(it.subProductId?.name || it.subProductName || 'Product');
      const variant = h(it.sizeId?.size || it.sizeId?.ml || it.sizeName || '');
      const sku = h(it.subProductId?.sku || it.sku || '');
      const rowBg = i % 2 === 1 ? 'background:#fafafa;' : '';
      return `<tr style="${rowBg}border-bottom:1px solid #f0f0f0">
      <td style="padding:10px 16px;font-size:13px;color:#111">
        <span style="font-weight:500">${name}</span>${variant ? `<span style="color:#888;font-size:11px"> · ${variant}</span>` : ''}
        ${sku ? `<div style="font-size:10px;color:#d1d5db;margin-top:2px;font-family:monospace">#${sku}</div>` : ''}
      </td>
      <td style="padding:10px 16px;text-align:right;font-size:13px;color:#374151;white-space:nowrap;vertical-align:top">${ord}<span style="font-size:10px;color:#9ca3af"> u</span></td>
      <td style="padding:10px 16px;text-align:right;font-size:13px;white-space:nowrap;vertical-align:top">
        <div><span style="color:${fill};font-weight:600">${rec}</span><span style="color:#d1d5db;font-size:11px">/${ord}</span></div>
        <div style="width:48px;height:3px;background:#f3f4f6;border-radius:3px;margin:5px 0 0 auto">
          <div style="width:${pct}%;height:3px;border-radius:3px;background:${fill}"></div>
        </div>
      </td>
      <td style="padding:10px 16px;text-align:right;font-size:13px;color:#374151;font-variant-numeric:tabular-nums;vertical-align:top">${ng(it.unitCost || 0)}</td>
      ${hasDiscount ? `<td style="padding:10px 16px;text-align:right;font-size:12px;vertical-align:top">${it.discount > 0 ? `<span style="color:#d97706;font-weight:600">${it.discount}%</span>` : `<span style="color:#d1d5db">—</span>`}</td>` : ''}
      ${hasTax ? `<td style="padding:10px 16px;text-align:right;font-size:12px;vertical-align:top">${it.taxRate > 0 ? `<span style="color:#2563eb;font-weight:600">${it.taxRate}%</span>` : `<span style="color:#d1d5db">—</span>`}</td>` : ''}
      <td style="padding:10px 16px;text-align:right;font-size:13px;font-weight:700;color:#111;font-variant-numeric:tabular-nums;vertical-align:top">
        ${ng(lineTotal)}
        ${disc > 0 ? `<div style="font-size:10px;color:#d97706;margin-top:2px">&minus;${ng(disc)}</div>` : ''}
      </td>
    </tr>`;
    })
    .join('');

  const partialSection = partials.length
    ? `
    <div style="margin-top:32px">
      <div style="font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#9ca3af;margin-bottom:12px">Receipt History</div>
      ${partials
        .map((r: any, i: number) => {
          const rDate = r.receiptDate
            ? new Date(r.receiptDate).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })
            : '—';
          const rRows = (r.items || [])
            .map((ri: any) => {
              const rPct =
                ri.quantityOrdered > 0
                  ? Math.min(
                      100,
                      Math.round(
                        (ri.quantityReceived / ri.quantityOrdered) * 100
                      )
                    )
                  : 0;
              const rFill = rPct >= 100 ? '#16a34a' : '#d97706';
              return `<tr style="border-bottom:1px solid #f0f0f0">
            <td style="padding:8px 16px;font-size:12px;color:#374151">${h(ri.subProductName || '')}</td>
            <td style="padding:8px 16px;text-align:right;font-size:12px"><span style="color:${rFill};font-weight:600">${ri.quantityReceived}</span><span style="color:#d1d5db">/${ri.quantityOrdered}</span></td>
            <td style="padding:8px 16px"><div style="width:60px;height:4px;background:#f3f4f6;border-radius:3px"><div style="width:${rPct}%;height:4px;border-radius:3px;background:${rFill}"></div></div></td>
          </tr>`;
            })
            .join('');
          return `<div style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 16px;background:#f9fafb;border-bottom:1px solid #e5e7eb">
            <span style="font-weight:700;font-size:13px;color:#111">${h(r.receiptNumber || `Receipt ${i + 1}`)}</span>
            <div style="display:flex;gap:10px;align-items:center">
              ${r.receivedByName ? `<span style="font-size:11px;color:#6b7280">By ${h(r.receivedByName)}</span>` : ''}
              <span style="font-size:12px;color:#6b7280">${rDate}</span>
            </div>
          </div>
          ${rRows ? `<table><tbody>${rRows}</tbody></table>` : ''}
        </div>`;
        })
        .join('')}
    </div>`
    : '';

  return `${commonHead}<title>PO · ${h(order.poNumber || '')}</title>
    ${pageOpen}${accentBar}${logoRow}${separator}
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
      <div>
        <div style="font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#9ca3af;margin-bottom:6px">Purchase Order</div>
        <div style="font-size:28px;font-weight:900;color:#b20202;letter-spacing:-0.5px;line-height:1">${h(order.poNumber || order._id)}</div>
        ${order.type === 'rfq' ? `<div style="font-size:11px;color:#9ca3af;margin-top:4px">Request For Quotation</div>` : ''}
      </div>
      <div style="padding-top:4px">
        <span style="display:inline-block;padding:4px 12px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;background:${statusColor}18;color:${statusColor};border:1px solid ${statusColor}40">${h(order.status || '')}</span>
      </div>
    </div>
    <div style="display:flex;gap:0;margin:22px 0;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
      <div style="flex:1;padding:12px 16px;border-right:1px solid #e5e7eb">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#b20202;margin-bottom:4px">Order Date</div>
        <div style="font-size:13px;font-weight:600;color:#111">${orderDate}</div>
      </div>
      <div style="flex:1;padding:12px 16px;border-right:1px solid #e5e7eb">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#b20202;margin-bottom:4px">Expected Arrival</div>
        <div style="font-size:13px;font-weight:600;color:#111">${fmtDateShort(order.expectedArrival)}</div>
      </div>
      <div style="flex:1;padding:12px 16px;border-right:1px solid #e5e7eb">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#b20202;margin-bottom:4px">Created By</div>
        <div style="font-size:13px;font-weight:600;color:#111">${createdBy}</div>
        ${order.paymentTerms ? `<div style="font-size:10px;color:#6b7280;margin-top:1px;text-transform:capitalize">${h(order.paymentTerms.replace(/_/g, ' '))}</div>` : ''}
      </div>
      <div style="flex:1;padding:12px 16px">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#b20202;margin-bottom:4px">Vendor</div>
        <div style="font-size:13px;font-weight:600;color:#111">${h(vendorName)}</div>
        ${vendor.email ? `<div style="font-size:10px;color:#6b7280;margin-top:1px">${h(vendor.email)}</div>` : ''}
      </div>
    </div>
    <table style="margin-bottom:0;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
      <thead><tr style="background:#f9fafb">
        <th style="padding:10px 16px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;border-bottom:1px solid #e5e7eb">Description</th>
        <th style="padding:10px 16px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;border-bottom:1px solid #e5e7eb;white-space:nowrap">Ordered</th>
        <th style="padding:10px 16px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;border-bottom:1px solid #e5e7eb;white-space:nowrap">Received</th>
        <th style="padding:10px 16px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;border-bottom:1px solid #e5e7eb;white-space:nowrap">Unit Cost</th>
        ${hasDiscount ? `<th style="padding:10px 16px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#d97706;border-bottom:1px solid #e5e7eb;white-space:nowrap">Disc %</th>` : ''}
        ${hasTax ? `<th style="padding:10px 16px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#2563eb;border-bottom:1px solid #e5e7eb;white-space:nowrap">Tax %</th>` : ''}
        <th style="padding:10px 16px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;border-bottom:1px solid #e5e7eb">Amount</th>
      </tr></thead>
      <tbody>${itemRows}</tbody>
    </table>
    <div style="display:flex;justify-content:flex-end;margin-top:0;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;overflow:hidden">
      <div style="width:340px">
        ${
          computedTax > 0
            ? `
        <div style="display:flex;justify-content:space-between;padding:10px 16px;border-bottom:1px solid #f3f4f6;font-size:13px">
          <span style="color:#6b7280">Subtotal</span><span style="font-weight:600;color:#111">${ng(computedSub)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:10px 16px;border-bottom:1px solid #f3f4f6;font-size:13px">
          <span style="color:#6b7280">Tax</span><span style="font-weight:600;color:#1d4ed8">+${ng(computedTax)}</span>
        </div>`
            : ''
        }
        <div style="display:flex;justify-content:space-between;padding:13px 16px;background:#b20202">
          <span style="font-size:14px;font-weight:800;color:#fff;letter-spacing:0.02em">Grand Total</span>
          <span style="font-size:14px;font-weight:800;color:#fff">${ng(grandTotal)}</span>
        </div>
      </div>
    </div>
    ${order.notes ? `<div style="margin-top:20px;font-size:12px;color:#6b7280"><span style="font-weight:600;color:#374151">Notes: </span>${h(order.notes)}</div>` : ''}
    <div style="margin-top:28px;font-size:12px;color:#6b7280">
      <span style="font-weight:600;color:#374151">Terms &amp; Conditions: </span>
      <span style="color:#b20202">https://www.drinksharbour.com/terms</span>
    </div>
    ${partialSection}
  ${footer}`;
}

function openPrint(
  order: any,
  orderType: 'pos' | 'online' | 'purchase' | 'return' | 'po_return',
  tenant: any,
  refund?: any,
  movement?: InventoryMovement
) {
  const html = generatePrintHTML(order, orderType, tenant, refund, movement);
  const win = window.open('', '_blank', 'width=900,height=1100,scrollbars=yes');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
    win.close();
  }, 500);
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'confirmed'
      ? 'bg-green-100 text-green-700'
      : status === 'pending'
        ? 'bg-amber-100 text-amber-700'
        : status === 'cancelled'
          ? 'bg-gray-100 text-gray-500 line-through'
          : 'bg-gray-100 text-gray-500';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${cls}`}
    >
      {status}
    </span>
  );
}

const FILTER_TABS: { id: CategoryFilter | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'sale', label: 'Sales' },
  { id: 'return', label: 'Returns' },
  { id: 'in', label: 'Stock In' },
  { id: 'out', label: 'Stock Out' },
  { id: 'adjustment', label: 'Adjustments' },
  { id: 'transfer', label: 'Transfers' },
];

// ── PO status badge helper ───────────────────────────────────────────────────

function POStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-500',
    confirmed: 'bg-blue-100 text-blue-700',
    received: 'bg-green-100 text-green-700',
    validated: 'bg-emerald-100 text-emerald-700',
    cancelled: 'bg-red-100 text-red-600',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase capitalize tracking-wider ${map[status] || 'bg-gray-100 text-gray-500'}`}
    >
      {status}
    </span>
  );
}

function POTypeBadge({ type }: { type: string }) {
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
        type === 'rfq'
          ? 'bg-amber-100 text-amber-700'
          : 'bg-indigo-100 text-indigo-700'
      }`}
    >
      {type === 'rfq' ? 'RFQ' : 'Purchase Order'}
    </span>
  );
}

function ApprovalBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-600',
    pending: 'bg-amber-100 text-amber-700',
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${map[status] || 'bg-gray-100 text-gray-500'}`}
    >
      {status === 'approved' && <PiCheckCircle className="h-2.5 w-2.5" />}
      {status === 'pending' && <PiHourglass className="h-2.5 w-2.5" />}
      {status}
    </span>
  );
}

// ── Sale Return Dialog (POS / Online) ────────────────────────────────────────

const POS_PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'wallet', label: 'Wallet' },
];

function SaleReturnDialog({
  order,
  orderType,
  token,
  onClose,
  onSuccess,
}: {
  order: any;
  orderType: 'pos' | 'online';
  token: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  // Build already-refunded map per item index
  const refundedMap: Record<number, number> = {};
  (order.refunds || []).forEach((r: any) => {
    (r.items || []).forEach((ri: any) => {
      refundedMap[ri.orderItemIndex] =
        (refundedMap[ri.orderItemIndex] || 0) + ri.quantity;
    });
  });

  interface SaleLine {
    orderItemIndex: number;
    productName: string;
    sizeName: string;
    qty: string;
    maxQty: number;
    unitPrice: number;
  }

  const initialLines = (): SaleLine[] =>
    (order.items || [])
      .map((it: any, i: number) => ({
        orderItemIndex: i,
        productName: it.product?.name || 'Product',
        sizeName: it.size?.displayName || it.size?.size || '',
        qty: '0',
        maxQty: Math.max(0, (it.quantity || 0) - (refundedMap[i] || 0)),
        unitPrice: it.priceAtPurchase || 0,
      }))
      .filter((l: SaleLine) => l.maxQty > 0);

  const [lines, setLines] = useState<SaleLine[]>(initialLines);
  const [payMethod, setPayMethod] = useState(
    order.paymentDetails?.splitPayments?.[0]?.method ||
      order.paymentMethod ||
      'cash'
  );
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateQty = (i: number, v: string) =>
    setLines((p) => p.map((l, idx) => (idx === i ? { ...l, qty: v } : l)));
  const deleteLine = (i: number) =>
    setLines((p) => p.filter((_, idx) => idx !== i));

  async function doSubmit(useMax = false) {
    const toReturn = lines.filter(
      (l) => (useMax ? l.maxQty : parseFloat(l.qty || '0')) > 0
    );
    if (!toReturn.length) {
      setError('Enter a quantity greater than 0 on at least one line.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      if (orderType === 'pos') {
        // Use the admin-auth POS refund endpoint (avoids POS-token requirement)
        const res = await fetch(
          `${API_URL}/api/orders/${order._id}/pos-refund`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              items: toReturn.map((l) => ({
                orderItemIndex: l.orderItemIndex,
                quantity: useMax ? l.maxQty : parseFloat(l.qty),
                reason: reason || undefined,
                restock: true,
              })),
              reason: reason || undefined,
              refundPaymentMethod: payMethod,
            }),
          }
        );
        const data = await res.json();
        if (!res.ok)
          throw new Error(data.message || 'Failed to process refund');
        if (data.data?.warnings?.length) {
          setError(`Completed with warnings: ${data.data.warnings.join('; ')}`);
          setTimeout(() => {
            onSuccess();
            onClose();
          }, 2000);
          return;
        }
      } else {
        // Online: compute refund amount from selected lines
        const amount = toReturn.reduce((sum, l) => {
          const q = useMax ? l.maxQty : parseFloat(l.qty);
          return sum + q * l.unitPrice;
        }, 0);
        const res = await fetch(`${API_URL}/api/orders/${order._id}/payment`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            action: 'mark_refunded',
            amount,
            notes: reason,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || 'Failed to process refund');
        }
      }
      onSuccess();
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to process return');
    } finally {
      setLoading(false);
    }
  }

  const btnBase =
    'rounded-lg px-5 py-2 text-sm font-semibold transition-colors disabled:opacity-50';
  const refundableTotal = lines.reduce((s, l) => {
    const q = parseFloat(l.qty || '0');
    return s + (isNaN(q) ? 0 : q * l.unitPrice);
  }, 0);

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
      <div
        className="flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        style={{ maxHeight: '88%' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-gray-900">Return</h2>
            <p className="mt-0.5 text-[11px] text-gray-400">
              {order.receiptNumber || order.orderNumber} ·{' '}
              {orderType === 'pos' ? 'POS Sale' : 'Online Order'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <PiX className="h-5 w-5" />
          </button>
        </div>

        {/* Lines */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {lines.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <PiArrowCounterClockwise className="h-10 w-10 text-gray-200" />
              <p className="text-sm font-medium text-gray-500">
                Nothing left to return
              </p>
              <p className="text-xs text-gray-400">
                All items on this order have already been fully refunded.
              </p>
            </div>
          ) : (
            <>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="pb-2.5 text-left font-semibold text-gray-800">
                      Product
                    </th>
                    <th className="w-32 pb-2.5 pr-2 text-right font-semibold text-gray-800">
                      Quantity
                    </th>
                    <th className="w-28 pb-2.5 pl-4 text-left font-semibold text-gray-800">
                      Unit of Measure
                    </th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, idx) => (
                    <tr
                      key={line.orderItemIndex}
                      className="border-b border-gray-100"
                    >
                      <td className="py-3 pr-4">
                        <p className="font-medium text-gray-800">
                          {line.productName}
                        </p>
                        {line.sizeName && (
                          <p className="mt-0.5 text-xs text-gray-400">
                            {line.sizeName}
                          </p>
                        )}
                        <p className="mt-0.5 text-[10px] text-gray-300">
                          max {line.maxQty}
                        </p>
                      </td>
                      <td className="py-3 pr-2 text-right">
                        <input
                          type="number"
                          min="0"
                          max={line.maxQty}
                          step="1"
                          value={line.qty}
                          onChange={(e) => updateQty(idx, e.target.value)}
                          className="w-24 rounded-lg border border-gray-200 px-2.5 py-1.5 text-right text-sm tabular-nums focus:border-[#b20202] focus:outline-none focus:ring-1 focus:ring-[#b20202]/20"
                        />
                      </td>
                      <td className="py-3 pl-4 text-gray-600">Units</td>
                      <td className="py-3 pl-2 text-center">
                        <button
                          onClick={() => deleteLine(idx)}
                          className="rounded p-1 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500"
                        >
                          <PiTrash className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Refund total preview */}
              {refundableTotal > 0 && (
                <div className="mt-3 flex justify-end">
                  <span className="text-xs text-gray-400">Refund amount: </span>
                  <span className="ml-1.5 text-xs font-bold tabular-nums text-gray-700">
                    {fmtMoney(refundableTotal)}
                  </span>
                </div>
              )}

              {/* Payment method (POS only) */}
              {orderType === 'pos' && (
                <div className="mt-4">
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Refund Payment Method
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {POS_PAYMENT_METHODS.map((pm) => (
                      <button
                        key={pm.value}
                        type="button"
                        onClick={() => setPayMethod(pm.value)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                          payMethod === pm.value
                            ? 'border-[#b20202] bg-[#b20202]/5 text-[#b20202]'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        {pm.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Reason */}
              <div className="mt-4">
                <input
                  type="text"
                  placeholder="Reason (optional)"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-gray-400 focus:outline-none"
                />
              </div>
            </>
          )}

          {error && (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center gap-2 border-t border-gray-200 px-6 py-4">
          {lines.length > 0 && (
            <>
              <button
                onClick={() => doSubmit(false)}
                disabled={loading}
                className={`${btnBase} bg-[#3d1a4d] text-white hover:bg-[#4f2266]`}
              >
                {loading ? (
                  <span className="flex items-center gap-1.5">
                    <PiSpinner className="h-3.5 w-3.5 animate-spin" />
                    Processing…
                  </span>
                ) : (
                  'Return'
                )}
              </button>
              <button
                onClick={() => doSubmit(true)}
                disabled={loading}
                className={`${btnBase} bg-[#3d1a4d] text-white hover:bg-[#4f2266]`}
              >
                Return All
              </button>
            </>
          )}
          <button
            onClick={onClose}
            disabled={loading}
            className={`${btnBase} bg-gray-100 text-gray-700 hover:bg-gray-200`}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Return Dialog (Odoo-style) ───────────────────────────────────────────────

interface ReturnLine {
  key: string;
  subProductId: string;
  productName: string;
  sizeName: string;
  uom: string;
  qty: string;
  maxQty: number;
  unitCost: number;
}

function ReturnDialog({
  order,
  token,
  onClose,
  onSuccess,
}: {
  order: any;
  token: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const poItems: any[] = order.items || [];

  const makeLines = (src: any[]): ReturnLine[] =>
    src.map((it: any, i: number) => ({
      key: String(it.subProductId?._id || it.subProductId || `line-${i}`),
      subProductId: it.subProductId?._id || it.subProductId || '',
      productName:
        it.subProductId?.name ||
        it.subProductName ||
        it.productName ||
        'Product',
      sizeName: it.sizeId?.size || it.sizeId?.ml || it.sizeName || '',
      uom: it.uom || 'Units',
      qty: '0',
      maxQty: it.receivedQty ?? it.quantity ?? 0,
      unitCost: it.unitCost || 0,
    }));

  const [lines, setLines] = useState<ReturnLine[]>(() => makeLines(poItems));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  function updateQty(key: string, val: string) {
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, qty: val } : l))
    );
  }

  function deleteLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }

  function addLine() {
    const usedKeys = new Set(lines.map((l) => l.key));
    const next = poItems.find((it) => {
      const k = String(it.subProductId?._id || it.subProductId || '');
      return k && !usedKeys.has(k);
    });
    if (!next) return;
    setLines((prev) => [...prev, ...makeLines([next])]);
  }

  const hasUnused = poItems.some((it) => {
    const k = String(it.subProductId?._id || it.subProductId || '');
    return k && !lines.find((l) => l.key === k);
  });

  async function doSubmit(isExchange: boolean, useMax = false) {
    const toReturn = lines.filter((l) => {
      const q = useMax ? l.maxQty : parseFloat(l.qty || '0');
      return q > 0 && l.subProductId;
    });
    if (toReturn.length === 0) {
      setError('Enter a quantity greater than 0 on at least one line.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_URL}/api/purchase-orders/${order._id}/return`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            items: toReturn.map((l) => ({
              subProductId: l.subProductId,
              quantity: useMax ? l.maxQty : parseFloat(l.qty),
              reason: reason || undefined,
            })),
            reason: reason || undefined,
            isExchange,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to process return');
      if (data.data?.warnings?.length) {
        setError(`Completed with warnings: ${data.data.warnings.join('; ')}`);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 2000);
        return;
      }
      onSuccess();
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to process return');
    } finally {
      setLoading(false);
    }
  }

  const btnBase =
    'rounded-lg px-5 py-2 text-sm font-semibold transition-colors disabled:opacity-50';

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
      <div
        className="flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        style={{ maxHeight: '85%' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-base font-bold text-gray-900">Return</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <PiX className="h-5 w-5" />
          </button>
        </div>

        {/* Lines table */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="pb-2.5 text-left font-semibold text-gray-800">
                  Product
                </th>
                <th className="w-32 pb-2.5 pr-2 text-right font-semibold text-gray-800">
                  Quantity
                </th>
                <th className="w-28 pb-2.5 pl-4 text-left font-semibold text-gray-800">
                  Unit of Measure
                </th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.key} className="border-b border-gray-100">
                  <td className="py-3 pr-4">
                    <p className="font-medium text-gray-800">
                      {line.productName}
                    </p>
                    {line.sizeName && (
                      <p className="mt-0.5 text-xs text-gray-400">
                        {line.sizeName}
                      </p>
                    )}
                    {line.maxQty > 0 && (
                      <p className="mt-0.5 text-[10px] text-gray-300">
                        max {line.maxQty}
                      </p>
                    )}
                  </td>
                  <td className="py-3 pr-2 text-right">
                    <input
                      type="number"
                      min="0"
                      max={line.maxQty || undefined}
                      step="1"
                      value={line.qty}
                      onChange={(e) => updateQty(line.key, e.target.value)}
                      className="w-24 rounded-lg border border-gray-200 px-2.5 py-1.5 text-right text-sm tabular-nums focus:border-[#b20202] focus:outline-none focus:ring-1 focus:ring-[#b20202]/20"
                    />
                  </td>
                  <td className="py-3 pl-4 text-gray-600">{line.uom}</td>
                  <td className="py-3 pl-2 text-center">
                    <button
                      onClick={() => deleteLine(line.key)}
                      className="rounded p-1 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500"
                    >
                      <PiTrash className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {hasUnused && (
            <button
              onClick={addLine}
              className="mt-3 text-sm font-medium text-[#b20202] hover:underline"
            >
              Add a line
            </button>
          )}

          {/* Reason */}
          <div className="mt-4">
            <input
              type="text"
              placeholder="Reason (optional)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-gray-400 focus:outline-none"
            />
          </div>

          {error && (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
              {error}
            </div>
          )}
        </div>

        {/* Footer buttons */}
        <div className="flex flex-wrap items-center gap-2 border-t border-gray-200 px-6 py-4">
          <button
            onClick={() => doSubmit(false)}
            disabled={loading}
            className={`${btnBase} bg-[#3d1a4d] text-white hover:bg-[#4f2266]`}
          >
            {loading ? (
              <span className="flex items-center gap-1.5">
                <PiSpinner className="h-3.5 w-3.5 animate-spin" /> Processing…
              </span>
            ) : (
              'Return'
            )}
          </button>
          <button
            onClick={() => doSubmit(false, true)}
            disabled={loading}
            className={`${btnBase} bg-[#3d1a4d] text-white hover:bg-[#4f2266]`}
          >
            Return All
          </button>
          <button
            onClick={() => doSubmit(true)}
            disabled={loading}
            className={`${btnBase} bg-[#3d1a4d] text-white hover:bg-[#4f2266]`}
          >
            Return for Exchange
          </button>
          <button
            onClick={onClose}
            disabled={loading}
            className={`${btnBase} bg-gray-100 text-gray-700 hover:bg-gray-200`}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Purchase Order full view ─────────────────────────────────────────────────

function POView({ order, onReturn }: { order: any; onReturn?: () => void }) {
  const vendor = order.vendor || null;
  const vendorName = vendor?.name || order.vendorName || null;

  // Compute totals from items if not on order
  const itemsArr: any[] = order.items || [];
  const computedSubtotal = itemsArr.reduce((acc: number, it: any) => {
    const lineAmt = (it.unitCost || 0) * (it.quantity || 0);
    const disc = it.discount ? lineAmt * (it.discount / 100) : 0;
    return acc + lineAmt - disc;
  }, 0);
  const computedTax = itemsArr.reduce((acc: number, it: any) => {
    const lineAmt = (it.unitCost || 0) * (it.quantity || 0);
    const disc = it.discount ? lineAmt * (it.discount / 100) : 0;
    return acc + (it.taxRate ? (lineAmt - disc) * (it.taxRate / 100) : 0);
  }, 0);
  const grandTotal =
    order.grandTotal || order.totalAmount || computedSubtotal + computedTax;

  const partialReceipts: any[] = order.partialReceipts || [];

  return (
    <div className="space-y-4">
      {/* ── PO Header ── */}
      <div className="overflow-hidden rounded-xl border border-gray-200">
        <div className="flex items-start justify-between gap-3 bg-gray-50 px-4 py-3">
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <p className="text-base font-bold text-gray-900">
                {order.poNumber || order._id}
              </p>
              {order.type && <POTypeBadge type={order.type} />}
            </div>
            <p className="text-[10px] text-gray-400">
              Created {formatDate(order.orderDate || order.createdAt)}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            {order.status && <POStatusBadge status={order.status} />}
            {order.approvalStatus &&
              order.approvalStatus !== 'not_required' && (
                <ApprovalBadge status={order.approvalStatus} />
              )}
          </div>
        </div>

        {/* Key dates row */}
        <div className="grid grid-cols-2 divide-x divide-gray-100 border-t border-gray-100">
          <div className="px-3 py-2.5">
            <p className="mb-0.5 text-[9px] font-bold uppercase tracking-wider text-gray-400">
              Order Date
            </p>
            <p className="text-xs font-medium text-gray-700">
              {order.orderDate
                ? new Date(order.orderDate).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })
                : '—'}
            </p>
          </div>
          <div className="px-3 py-2.5">
            <p className="mb-0.5 text-[9px] font-bold uppercase tracking-wider text-gray-400">
              Expected Arrival
            </p>
            <p className="text-xs font-medium text-gray-700">
              {order.expectedArrival
                ? new Date(order.expectedArrival).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })
                : '—'}
            </p>
          </div>
        </div>

        {order.fullyReceivedDate && (
          <div className="flex items-center gap-2 border-t border-green-100 bg-green-50 px-3 py-2 text-xs text-green-700">
            <PiCheckCircle className="h-3.5 w-3.5 shrink-0" />
            Fully received on{' '}
            {new Date(order.fullyReceivedDate).toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}
          </div>
        )}
        {!order.fullyReceivedDate && order.isPartiallyReceived && (
          <div className="flex items-center gap-2 border-t border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            <PiHourglass className="h-3.5 w-3.5 shrink-0" />
            Partially received
          </div>
        )}
      </div>

      {/* ── Vendor Card ── */}
      {(vendorName || vendor) && (
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Vendor
          </p>
          <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200">
            {vendorName && (
              <div className="flex items-center gap-3 px-3 py-2.5 text-xs">
                <PiWarehouse className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                <span className="font-semibold text-gray-800">
                  {vendorName}
                </span>
              </div>
            )}
            {(vendor?.email || order.vendorEmail) && (
              <div className="flex items-center gap-3 px-3 py-2 text-xs text-gray-600">
                <PiTag className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                {vendor?.email || order.vendorEmail}
              </div>
            )}
            {vendor?.phone && (
              <div className="flex items-center gap-3 px-3 py-2 text-xs text-gray-600">
                <PiPhone className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                {vendor.phone}
              </div>
            )}
            {vendor?.address && (
              <div className="flex items-start gap-3 px-3 py-2 text-xs text-gray-600">
                <PiMapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
                <span>
                  {typeof vendor.address === 'string'
                    ? vendor.address
                    : [
                        vendor.address?.street,
                        vendor.address?.city,
                        vendor.address?.state,
                      ]
                        .filter(Boolean)
                        .join(', ')}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Procurement Details ── */}
      <div className="space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
          Procurement Info
        </p>
        <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200">
          {order.createdBy && (
            <div className="flex items-center gap-3 px-3 py-2.5 text-xs">
              <PiUser className="h-3.5 w-3.5 shrink-0 text-gray-400" />
              <span className="w-24 shrink-0 text-gray-500">Created by</span>
              <span className="font-medium text-gray-700">
                {order.createdBy.name || order.createdBy.email}
              </span>
            </div>
          )}
          {order.approvedByName && (
            <div className="flex items-center gap-3 px-3 py-2.5 text-xs">
              <PiCheckCircle className="h-3.5 w-3.5 shrink-0 text-gray-400" />
              <span className="w-24 shrink-0 text-gray-500">Approved by</span>
              <span className="font-medium text-gray-700">
                {order.approvedByName}
              </span>
            </div>
          )}
          {order.paymentTerms && (
            <div className="flex items-center gap-3 px-3 py-2.5 text-xs">
              <PiCalendar className="h-3.5 w-3.5 shrink-0 text-gray-400" />
              <span className="w-24 shrink-0 text-gray-500">Payment Terms</span>
              <span className="font-medium capitalize text-gray-700">
                {order.paymentTerms.replace(/_/g, ' ')}
              </span>
            </div>
          )}
          {order.vendorReference && (
            <div className="flex items-center gap-3 px-3 py-2.5 text-xs">
              <PiReceipt className="h-3.5 w-3.5 shrink-0 text-gray-400" />
              <span className="w-24 shrink-0 text-gray-500">Vendor Ref</span>
              <span className="font-medium text-gray-700">
                {order.vendorReference}
              </span>
            </div>
          )}
          {order.currency && order.currency !== 'NGN' && (
            <div className="flex items-center gap-3 px-3 py-2.5 text-xs">
              <PiCurrencyNgn className="h-3.5 w-3.5 shrink-0 text-gray-400" />
              <span className="w-24 shrink-0 text-gray-500">Currency</span>
              <span className="font-medium text-gray-700">
                {order.currency}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Items Table ── */}
      {itemsArr.length > 0 &&
        (() => {
          const hasDiscount = itemsArr.some((it: any) => it.discount > 0);
          const hasTax = itemsArr.some((it: any) => it.taxRate > 0);
          return (
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Order Lines
              </p>
              <div className="overflow-hidden rounded-xl border border-gray-200">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="w-auto px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider text-gray-400">
                        Description
                      </th>
                      <th className="w-16 whitespace-nowrap px-3 py-2.5 text-right text-[9px] font-bold uppercase tracking-wider text-gray-400">
                        Ordered
                      </th>
                      <th className="w-20 whitespace-nowrap px-3 py-2.5 text-right text-[9px] font-bold uppercase tracking-wider text-gray-400">
                        Received
                      </th>
                      <th className="w-24 whitespace-nowrap px-3 py-2.5 text-right text-[9px] font-bold uppercase tracking-wider text-gray-400">
                        Unit Cost
                      </th>
                      {hasDiscount && (
                        <th className="w-14 whitespace-nowrap px-3 py-2.5 text-right text-[9px] font-bold uppercase tracking-wider text-amber-500">
                          Disc %
                        </th>
                      )}
                      {hasTax && (
                        <th className="w-14 whitespace-nowrap px-3 py-2.5 text-right text-[9px] font-bold uppercase tracking-wider text-blue-500">
                          Tax %
                        </th>
                      )}
                      <th className="w-24 whitespace-nowrap px-3 py-2.5 text-right text-[9px] font-bold uppercase tracking-wider text-gray-400">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {itemsArr.map((item: any, i: number) => {
                      const ordered = item.quantity || 0;
                      const received = item.receivedQty ?? 0;
                      const pct =
                        ordered > 0
                          ? Math.min(
                              100,
                              Math.round((received / ordered) * 100)
                            )
                          : 0;
                      const lineAmt = (item.unitCost || 0) * ordered;
                      const discAmt = item.discount
                        ? lineAmt * (item.discount / 100)
                        : 0;
                      const taxAmt = item.taxRate
                        ? (lineAmt - discAmt) * (item.taxRate / 100)
                        : 0;
                      const lineTotal =
                        item.totalCost || lineAmt - discAmt + taxAmt;
                      const sizeLabel =
                        item.sizeId?.size ||
                        item.sizeId?.ml ||
                        item.sizeName ||
                        null;
                      const productName =
                        item.subProductId?.name ||
                        item.subProductName ||
                        item.productName ||
                        'Product';
                      const sku = item.subProductId?.sku || item.sku || null;
                      const recColor =
                        received >= ordered
                          ? 'text-green-600'
                          : received > 0
                            ? 'text-amber-600'
                            : 'text-gray-300';
                      const barColor =
                        received >= ordered
                          ? 'bg-green-500'
                          : received > 0
                            ? 'bg-amber-400'
                            : 'bg-gray-200';
                      const rowEven = i % 2 === 1 ? 'bg-gray-50/40' : '';
                      return (
                        <tr key={i} className={rowEven}>
                          {/* Description */}
                          <td className="px-3 py-2.5 align-top">
                            <p className="font-medium leading-snug text-gray-800">
                              {productName}
                            </p>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                              {sizeLabel && (
                                <span className="inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">
                                  {sizeLabel}
                                </span>
                              )}
                              {item.uom && (
                                <span className="text-[10px] text-gray-400">
                                  {item.uom}
                                </span>
                              )}
                              {sku && (
                                <span className="font-mono text-[10px] text-gray-300">
                                  #{sku}
                                </span>
                              )}
                            </div>
                          </td>
                          {/* Ordered */}
                          <td className="px-3 py-2.5 text-right align-top">
                            <span className="font-semibold tabular-nums text-gray-700">
                              {ordered}
                            </span>
                            <span className="ml-0.5 text-[10px] text-gray-400">
                              u
                            </span>
                          </td>
                          {/* Received */}
                          <td className="px-3 py-2.5 text-right align-top">
                            <div className="inline-flex flex-col items-end gap-1">
                              <div>
                                <span
                                  className={`font-semibold tabular-nums ${recColor}`}
                                >
                                  {received}
                                </span>
                                <span className="text-[10px] text-gray-300">
                                  /{ordered}
                                </span>
                              </div>
                              {ordered > 0 && (
                                <div className="h-1 w-12 rounded-full bg-gray-100">
                                  <div
                                    className={`h-1 rounded-full ${barColor}`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              )}
                            </div>
                          </td>
                          {/* Unit Cost */}
                          <td className="px-3 py-2.5 text-right align-top tabular-nums text-gray-600">
                            {fmtMoney(item.unitCost || 0)}
                          </td>
                          {/* Discount */}
                          {hasDiscount && (
                            <td className="px-3 py-2.5 text-right align-top">
                              {item.discount > 0 ? (
                                <span className="font-medium text-amber-600">
                                  {item.discount}%
                                </span>
                              ) : (
                                <span className="text-gray-300">—</span>
                              )}
                            </td>
                          )}
                          {/* Tax */}
                          {hasTax && (
                            <td className="px-3 py-2.5 text-right align-top">
                              {item.taxRate > 0 ? (
                                <span className="font-medium text-blue-500">
                                  {item.taxRate}%
                                </span>
                              ) : (
                                <span className="text-gray-300">—</span>
                              )}
                            </td>
                          )}
                          {/* Amount */}
                          <td className="px-3 py-2.5 text-right align-top">
                            <span className="font-bold tabular-nums text-gray-900">
                              {fmtMoney(lineTotal)}
                            </span>
                            {discAmt > 0 && (
                              <p className="text-[10px] tabular-nums text-amber-600">
                                −{fmtMoney(discAmt)}
                              </p>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

      {/* ── Totals ── */}
      <div className="overflow-hidden rounded-xl border border-gray-200">
        <div className="flex justify-end">
          <div className="w-64 divide-y divide-gray-100">
            {computedSubtotal > 0 && (
              <div className="flex justify-between px-4 py-2 text-xs text-gray-500">
                <span>Subtotal</span>
                <span className="font-medium tabular-nums text-gray-700">
                  {fmtMoney(computedSubtotal)}
                </span>
              </div>
            )}
            {computedTax > 0 && (
              <div className="flex justify-between px-4 py-2 text-xs text-blue-600">
                <span>Tax</span>
                <span className="font-medium tabular-nums">
                  +{fmtMoney(computedTax)}
                </span>
              </div>
            )}
            <div className="flex justify-between bg-[#b20202] px-4 py-2.5">
              <span className="text-sm font-bold tracking-wide text-white">
                Grand Total
              </span>
              <span className="text-sm font-bold tabular-nums text-white">
                {fmtMoney(grandTotal)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Partial Receipts ── */}
      {partialReceipts.length > 0 && (
        <div className="space-y-1">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
            <PiTruck className="h-3 w-3" /> Receipt History (
            {partialReceipts.length})
          </p>
          <div className="space-y-2">
            {partialReceipts.map((receipt: any, idx: number) => {
              const rDate = receipt.receiptDate
                ? new Date(receipt.receiptDate).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })
                : '—';
              const totalReceivedQty = (receipt.items || []).reduce(
                (a: number, x: any) => a + (x.quantityReceived || 0),
                0
              );
              return (
                <div
                  key={idx}
                  className="overflow-hidden rounded-xl border border-gray-200"
                >
                  <div className="flex items-center justify-between bg-gray-50 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <PiPackage className="h-3.5 w-3.5 text-gray-400" />
                      <span className="text-[11px] font-semibold text-gray-700">
                        {receipt.receiptNumber || `Receipt ${idx + 1}`}
                      </span>
                      {receipt.status && (
                        <span
                          className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${receipt.status === 'complete' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}
                        >
                          {receipt.status}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-400">{rDate}</span>
                  </div>
                  {receipt.items?.length > 0 && (
                    <div className="divide-y divide-gray-100">
                      {receipt.items.map((ri: any, j: number) => {
                        const rPct =
                          ri.quantityOrdered > 0
                            ? Math.min(
                                100,
                                Math.round(
                                  (ri.quantityReceived / ri.quantityOrdered) *
                                    100
                                )
                              )
                            : 0;
                        return (
                          <div
                            key={j}
                            className="flex items-center gap-3 px-3 py-2"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[11px] text-gray-700">
                                {ri.subProductName ||
                                  ri.subProductId?.name ||
                                  'Product'}
                              </p>
                              {ri.sizeName && (
                                <p className="text-[10px] text-gray-400">
                                  {ri.sizeName}
                                </p>
                              )}
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <span className="text-[11px] tabular-nums text-gray-500">
                                {ri.quantityReceived}
                                <span className="text-gray-300">
                                  /{ri.quantityOrdered}
                                </span>
                              </span>
                              <div className="h-1.5 w-12 rounded-full bg-gray-100">
                                <div
                                  className={`h-1.5 rounded-full ${rPct >= 100 ? 'bg-green-500' : 'bg-amber-400'}`}
                                  style={{ width: `${rPct}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {receipt.receivedByName && (
                    <div className="flex items-center gap-2 border-t border-gray-100 px-3 py-1.5 text-[10px] text-gray-400">
                      <PiUser className="h-3 w-3" /> Received by{' '}
                      <span className="font-medium text-gray-600">
                        {receipt.receivedByName}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Notes ── */}
      {order.notes && (
        <div className="overflow-hidden rounded-xl border border-gray-200">
          <div className="flex items-center gap-2 bg-gray-50 px-3 py-2">
            <PiClipboardText className="h-3.5 w-3.5 text-gray-400" />
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Notes
            </p>
          </div>
          <p className="px-3 py-2.5 text-xs text-gray-600">{order.notes}</p>
        </div>
      )}

      {/* ── Return action ── */}
      {onReturn && order.status !== 'cancelled' && (
        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={onReturn}
            className="flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600 transition-colors hover:border-[#b20202] hover:bg-red-50 hover:text-[#b20202]"
          >
            <PiArrowCounterClockwise className="h-3.5 w-3.5" />
            Return Products
          </button>
        </div>
      )}
    </div>
  );
}

// ── Purchase Order Vendor Return view ────────────────────────────────────────

function POReturnReceiptView({
  order: po,
  movement,
}: {
  order: any;
  movement: InventoryMovement;
}) {
  const returnDate = (movement as any).performedAt || movement.createdAt;
  const poNumber = po.poNumber || movement.reference || '—';
  const vendorName = po.vendor?.name || po.vendorName || '—';
  const vendorEmail = po.vendor?.email || null;
  const isExchange =
    (movement.notes || '').toLowerCase().includes('exchange') ||
    (movement.reason || '').toLowerCase().includes('exchange');

  const performer = movement.performedBy
    ? movement.performedBy.posName ||
      `${movement.performedBy.firstName || ''} ${movement.performedBy.lastName || ''}`.trim() ||
      movement.performedBy.email ||
      '—'
    : '—';

  const movSizeId =
    typeof movement.size === 'object'
      ? movement.size?._id
      : (movement.size as any);
  const movSizeName =
    typeof movement.size === 'object'
      ? movement.size?.displayName || movement.size?.size
      : movement.sizeName;

  // Try to find the matching PO line for the product name
  const poLine =
    (po.items || []).find((it: any) => {
      const itSize =
        it.sizeId?._id?.toString() || it.sizeId?.toString() || null;
      if (movSizeId && itSize) return itSize === movSizeId;
      if (movSizeName && it.sizeName) return it.sizeName === movSizeName;
      return false;
    }) || (po.items?.length === 1 ? po.items[0] : null);

  const productName =
    poLine?.subProductId?.name || poLine?.subProductName || '—';
  const sizeLabel = movSizeName || poLine?.sizeName || null;
  const quantity = movement.quantity;
  const unitCost = movement.unitCost || poLine?.unitCost || 0;
  const totalValue = quantity * unitCost;
  const reason = movement.reason || movement.notes || '';

  // All return movements on this PO (for context)
  // Not available directly — just show this movement's data

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
              {isExchange ? 'Return for Exchange' : 'Vendor Return'}
            </p>
            <p className="text-xl font-black leading-none tracking-tight text-[#b20202]">
              {poNumber}
            </p>
            <p className="mt-1.5 text-[11px] text-gray-400">
              PO Type:{' '}
              <span className="font-semibold text-gray-700">
                {po.type === 'rfq' ? 'RFQ' : 'Purchase Order'}
              </span>
            </p>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
              isExchange
                ? 'bg-blue-100 text-blue-700'
                : 'bg-amber-100 text-amber-700'
            }`}
          >
            {isExchange ? 'Exchange' : 'Returned'}
          </span>
        </div>

        {/* 4-col meta strip */}
        <div className="-mx-1 grid grid-cols-4 divide-x divide-gray-200 border-t border-gray-200 pt-3">
          <div className="px-3">
            <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-[#b20202]">
              Return Date
            </p>
            <p className="text-[11px] font-semibold leading-snug text-gray-800">
              {new Date(returnDate).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            </p>
            <p className="text-[10px] text-gray-400">
              {new Date(returnDate).toLocaleTimeString('en-GB', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>
          <div className="px-3">
            <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-[#b20202]">
              PO Number
            </p>
            <p className="text-[11px] font-semibold leading-snug text-gray-800">
              {poNumber}
            </p>
            {po.status && (
              <p className="text-[10px] capitalize text-gray-400">
                {po.status}
              </p>
            )}
          </div>
          <div className="px-3">
            <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-[#b20202]">
              Vendor
            </p>
            <p className="text-[11px] font-semibold leading-snug text-gray-800">
              {vendorName}
            </p>
            {vendorEmail && (
              <p className="text-[10px] text-gray-400">{vendorEmail}</p>
            )}
          </div>
          <div className="px-3">
            <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-[#b20202]">
              Processed By
            </p>
            <p className="text-[11px] font-semibold leading-snug text-gray-800">
              {performer}
            </p>
          </div>
        </div>
      </div>

      {/* ── Item returned ── */}
      <div className="space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
          Item Returned to Vendor
        </p>
        <div className="overflow-hidden rounded-xl border border-gray-200">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider text-gray-400">
                  Description
                </th>
                <th className="w-12 px-3 py-2.5 text-right text-[9px] font-bold uppercase tracking-wider text-gray-400">
                  Qty
                </th>
                <th className="w-24 px-3 py-2.5 text-right text-[9px] font-bold uppercase tracking-wider text-gray-400">
                  Unit Cost
                </th>
                <th className="w-24 px-3 py-2.5 text-right text-[9px] font-bold uppercase tracking-wider text-gray-400">
                  Total Value
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-3 py-3 align-top">
                  <p className="font-medium leading-snug text-gray-800">
                    {productName}
                  </p>
                  {sizeLabel && (
                    <span className="mt-0.5 inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">
                      {sizeLabel}
                    </span>
                  )}
                </td>
                <td className="px-3 py-3 text-right align-top tabular-nums text-gray-700">
                  {quantity}.00
                </td>
                <td className="px-3 py-3 text-right align-top tabular-nums text-gray-500">
                  {fmtMoney(unitCost)}
                </td>
                <td className="px-3 py-3 text-right align-top font-bold tabular-nums text-[#b20202]">
                  −{fmtMoney(totalValue)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Total ── */}
      <div className="overflow-hidden rounded-xl border border-gray-200">
        <div className="flex justify-end">
          <div className="w-72">
            {unitCost > 0 && (
              <div className="flex justify-between border-b border-gray-100 px-4 py-2 text-xs text-gray-500">
                <span>
                  {quantity} × {fmtMoney(unitCost)}
                </span>
                <span className="font-medium tabular-nums text-gray-700">
                  {fmtMoney(totalValue)}
                </span>
              </div>
            )}
            <div className="flex justify-between bg-[#b20202] px-4 py-2.5">
              <span className="text-sm font-bold tracking-wide text-white">
                {isExchange ? 'Value Exchanged' : 'Total Value Returned'}
              </span>
              <span className="text-sm font-bold tabular-nums text-white">
                −{fmtMoney(totalValue)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Reason ── */}
      {reason && (
        <div className="overflow-hidden rounded-xl border border-gray-200">
          <div className="flex items-center gap-2 bg-gray-50 px-3 py-2">
            <PiClipboardText className="h-3.5 w-3.5 text-gray-400" />
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              {isExchange ? 'Exchange Notes' : 'Return Reason'}
            </p>
          </div>
          <p className="px-3 py-2.5 text-xs text-gray-600">{reason}</p>
        </div>
      )}
    </div>
  );
}

// ── Return Receipt / Credit Note view ───────────────────────────────────────

function ReturnReceiptView({
  order,
  refund,
  movement,
}: {
  order: any;
  refund: any;
  movement: InventoryMovement;
}) {
  const returnNumber = refund?.receiptNumber || movement.reference || '—';
  const returnDate = refund?.refundedAt || movement.createdAt;
  const payMethod =
    (refund?.paymentMethod || '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c: string) => c.toUpperCase()) || '—';
  const refundLines: any[] = refund?.items || [];
  const totalRefunded =
    refund?.totalRefunded ||
    movement.quantity * (movement.sellingPrice || 0) ||
    0;
  const reason = refund?.reason || movement.reason || movement.notes || '';
  const orderItems = order.items || [];

  const customer = order.customer;
  const hasCustomer = customer?.firstName && customer.firstName !== 'Walk-in';
  const customerName = hasCustomer
    ? `${customer.firstName} ${customer.lastName || ''}`.trim()
    : 'Walk-in Customer';
  const staff = order.posStaff;
  const staffName = staff
    ? staff.posName || `${staff.firstName || ''} ${staff.lastName || ''}`.trim()
    : null;

  // Cumulative refund across all refunds on the order
  const cumulativeRefunded = (order.refunds || []).reduce(
    (s: number, r: any) => s + (r.totalRefunded || 0),
    0
  );
  const originalTotal = order.total ?? order.totalAmount ?? 0;
  const netPaid = Math.max(0, originalTotal - cumulativeRefunded);

  // No refund record linked — show a fallback using movement data
  const noRecord = !refund && refundLines.length === 0;

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Credit Note
            </p>
            <p className="text-xl font-black leading-none tracking-tight text-[#b20202]">
              {returnNumber}
            </p>
            <p className="mt-1.5 text-[11px] text-gray-400">
              Original order:{' '}
              <span className="font-semibold text-gray-700">
                {order.receiptNumber || order.orderNumber || '—'}
              </span>
            </p>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
              order.paymentStatus === 'refunded'
                ? 'bg-red-100 text-[#b20202]'
                : 'bg-amber-100 text-amber-700'
            }`}
          >
            {order.paymentStatus === 'refunded'
              ? 'Fully Refunded'
              : 'Partially Refunded'}
          </span>
        </div>

        {/* Meta strip — same 4-column style as POS invoice */}
        <div className="-mx-1 grid grid-cols-4 divide-x divide-gray-200 border-t border-gray-200 pt-3">
          <div className="px-3">
            <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-[#b20202]">
              Return Date
            </p>
            <p className="text-[11px] font-semibold leading-snug text-gray-800">
              {new Date(returnDate).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            </p>
            <p className="text-[10px] text-gray-400">
              {new Date(returnDate).toLocaleTimeString('en-GB', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>
          <div className="px-3">
            <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-[#b20202]">
              Refund via
            </p>
            <p className="text-[11px] font-semibold capitalize leading-snug text-gray-800">
              {payMethod || '—'}
            </p>
          </div>
          <div className="px-3">
            <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-[#b20202]">
              Customer
            </p>
            <p className="text-[11px] font-semibold leading-snug text-gray-800">
              {customerName}
            </p>
            {hasCustomer && customer?.phone && (
              <p className="text-[10px] text-gray-400">{customer.phone}</p>
            )}
          </div>
          <div className="px-3">
            <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-[#b20202]">
              Cashier
            </p>
            <p className="text-[11px] font-semibold leading-snug text-gray-800">
              {staffName || '—'}
            </p>
          </div>
        </div>
      </div>

      {/* ── Items returned ── */}
      {noRecord ? (
        /* Fallback when no refund record is linked */
        <div className="space-y-1 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
          <p className="font-semibold">
            Return recorded via inventory movement
          </p>
          <p className="text-amber-600">
            Quantity returned:{' '}
            <span className="font-bold">{movement.quantity}</span>
            {movement.sizeName ? ` · ${movement.sizeName}` : ''}
          </p>
          {reason && <p className="italic text-amber-600">{reason}</p>}
        </div>
      ) : (
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Items Returned
          </p>
          <div className="overflow-hidden rounded-xl border border-gray-200">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider text-gray-400">
                    Description
                  </th>
                  <th className="w-12 px-3 py-2.5 text-right text-[9px] font-bold uppercase tracking-wider text-gray-400">
                    Qty
                  </th>
                  <th className="w-24 px-3 py-2.5 text-right text-[9px] font-bold uppercase tracking-wider text-gray-400">
                    Unit Price
                  </th>
                  <th className="w-24 px-3 py-2.5 text-right text-[9px] font-bold uppercase tracking-wider text-gray-400">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {refundLines.map((line: any, i: number) => {
                  const oi = orderItems[line.orderItemIndex];
                  const name =
                    oi?.product?.name ||
                    `Item ${(line.orderItemIndex ?? i) + 1}`;
                  const variant = oi?.size?.displayName || oi?.size?.size || '';
                  return (
                    <tr key={i} className={i % 2 === 1 ? 'bg-gray-50/40' : ''}>
                      <td className="px-3 py-2.5 align-top">
                        <p className="font-medium leading-snug text-gray-800">
                          {name}
                        </p>
                        {variant && (
                          <p className="text-[10px] text-gray-400">{variant}</p>
                        )}
                        {line.discPct > 0 && (
                          <span className="mt-0.5 inline-block rounded bg-amber-50 px-1 py-0.5 text-[9px] font-semibold text-amber-600">
                            −{line.discPct}% disc
                          </span>
                        )}
                        {line.reason && (
                          <p className="mt-0.5 text-[10px] italic text-gray-400">
                            {line.reason}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right align-top tabular-nums text-gray-700">
                        {line.quantity}.00
                      </td>
                      <td className="px-3 py-2.5 text-right align-top tabular-nums text-gray-500">
                        {fmtMoney(line.unitPrice || 0)}
                      </td>
                      <td className="px-3 py-2.5 text-right align-top font-bold tabular-nums text-[#b20202]">
                        −{fmtMoney(line.amount || 0)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Totals ── (right-aligned, same style as sale invoice) */}
      <div className="overflow-hidden rounded-xl border border-gray-200">
        <div className="flex justify-end">
          <div className="w-72 divide-y divide-gray-100">
            {cumulativeRefunded > totalRefunded && (
              <div className="flex justify-between px-4 py-2 text-xs text-gray-500">
                <span>This return</span>
                <span className="font-medium tabular-nums text-[#b20202]">
                  −{fmtMoney(totalRefunded)}
                </span>
              </div>
            )}
            {cumulativeRefunded > 0 && cumulativeRefunded !== totalRefunded && (
              <div className="flex justify-between px-4 py-2 text-xs text-gray-500">
                <span>Cumulative refunded</span>
                <span className="font-medium tabular-nums text-[#b20202]">
                  −{fmtMoney(cumulativeRefunded)}
                </span>
              </div>
            )}
            {originalTotal > 0 && (
              <div className="flex justify-between px-4 py-2 text-xs text-gray-500">
                <span>Original order total</span>
                <span className="font-medium tabular-nums text-gray-700">
                  {fmtMoney(originalTotal)}
                </span>
              </div>
            )}
            <div className="flex justify-between bg-[#b20202] px-4 py-2.5">
              <span className="text-sm font-bold tracking-wide text-white">
                Total Refunded
              </span>
              <span className="text-sm font-bold tabular-nums text-white">
                −{fmtMoney(totalRefunded)}
              </span>
            </div>
            {originalTotal > 0 && cumulativeRefunded < originalTotal && (
              <div className="flex justify-between bg-gray-50 px-4 py-2 text-xs text-gray-500">
                <span>Net paid</span>
                <span className="font-medium tabular-nums text-gray-700">
                  {fmtMoney(netPaid)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Reason ── */}
      {reason && (
        <div className="overflow-hidden rounded-xl border border-gray-200">
          <div className="flex items-center gap-2 bg-gray-50 px-3 py-2">
            <PiClipboardText className="h-3.5 w-3.5 text-gray-400" />
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Return Reason
            </p>
          </div>
          <p className="px-3 py-2.5 text-xs text-gray-600">{reason}</p>
        </div>
      )}
    </div>
  );
}

// ── POS / Online Sale Order view ─────────────────────────────────────────────

function SaleOrderView({
  order,
  source,
  customer,
  staffName,
  splits,
  change,
  onReturn,
}: {
  order: any;
  source: ReturnType<typeof getSourceBadge>;
  customer: any;
  staffName: string | null;
  splits: any[];
  change: number;
  onReturn?: () => void;
}) {
  // Is there anything left to return?
  const refundedMap: Record<number, number> = {};
  (order.refunds || []).forEach((r: any) => {
    (r.items || []).forEach((ri: any) => {
      refundedMap[ri.orderItemIndex] =
        (refundedMap[ri.orderItemIndex] || 0) + ri.quantity;
    });
  });
  const hasReturnable =
    !order.isVoided &&
    order.paymentStatus !== 'refunded' &&
    (order.items || []).some(
      (it: any, i: number) => (it.quantity || 0) - (refundedMap[i] || 0) > 0
    );

  return (
    <>
      {/* Invoice header */}
      <div className="space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-base font-bold text-gray-900">
              {order.receiptNumber || order.orderNumber}
            </p>
            <p className="text-xs text-gray-500">
              {formatDate(order.placedAt || order.createdAt)}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <span
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                order.paymentStatus === 'paid'
                  ? 'bg-green-100 text-green-700'
                  : order.isVoided
                    ? 'bg-gray-100 text-gray-500'
                    : order.paymentStatus === 'refunded'
                      ? 'bg-amber-100 text-amber-700'
                      : order.paymentStatus === 'partially_refunded'
                        ? 'bg-orange-100 text-orange-700'
                        : 'bg-gray-100 text-gray-600'
              }`}
            >
              {order.isVoided ? 'Voided' : order.paymentStatus || order.status}
            </span>
            <span
              className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${source.cls}`}
            >
              {source.icon}
              {source.label}
            </span>
          </div>
        </div>

        {customer && (customer.firstName !== 'Walk-in' || customer.phone) ? (
          <div className="flex items-center gap-2 border-t border-gray-200 pt-1 text-xs text-gray-600">
            <PiUser className="h-3.5 w-3.5 shrink-0 text-gray-400" />
            <span>
              {customer.firstName} {customer.lastName || ''}
              {customer.phone && (
                <span className="text-gray-400"> · {customer.phone}</span>
              )}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 border-t border-gray-200 pt-1 text-xs text-gray-400">
            <PiUser className="h-3.5 w-3.5 shrink-0" /> Walk-in Customer
          </div>
        )}

        {staffName && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <PiTag className="h-3.5 w-3.5 shrink-0 text-gray-400" />
            Cashier:{' '}
            <span className="font-medium text-gray-700">{staffName}</span>
          </div>
        )}
      </div>

      {/* Items */}
      <div className="space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
          Items Ordered
        </p>
        <div className="overflow-hidden rounded-xl border border-gray-200">
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 bg-gray-50 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
            <span>Product</span>
            <span className="text-right">Qty</span>
            <span className="text-right">Total</span>
          </div>
          {order.items?.map((item: any, i: number) => {
            const productName = item.product?.name || 'Product';
            const sizeName2 = item.size?.displayName || item.size?.size || null;
            const unitPrice = item.priceAtPurchase || 0;
            const lineTotal = item.itemSubtotal || 0;
            const disc = item.discountAmount || 0;
            return (
              <div
                key={i}
                className={`grid grid-cols-[1fr_auto_auto] gap-x-3 px-3 py-2.5 text-xs ${i < order.items.length - 1 ? 'border-b border-gray-100' : ''}`}
              >
                <div className="min-w-0">
                  <p className="font-medium leading-snug text-gray-800">
                    {productName}
                  </p>
                  {sizeName2 && (
                    <p className="text-[10px] text-gray-400">{sizeName2}</p>
                  )}
                  <p className="text-[10px] tabular-nums text-gray-400">
                    @ {fmtMoney(unitPrice)}
                    {disc > 0 && (
                      <span className="text-amber-600"> −{fmtMoney(disc)}</span>
                    )}
                  </p>
                </div>
                <span className="self-start pt-0.5 text-right font-medium tabular-nums text-gray-600">
                  {item.quantity}
                </span>
                <span className="self-start pt-0.5 text-right font-semibold tabular-nums text-gray-800">
                  {fmtMoney(lineTotal)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Totals */}
      <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200">
        {(order.subtotal || 0) !== (order.totalAmount || 0) && (
          <div className="flex justify-between px-3 py-2 text-xs text-gray-500">
            <span>Subtotal</span>
            <span className="tabular-nums">
              {fmtMoney(order.subtotal || 0)}
            </span>
          </div>
        )}
        {(order.discountTotal || 0) > 0 && (
          <div className="flex justify-between px-3 py-2 text-xs text-amber-700">
            <span>Discount</span>
            <span className="tabular-nums">
              −{fmtMoney(order.discountTotal)}
            </span>
          </div>
        )}
        {(order.shippingFee || 0) > 0 && (
          <div className="flex justify-between px-3 py-2 text-xs text-gray-500">
            <span>Shipping</span>
            <span className="tabular-nums">{fmtMoney(order.shippingFee)}</span>
          </div>
        )}
        <div className="flex justify-between bg-gray-50 px-3 py-2.5 text-sm font-bold text-gray-900">
          <span>Total</span>
          <span className="tabular-nums">
            {fmtMoney(order.totalAmount || order.total || 0)}
          </span>
        </div>
      </div>

      {/* Payment */}
      <div className="space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
          Payment
        </p>
        <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200">
          {splits.length > 0 ? (
            splits.map((sp: any, i: number) => (
              <div
                key={i}
                className="flex items-center justify-between px-3 py-2 text-xs"
              >
                <span className="capitalize text-gray-600">
                  {sp.method?.replace(/_/g, ' ')}
                </span>
                <span className="font-medium tabular-nums text-gray-800">
                  {fmtMoney(sp.amount)}
                </span>
              </div>
            ))
          ) : (
            <div className="flex items-center justify-between px-3 py-2 text-xs">
              <span className="capitalize text-gray-600">
                {(order.paymentMethod || '').replace(/_/g, ' ')}
              </span>
              <span className="font-medium tabular-nums text-gray-800">
                {fmtMoney(order.totalAmount || 0)}
              </span>
            </div>
          )}
          {change > 0 && (
            <div className="flex items-center justify-between bg-gray-50 px-3 py-2 text-xs text-gray-500">
              <span>Change given</span>
              <span className="tabular-nums">{fmtMoney(change)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Refunds */}
      {order.refunds?.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600">
            Returns / Refunds
          </p>
          <div className="divide-y divide-amber-100 overflow-hidden rounded-xl border border-amber-200">
            {order.refunds.map((r: any, i: number) => (
              <div key={i} className="px-3 py-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-700">
                    {r.receiptNumber || `Return ${i + 1}`}
                  </span>
                  <span className="font-bold tabular-nums text-amber-700">
                    −{fmtMoney(r.totalRefunded)}
                  </span>
                </div>
                {r.items?.map((ri: any, j: number) => (
                  <p key={j} className="mt-0.5 text-[10px] text-gray-400">
                    Item {ri.orderItemIndex + 1} · ×{ri.quantity} ·{' '}
                    {fmtMoney(ri.amount)}
                  </p>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Return action ── */}
      {onReturn && hasReturnable && (
        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={onReturn}
            className="flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600 transition-colors hover:border-[#b20202] hover:bg-red-50 hover:text-[#b20202]"
          >
            <PiArrowCounterClockwise className="h-3.5 w-3.5" />
            Return Products
          </button>
        </div>
      )}
    </>
  );
}

// ── Movement Detail Panel ────────────────────────────────────────────────────

export function MovementDetailPanel({
  movement,
  token,
  tenant,
  onClose,
  onRefresh,
}: {
  movement: InventoryMovement;
  token?: string;
  tenant?: any;
  onClose: () => void;
  onRefresh?: () => void;
}) {
  const [order, setOrder] = useState<any>(null);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [orderErr, setOrderErr] = useState<string | null>(null);
  const [orderType, setOrderType] = useState<
    'pos' | 'online' | 'purchase' | 'none'
  >('none');
  const [tab, setTab] = useState<'movement' | 'order'>('order');
  const [showReturn, setShowReturn] = useState(false);

  const orderId = getOrderId(movement);
  // PO id
  const poId = movement.relatedPurchaseOrder
    ? typeof movement.relatedPurchaseOrder === 'object'
      ? movement.relatedPurchaseOrder._id
      : movement.relatedPurchaseOrder
    : null;
  // Receipt number fallback (for POS movements where relatedOrder wasn't back-linked)
  const isPOSMovement =
    movement.source === 'order' ||
    (movement.notes || '').toLowerCase().includes('pos');
  const receiptRef =
    isPOSMovement && !orderId ? movement.reference || null : null;

  const cat = getCategory(movement);
  const style = getCatStyle(cat);
  const source = getSourceBadge(movement);
  const wh = getWarehouseInfo(movement);
  const sizeName =
    typeof movement.size === 'object' && movement.size
      ? movement.size.displayName || movement.size.size
      : movement.sizeName || null;
  const performer = movement.performedBy
    ? movement.performedBy.posName ||
      `${movement.performedBy.firstName || ''} ${movement.performedBy.lastName || ''}`.trim() ||
      movement.performedBy.email
    : null;

  // Determine fetch strategy and load
  useEffect(() => {
    if (!token) {
      setTab('movement');
      return;
    }
    setLoadingOrder(true);
    setOrderErr(null);
    setOrder(null);

    let url: string | null = null;

    if (poId) {
      url = `${API_URL}/api/purchase-orders/${poId}`;
    } else if (orderId) {
      url = `${API_URL}/api/orders/${orderId}`;
    } else if (receiptRef) {
      url = `${API_URL}/api/orders/receipt/${encodeURIComponent(receiptRef)}`;
    }

    if (!url) {
      setTab('movement');
      setLoadingOrder(false);
      return;
    }

    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        const doc =
          data.data?.order ||
          data.data?.purchaseOrder ||
          data.data ||
          data.order ||
          null;
        setOrder(doc);
        if (poId) setOrderType('purchase');
        else if (doc?.source === 'pos') setOrderType('pos');
        else if (doc) setOrderType('online');
        else {
          setTab('movement');
          setOrderType('none');
        }
      })
      .catch((e) => {
        setOrderErr(e.message || 'Could not load details');
        setTab('movement');
      })
      .finally(() => setLoadingOrder(false));
  }, [orderId, poId, receiptRef, token]);

  const isPOS = orderType === 'pos';
  const isOnline = orderType === 'online';
  const isPurchase = orderType === 'purchase';

  // Detect return movement types
  const isCustomerReturn =
    movement.type === 'return' &&
    (movement.category === 'in' || !movement.category);
  const isPOReturn = movement.type === 'return' && movement.category === 'out';
  const isReturnMovement = isCustomerReturn; // used for customer/POS returns only

  // For customer returns: find matching refund record in order.refunds
  const matchedRefund =
    isCustomerReturn && order
      ? (order.refunds || []).find(
          (r: any) => r.receiptNumber === movement.reference
        ) ||
        (order.refunds?.length > 0
          ? order.refunds[order.refunds.length - 1]
          : null)
      : null;

  const orderLabel = isCustomerReturn
    ? 'Return Receipt'
    : isPOReturn
      ? 'Vendor Return'
      : isPOS
        ? 'POS Sale'
        : isOnline
          ? 'Online Order'
          : isPurchase
            ? 'Purchase Order'
            : 'Order';

  const customer = order?.customer;
  const staff = order?.posStaff;
  const staffName = staff
    ? staff.posName || `${staff.firstName || ''} ${staff.lastName || ''}`.trim()
    : null;
  const splits = order?.paymentDetails?.splitPayments || [];
  const change = order?.paymentDetails?.change || 0;

  const canPrint = !loadingOrder && !!order;

  return (
    <div className="relative flex h-full flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${style.bg} ${style.text}`}
          >
            {style.icon}
          </span>
          <div>
            <p className="text-sm font-semibold text-gray-900">
              {formatType(movement.type)}
            </p>
            <p className="text-[10px] text-gray-400">
              {formatDate(movement.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {canPrint && (
            <button
              type="button"
              onClick={() =>
                openPrint(
                  order,
                  isCustomerReturn
                    ? 'return'
                    : isPOReturn
                      ? 'po_return'
                      : (orderType as any),
                  tenant,
                  isCustomerReturn ? matchedRefund : undefined,
                  isPOReturn ? movement : undefined
                )
              }
              title={
                isCustomerReturn || isPOReturn
                  ? 'Print credit note'
                  : 'Print invoice'
              }
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100"
            >
              <PiPrinter className="h-4 w-4" />
              {isCustomerReturn || isPOReturn ? 'Print Note' : 'Print'}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
          >
            <PiX className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 text-xs font-semibold">
        {(orderId || poId || receiptRef) && (
          <button
            type="button"
            onClick={() => setTab('order')}
            className={`flex-1 py-2.5 transition-colors ${tab === 'order' ? 'border-b-2 border-[#b20202] text-[#b20202]' : 'text-gray-400 hover:text-gray-600'}`}
          >
            {orderLabel}
          </button>
        )}
        <button
          type="button"
          onClick={() => setTab('movement')}
          className={`flex-1 py-2.5 transition-colors ${tab === 'movement' ? 'border-b-2 border-[#b20202] text-[#b20202]' : 'text-gray-400 hover:text-gray-600'}`}
        >
          Movement
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* ── Order / Invoice tab ── */}
        {tab === 'order' && (
          <div className="space-y-4 p-4">
            {loadingOrder ? (
              <div className="flex items-center justify-center gap-2 py-8 text-xs text-gray-400">
                <PiSpinner className="h-5 w-5 animate-spin" /> Loading…
              </div>
            ) : orderErr ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-700">
                {orderErr}
              </div>
            ) : isCustomerReturn && order ? (
              /* ── Customer / POS Return Receipt ── */
              <ReturnReceiptView
                order={order}
                refund={matchedRefund}
                movement={movement}
              />
            ) : isPOReturn && order ? (
              /* ── Vendor Return (PO) ── */
              <POReturnReceiptView order={order} movement={movement} />
            ) : isPurchase && order ? (
              /* ── Purchase Order view ── */
              <POView
                order={order}
                onReturn={token ? () => setShowReturn(true) : undefined}
              />
            ) : order ? (
              /* ── POS / Online Order view ── */
              <SaleOrderView
                order={order}
                source={source}
                customer={customer}
                staffName={staffName}
                splits={splits}
                change={change}
                onReturn={token ? () => setShowReturn(true) : undefined}
              />
            ) : (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <PiReceipt className="h-10 w-10 text-gray-200" />
                <p className="text-xs text-gray-400">
                  No order details available for this movement
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Movement tab ── */}
        {tab === 'movement' && (
          <div className="space-y-4 p-4">
            {/* Qty strip */}
            <div className="grid grid-cols-3 divide-x divide-gray-100 rounded-xl border border-gray-200 bg-gray-50">
              {[
                {
                  label: 'Qty',
                  value: (
                    <span
                      className={`text-xl font-bold tabular-nums ${getQtyColor(cat)}`}
                    >
                      {getQtySign(cat)}
                      {movement.quantity}
                    </span>
                  ),
                },
                {
                  label: 'Before',
                  value: (
                    <span className="text-xl font-bold tabular-nums text-gray-700">
                      {movement.quantityBefore ?? '—'}
                    </span>
                  ),
                },
                {
                  label: 'After',
                  value: (
                    <span className="text-xl font-bold tabular-nums text-gray-700">
                      {movement.quantityAfter ?? '—'}
                    </span>
                  ),
                },
              ].map(({ label, value }) => (
                <div key={label} className="px-3 py-3 text-center">
                  <p className="mb-1 text-[10px] uppercase tracking-wider text-gray-400">
                    {label}
                  </p>
                  {value}
                </div>
              ))}
            </div>

            {/* Fields */}
            <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200">
              {[
                {
                  label: 'Status',
                  value: <StatusBadge status={movement.status} />,
                },
                {
                  label: 'Source',
                  value: (
                    <span
                      className={`flex w-fit items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${source.cls}`}
                    >
                      {source.icon}
                      {source.label}
                    </span>
                  ),
                },
                wh &&
                  (wh.kind === 'route'
                    ? { label: 'Route', value: `${wh.from} → ${wh.to}` }
                    : { label: 'Warehouse', value: wh.label }),
                sizeName && { label: 'Size', value: sizeName },
                getOrderRef(movement) && {
                  label: 'Reference',
                  value: getOrderRef(movement),
                },
                performer && { label: 'By', value: performer },
                movement.supplierName && {
                  label: 'Supplier',
                  value: movement.supplierName,
                },
                movement.unitCost && {
                  label: 'Unit Cost',
                  value: fmtMoney(movement.unitCost),
                },
                (movement.reason || movement.notes) && {
                  label: 'Reason',
                  value: movement.reason || movement.notes,
                },
              ]
                .filter(Boolean)
                .map(({ label, value }: any) => (
                  <div
                    key={label}
                    className="flex items-start gap-3 px-3 py-2.5"
                  >
                    <span className="w-20 shrink-0 text-[11px] text-gray-400">
                      {label}
                    </span>
                    <span className="break-words text-[11px] font-medium text-gray-700">
                      {value}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Return dialog overlay */}
      {showReturn && order && token && isPurchase && (
        <ReturnDialog
          order={order}
          token={token}
          onClose={() => setShowReturn(false)}
          onSuccess={() => {
            setShowReturn(false);
            onRefresh?.();
          }}
        />
      )}
      {showReturn && order && token && (isPOS || isOnline) && (
        <SaleReturnDialog
          order={order}
          orderType={isPOS ? 'pos' : 'online'}
          token={token}
          onClose={() => setShowReturn(false)}
          onSuccess={() => {
            setShowReturn(false);
            onRefresh?.();
          }}
        />
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function ServerMovementsList({
  movements,
  isLoading,
  onRefresh,
  onCancel,
}: ServerMovementsListProps) {
  const { data: session } = useSession();
  const token = session?.user?.token as string | undefined;
  const { tenant } = useTenant();

  const [activeFilter, setActiveFilter] = useState<CategoryFilter | 'all'>(
    'all'
  );
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<InventoryMovement | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const filtered = movements.filter((m) => {
    if (activeFilter !== 'all' && getCategory(m) !== activeFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const ref = getOrderRef(m) || '';
      const type = formatType(m.type).toLowerCase();
      const reason = (m.reason || '').toLowerCase();
      const notes = (m.notes || '').toLowerCase();
      const performer = m.performedBy
        ? `${m.performedBy.firstName || ''} ${m.performedBy.lastName || ''} ${m.performedBy.posName || ''}`.toLowerCase()
        : '';
      if (
        !ref.toLowerCase().includes(q) &&
        !type.includes(q) &&
        !reason.includes(q) &&
        !notes.includes(q) &&
        !performer.includes(q)
      )
        return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  );

  const handleFilter = (f: CategoryFilter | 'all') => {
    setActiveFilter(f);
    setPage(1);
  };
  const handleSearch = (v: string) => {
    setSearch(v);
    setPage(1);
  };

  const counts: Record<string, number> = { all: movements.length };
  movements.forEach((m) => {
    const c = getCategory(m);
    counts[c] = (counts[c] || 0) + 1;
  });

  const handleCancel = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCancelling(id);
    await onCancel(id);
    setCancelling(null);
  };

  return (
    <div>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-800">
              All Movements
            </span>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
              {filtered.length}
            </span>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-gray-500 transition-colors hover:bg-gray-100 disabled:opacity-50"
          >
            <PiArrowClockwise
              className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`}
            />
            Refresh
          </button>
        </div>

        {/* Search */}
        <div className="border-b border-gray-100 px-4 py-2.5">
          <div className="relative">
            <PiMagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search by reference, reason, cashier…"
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-1.5 pl-8 pr-8 text-xs outline-none focus:border-gray-400 focus:bg-white"
            />
            {search && (
              <button
                type="button"
                onClick={() => handleSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <PiX className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-0.5 overflow-x-auto border-b border-gray-100 px-3 py-2">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleFilter(tab.id as any)}
              className={`flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                activeFilter === tab.id
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {tab.label}
              {(counts[tab.id] || 0) > 0 && (
                <span
                  className={`rounded-full px-1.5 py-px text-[9px] font-bold tabular-nums ${
                    activeFilter === tab.id
                      ? 'bg-white/20'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {counts[tab.id] ?? 0}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Body */}
        {isLoading ? (
          <div className="flex items-center justify-center py-14">
            <PiSpinner className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <PiPackage className="h-12 w-12 text-gray-200" />
            <p className="mt-3 text-sm font-medium text-gray-500">
              {movements.length === 0
                ? 'No movements recorded yet'
                : 'No movements match your filter'}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              {movements.length === 0
                ? 'Movements from POS sales, online orders, and manual adjustments will appear here'
                : 'Try clearing your search or selecting a different filter'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {paginated.map((m) => {
              const cat = getCategory(m);
              const style = getCatStyle(cat);
              const source = getSourceBadge(m);
              const orderRef = getOrderRef(m);
              const sizeName =
                typeof m.size === 'object' && m.size
                  ? m.size.displayName || m.size.size
                  : m.sizeName || null;
              const wh = getWarehouseInfo(m);
              const performer = m.performedBy
                ? m.performedBy.posName ||
                  `${m.performedBy.firstName || ''} ${m.performedBy.lastName || ''}`.trim() ||
                  m.performedBy.email
                : null;
              const canCancel = m.status !== 'cancelled' && cat !== 'sale';
              const isSelected = selected?._id === m._id;

              return (
                <div
                  key={m._id}
                  onClick={() => setSelected(isSelected ? null : m)}
                  className={`flex cursor-pointer items-start gap-3 px-4 py-3.5 transition-colors ${
                    isSelected
                      ? 'bg-gray-50 ring-1 ring-inset ring-gray-200'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  {/* Icon */}
                  <span
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${style.bg} ${style.text}`}
                  >
                    {style.icon}
                  </span>

                  {/* Content */}
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-medium text-gray-800">
                        {formatType(m.type)}
                      </span>
                      <span
                        className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${source.cls}`}
                      >
                        {source.icon}
                        {source.label}
                      </span>
                      {sizeName && (
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">
                          {sizeName}
                        </span>
                      )}
                      {wh && (
                        <span className="flex items-center gap-1 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">
                          <PiWarehouse className="h-3 w-3" />
                          {wh.kind === 'route'
                            ? `${wh.from} → ${wh.to}`
                            : wh.label}
                        </span>
                      )}
                      {orderRef && (
                        <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
                          <PiReceipt className="h-3 w-3" />
                          {orderRef}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
                      <span>{formatDate(m.createdAt)}</span>
                      {performer && <span>· {performer}</span>}
                    </div>
                    {(m.reason || m.notes) && (
                      <p className="max-w-xs truncate text-[11px] text-gray-400">
                        {m.reason || m.notes}
                      </p>
                    )}
                  </div>

                  {/* Right */}
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span
                      className={`text-sm font-bold tabular-nums ${getQtyColor(cat)}`}
                    >
                      {getQtySign(cat)}
                      {m.quantity}
                    </span>
                    {m.quantityBefore !== undefined &&
                      m.quantityAfter !== undefined && (
                        <span className="text-[10px] tabular-nums text-gray-400">
                          {m.quantityBefore}→{m.quantityAfter}
                        </span>
                      )}
                    <StatusBadge status={m.status} />
                    {canCancel && (
                      <button
                        type="button"
                        onClick={(e) => handleCancel(m._id, e)}
                        disabled={cancelling === m._id}
                        className="mt-0.5 rounded p-1 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
                        title="Cancel movement"
                      >
                        {cancelling === m._id ? (
                          <PiSpinner className="h-3 w-3 animate-spin" />
                        ) : (
                          <PiTrash className="h-3 w-3" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
            <span className="text-xs text-gray-400">
              {(page - 1) * ITEMS_PER_PAGE + 1}–
              {Math.min(page * ITEMS_PER_PAGE, filtered.length)} of{' '}
              {filtered.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-40"
              >
                Prev
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pn =
                  totalPages <= 5
                    ? i + 1
                    : i === 0
                      ? 1
                      : i === 4
                        ? totalPages
                        : page - 1 + i;
                return (
                  <button
                    key={pn}
                    type="button"
                    onClick={() => setPage(pn)}
                    className={`rounded px-2 py-1 text-xs font-medium ${page === pn ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                  >
                    {pn}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setSelected(null)}
        >
          <div
            className="flex h-[70vh] w-[70vw] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <MovementDetailPanel
              movement={selected}
              token={token}
              tenant={tenant}
              onClose={() => setSelected(null)}
              onRefresh={onRefresh}
            />
          </div>
        </div>
      )}
    </div>
  );
}
