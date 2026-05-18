// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import {
  PiPlus, PiMinus, PiArrowsLeftRight, PiSliders, PiTrash,
  PiArrowClockwise, PiPackage, PiSpinner, PiStorefront,
  PiShoppingCart, PiWrench, PiReceipt, PiArrowCounterClockwise,
  PiX, PiMagnifyingGlass, PiUser, PiCurrencyNgn, PiTag,
  PiCalendar, PiArrowSquareOut,
} from 'react-icons/pi';
import type { InventoryMovement } from '@/services/inventory.service';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

interface ServerMovementsListProps {
  movements: InventoryMovement[];
  isLoading: boolean;
  onRefresh: () => void;
  onCancel: (id: string) => void;
}

const ITEMS_PER_PAGE = 15;
type CategoryFilter = 'all' | 'in' | 'out' | 'transfer' | 'adjustment' | 'sale' | 'return';

// ── Helpers ──────────────────────────────────────────────────────────────────

function getCategory(m: InventoryMovement): CategoryFilter {
  if (m.type === 'sold' || m.type === 'shipped') return 'sale';
  if (m.type === 'return' || m.type === 'return_in') return 'return';
  if (m.type === 'adjustment_in' || m.type === 'adjustment_out') return 'adjustment';
  if (m.category === 'in') return 'in';
  if (m.category === 'out') return 'out';
  if (m.category === 'transfer') return 'transfer';
  return 'in';
}

function getCatStyle(cat: CategoryFilter) {
  switch (cat) {
    case 'in':         return { bg: 'bg-green-100',  text: 'text-green-700',  icon: <PiPlus className="h-3.5 w-3.5" /> };
    case 'out':        return { bg: 'bg-red-100',    text: 'text-red-700',    icon: <PiMinus className="h-3.5 w-3.5" /> };
    case 'sale':       return { bg: 'bg-red-100',    text: 'text-red-700',    icon: <PiShoppingCart className="h-3.5 w-3.5" /> };
    case 'return':     return { bg: 'bg-amber-100',  text: 'text-amber-700',  icon: <PiArrowCounterClockwise className="h-3.5 w-3.5" /> };
    case 'transfer':   return { bg: 'bg-blue-100',   text: 'text-blue-700',   icon: <PiArrowsLeftRight className="h-3.5 w-3.5" /> };
    case 'adjustment': return { bg: 'bg-purple-100', text: 'text-purple-700', icon: <PiSliders className="h-3.5 w-3.5" /> };
    default:           return { bg: 'bg-gray-100',   text: 'text-gray-600',   icon: <PiPlus className="h-3.5 w-3.5" /> };
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
  const isPOS = m.source === 'order' || (m.notes && m.notes.toLowerCase().includes('pos'));
  const isOnline = !isPOS && m.relatedOrder && typeof m.relatedOrder === 'object';
  if (isPOS)     return { label: 'POS',    cls: 'bg-[#b20202]/10 text-[#b20202]',  icon: <PiStorefront className="h-2.5 w-2.5" /> };
  if (isOnline)  return { label: 'Online', cls: 'bg-blue-50 text-blue-700',         icon: <PiShoppingCart className="h-2.5 w-2.5" /> };
  if (m.source === 'api') return { label: 'API', cls: 'bg-gray-100 text-gray-600', icon: <PiWrench className="h-2.5 w-2.5" /> };
  return { label: 'Manual', cls: 'bg-gray-100 text-gray-500', icon: <PiWrench className="h-2.5 w-2.5" /> };
}

function getOrderRef(m: InventoryMovement): string | null {
  if (m.relatedOrder && typeof m.relatedOrder === 'object')
    return m.relatedOrder.receiptNumber || m.relatedOrder.orderNumber || null;
  return m.reference || null;
}

function getOrderId(m: InventoryMovement): string | null {
  if (m.relatedOrder && typeof m.relatedOrder === 'object') return m.relatedOrder._id;
  if (m.relatedOrder && typeof m.relatedOrder === 'string') return m.relatedOrder;
  return null;
}

function formatDate(d: string) {
  try {
    const dt = new Date(d);
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${dt.getDate().toString().padStart(2,'0')} ${months[dt.getMonth()]} ${dt.getFullYear()} · ${dt.getHours().toString().padStart(2,'0')}:${dt.getMinutes().toString().padStart(2,'0')}`;
  } catch { return d; }
}

function formatType(type: string) {
  return type?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || '';
}

function fmtMoney(n: number, sym = '₦') {
  return `${sym}${(n ?? 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function StatusBadge({ status }: { status: string }) {
  const cls = status === 'confirmed' ? 'bg-green-100 text-green-700'
            : status === 'pending'   ? 'bg-amber-100 text-amber-700'
            : status === 'cancelled' ? 'bg-gray-100 text-gray-500 line-through'
            : 'bg-gray-100 text-gray-500';
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${cls}`}>{status}</span>;
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

// ── Movement Detail Panel ────────────────────────────────────────────────────

function MovementDetailPanel({
  movement,
  token,
  onClose,
}: {
  movement: InventoryMovement;
  token?: string;
  onClose: () => void;
}) {
  const [order, setOrder] = useState<any>(null);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [orderErr, setOrderErr] = useState<string | null>(null);
  const [orderType, setOrderType] = useState<'pos'|'online'|'purchase'|'none'>('none');
  const [tab, setTab] = useState<'movement' | 'order'>('order');

  const orderId = getOrderId(movement);
  // PO id
  const poId = movement.relatedPurchaseOrder
    ? (typeof movement.relatedPurchaseOrder === 'object' ? movement.relatedPurchaseOrder._id : movement.relatedPurchaseOrder)
    : null;
  // Receipt number fallback (for POS movements where relatedOrder wasn't back-linked)
  const isPOSMovement = movement.source === 'order' || (movement.notes || '').toLowerCase().includes('pos');
  const receiptRef = isPOSMovement && !orderId ? (movement.reference || null) : null;

  const cat = getCategory(movement);
  const style = getCatStyle(cat);
  const source = getSourceBadge(movement);
  const sizeName = (typeof movement.size === 'object' && movement.size)
    ? (movement.size.displayName || movement.size.size)
    : (movement.sizeName || null);
  const performer = movement.performedBy
    ? (movement.performedBy.posName || `${movement.performedBy.firstName || ''} ${movement.performedBy.lastName || ''}`.trim() || movement.performedBy.email)
    : null;

  // Determine fetch strategy and load
  useEffect(() => {
    if (!token) { setTab('movement'); return; }
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

    if (!url) { setTab('movement'); setLoadingOrder(false); return; }

    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        const doc = data.data?.order || data.data?.purchaseOrder || data.data || data.order || null;
        setOrder(doc);
        if (poId) setOrderType('purchase');
        else if (doc?.source === 'pos') setOrderType('pos');
        else if (doc) setOrderType('online');
        else { setTab('movement'); setOrderType('none'); }
      })
      .catch(e => { setOrderErr(e.message || 'Could not load details'); setTab('movement'); })
      .finally(() => setLoadingOrder(false));
  }, [orderId, poId, receiptRef, token]);

  const isPOS      = orderType === 'pos';
  const isOnline   = orderType === 'online';
  const isPurchase = orderType === 'purchase';
  const orderLabel = isPOS ? 'POS Sale' : isOnline ? 'Online Order' : isPurchase ? 'Purchase Order' : 'Order';

  const customer  = order?.customer;
  const staff     = order?.posStaff;
  const staffName = staff ? (staff.posName || `${staff.firstName || ''} ${staff.lastName || ''}`.trim()) : null;
  const splits    = order?.paymentDetails?.splitPayments || [];
  const change    = order?.paymentDetails?.change || 0;

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${style.bg} ${style.text}`}>
            {style.icon}
          </span>
          <div>
            <p className="text-sm font-semibold text-gray-900">{formatType(movement.type)}</p>
            <p className="text-[10px] text-gray-400">{formatDate(movement.createdAt)}</p>
          </div>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
          <PiX className="h-4 w-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 text-xs font-semibold">
        {(orderId || poId || receiptRef) && (
          <button type="button" onClick={() => setTab('order')}
            className={`flex-1 py-2.5 transition-colors ${tab === 'order' ? 'border-b-2 border-[#b20202] text-[#b20202]' : 'text-gray-400 hover:text-gray-600'}`}>
            {orderLabel}
          </button>
        )}
        <button type="button" onClick={() => setTab('movement')}
          className={`flex-1 py-2.5 transition-colors ${tab === 'movement' ? 'border-b-2 border-[#b20202] text-[#b20202]' : 'text-gray-400 hover:text-gray-600'}`}>
          Movement
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">

        {/* ── Order / Invoice tab ── */}
        {tab === 'order' && (
          <div className="p-4 space-y-4">
            {loadingOrder ? (
              <div className="flex items-center justify-center gap-2 py-8 text-xs text-gray-400">
                <PiSpinner className="h-5 w-5 animate-spin" /> Loading order…
              </div>
            ) : orderErr ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-700">{orderErr}</div>
            ) : order ? (<>

              {/* Invoice header */}
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-base font-bold text-gray-900">
                      {order.receiptNumber || order.orderNumber}
                    </p>
                    <p className="text-xs text-gray-500">{formatDate(order.placedAt || order.createdAt)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      order.paymentStatus === 'paid'             ? 'bg-green-100 text-green-700' :
                      order.isVoided                             ? 'bg-gray-100 text-gray-500'   :
                      order.paymentStatus === 'refunded'         ? 'bg-amber-100 text-amber-700' :
                      order.paymentStatus === 'partially_refunded' ? 'bg-orange-100 text-orange-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>{order.isVoided ? 'Voided' : (order.paymentStatus || order.status)}</span>
                    <span className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${source.cls}`}>
                      {source.icon}{source.label}
                    </span>
                  </div>
                </div>

                {/* Customer */}
                {customer && (customer.firstName !== 'Walk-in' || customer.phone) ? (
                  <div className="flex items-center gap-2 text-xs text-gray-600 pt-1 border-t border-gray-200">
                    <PiUser className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                    <span>
                      {customer.firstName} {customer.lastName || ''}
                      {customer.phone && <span className="text-gray-400"> · {customer.phone}</span>}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-gray-400 pt-1 border-t border-gray-200">
                    <PiUser className="h-3.5 w-3.5 shrink-0" /> Walk-in Customer
                  </div>
                )}

                {/* Cashier */}
                {staffName && (
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <PiTag className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                    Cashier: <span className="font-medium text-gray-700">{staffName}</span>
                  </div>
                )}
              </div>

              {/* Items */}
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Items Ordered</p>
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  {/* Column headers */}
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
                      <div key={i} className={`grid grid-cols-[1fr_auto_auto] gap-x-3 px-3 py-2.5 text-xs ${i < order.items.length - 1 ? 'border-b border-gray-100' : ''}`}>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-800 leading-snug">{productName}</p>
                          {sizeName2 && <p className="text-[10px] text-gray-400">{sizeName2}</p>}
                          <p className="text-[10px] text-gray-400 tabular-nums">@ {fmtMoney(unitPrice)}{disc > 0 && <span className="text-amber-600"> −{fmtMoney(disc)}</span>}</p>
                        </div>
                        <span className="text-right font-medium text-gray-600 tabular-nums self-start pt-0.5">{item.quantity}</span>
                        <span className="text-right font-semibold text-gray-800 tabular-nums self-start pt-0.5">{fmtMoney(lineTotal)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Totals */}
              <div className="rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                {(order.subtotal || 0) !== (order.totalAmount || 0) && (
                  <div className="flex justify-between px-3 py-2 text-xs text-gray-500">
                    <span>Subtotal</span>
                    <span className="tabular-nums">{fmtMoney(order.subtotal || 0)}</span>
                  </div>
                )}
                {(order.discountTotal || 0) > 0 && (
                  <div className="flex justify-between px-3 py-2 text-xs text-amber-700">
                    <span>Discount</span>
                    <span className="tabular-nums">−{fmtMoney(order.discountTotal)}</span>
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
                  <span className="tabular-nums">{fmtMoney(order.totalAmount || order.total || 0)}</span>
                </div>
              </div>

              {/* Payment */}
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Payment</p>
                <div className="rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                  {splits.length > 0 ? splits.map((sp: any, i: number) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2 text-xs">
                      <span className="capitalize text-gray-600">{sp.method?.replace(/_/g,' ')}</span>
                      <span className="tabular-nums font-medium text-gray-800">{fmtMoney(sp.amount)}</span>
                    </div>
                  )) : (
                    <div className="flex items-center justify-between px-3 py-2 text-xs">
                      <span className="capitalize text-gray-600">{(order.paymentMethod || '').replace(/_/g,' ')}</span>
                      <span className="tabular-nums font-medium text-gray-800">{fmtMoney(order.totalAmount || 0)}</span>
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
                  <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Returns / Refunds</p>
                  <div className="rounded-xl border border-amber-200 divide-y divide-amber-100 overflow-hidden">
                    {order.refunds.map((r: any, i: number) => (
                      <div key={i} className="px-3 py-2.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-700">{r.receiptNumber || `Return ${i+1}`}</span>
                          <span className="font-bold text-amber-700 tabular-nums">−{fmtMoney(r.totalRefunded)}</span>
                        </div>
                        {r.items?.map((ri: any, j: number) => (
                          <p key={j} className="text-[10px] text-gray-400 mt-0.5">
                            Item {ri.orderItemIndex + 1} · ×{ri.quantity} · {fmtMoney(ri.amount)}
                          </p>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </>) : isPurchase && order ? (
              /* ── Purchase Order view ── */
              <div className="space-y-4">
                {/* PO header */}
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-base font-bold text-gray-900">{order.poNumber || order._id}</p>
                      <p className="text-xs text-gray-500">{formatDate(order.placedAt || order.createdAt)}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider capitalize ${
                      order.status === 'received' ? 'bg-green-100 text-green-700' :
                      order.status === 'approved' ? 'bg-blue-100 text-blue-700' :
                      order.status === 'pending'  ? 'bg-amber-100 text-amber-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>{order.status}</span>
                  </div>
                  {order.vendor && (
                    <div className="flex items-center gap-2 text-xs text-gray-600 pt-1 border-t border-gray-200">
                      <PiStorefront className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                      {order.vendor.name || 'Vendor'}
                      {order.vendor.email && <span className="text-gray-400">· {order.vendor.email}</span>}
                    </div>
                  )}
                  {order.createdBy && (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <PiUser className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                      Created by: <span className="font-medium text-gray-700">{order.createdBy.name || order.createdBy.email}</span>
                    </div>
                  )}
                </div>

                {/* PO items */}
                {order.items?.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Items Ordered</p>
                    <div className="rounded-xl border border-gray-200 overflow-hidden">
                      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 bg-gray-50 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                        <span>Product</span><span className="text-right">Size</span><span className="text-right">Qty</span><span className="text-right">Cost</span>
                      </div>
                      {order.items.map((item: any, i: number) => (
                        <div key={i} className={`grid grid-cols-[1fr_auto_auto_auto] gap-x-3 px-3 py-2.5 text-xs ${i < order.items.length-1 ? 'border-b border-gray-100' : ''}`}>
                          <p className="font-medium text-gray-800 truncate">{item.subProductId?.name || item.productName || 'Product'}</p>
                          <span className="text-right text-gray-500">{item.sizeId?.size || item.sizeName || '—'}</span>
                          <span className="text-right font-medium text-gray-700 tabular-nums">{item.quantity}</span>
                          <span className="text-right font-semibold text-gray-800 tabular-nums">{fmtMoney(item.unitCost || item.totalCost || 0)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* PO totals */}
                {(order.totalAmount || order.grandTotal) && (
                  <div className="rounded-xl border border-gray-200 overflow-hidden">
                    <div className="flex justify-between bg-gray-50 px-3 py-2.5 text-sm font-bold text-gray-900">
                      <span>Grand Total</span>
                      <span className="tabular-nums">{fmtMoney(order.totalAmount || order.grandTotal || 0)}</span>
                    </div>
                  </div>
                )}

                {/* Notes */}
                {order.notes && (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-xs text-gray-600">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Notes</p>
                    {order.notes}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <PiReceipt className="h-10 w-10 text-gray-200" />
                <p className="text-xs text-gray-400">
                  {orderErr ? orderErr : 'No order details available for this movement'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Movement tab ── */}
        {tab === 'movement' && (
          <div className="p-4 space-y-4">
            {/* Qty strip */}
            <div className="grid grid-cols-3 divide-x divide-gray-100 rounded-xl border border-gray-200 bg-gray-50">
              {[
                { label: 'Qty',    value: <span className={`text-xl font-bold tabular-nums ${getQtyColor(cat)}`}>{getQtySign(cat)}{movement.quantity}</span> },
                { label: 'Before', value: <span className="text-xl font-bold tabular-nums text-gray-700">{movement.quantityBefore ?? '—'}</span> },
                { label: 'After',  value: <span className="text-xl font-bold tabular-nums text-gray-700">{movement.quantityAfter  ?? '—'}</span> },
              ].map(({ label, value }) => (
                <div key={label} className="px-3 py-3 text-center">
                  <p className="mb-1 text-[10px] uppercase tracking-wider text-gray-400">{label}</p>
                  {value}
                </div>
              ))}
            </div>

            {/* Fields */}
            <div className="rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
              {[
                { label: 'Status',    value: <StatusBadge status={movement.status} /> },
                { label: 'Source',    value: <span className={`flex w-fit items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${source.cls}`}>{source.icon}{source.label}</span> },
                sizeName            && { label: 'Size',      value: sizeName },
                getOrderRef(movement) && { label: 'Reference', value: getOrderRef(movement) },
                performer           && { label: 'By',        value: performer },
                movement.supplierName && { label: 'Supplier',  value: movement.supplierName },
                movement.unitCost   && { label: 'Unit Cost', value: fmtMoney(movement.unitCost) },
                (movement.reason || movement.notes) && { label: 'Reason', value: movement.reason || movement.notes },
              ].filter(Boolean).map(({ label, value }: any) => (
                <div key={label} className="flex items-start gap-3 px-3 py-2.5">
                  <span className="w-20 shrink-0 text-[11px] text-gray-400">{label}</span>
                  <span className="text-[11px] font-medium text-gray-700 break-words">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function ServerMovementsList({ movements, isLoading, onRefresh, onCancel }: ServerMovementsListProps) {
  const { data: session } = useSession();
  const token = session?.user?.token as string | undefined;

  const [activeFilter, setActiveFilter] = useState<CategoryFilter | 'all'>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<InventoryMovement | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const filtered = movements.filter(m => {
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
      if (!ref.toLowerCase().includes(q) && !type.includes(q) && !reason.includes(q) && !notes.includes(q) && !performer.includes(q)) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const handleFilter = (f: CategoryFilter | 'all') => { setActiveFilter(f); setPage(1); };
  const handleSearch = (v: string) => { setSearch(v); setPage(1); };

  const counts: Record<string, number> = { all: movements.length };
  movements.forEach(m => { const c = getCategory(m); counts[c] = (counts[c] || 0) + 1; });

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
            <span className="text-sm font-semibold text-gray-800">All Movements</span>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">{filtered.length}</span>
          </div>
          <button type="button" onClick={onRefresh} disabled={isLoading}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-50 transition-colors">
            <PiArrowClockwise className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Search */}
        <div className="border-b border-gray-100 px-4 py-2.5">
          <div className="relative">
            <PiMagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input type="text" value={search} onChange={e => handleSearch(e.target.value)}
              placeholder="Search by reference, reason, cashier…"
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-1.5 pl-8 pr-8 text-xs outline-none focus:border-gray-400 focus:bg-white" />
            {search && (
              <button type="button" onClick={() => handleSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <PiX className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-0.5 overflow-x-auto border-b border-gray-100 px-3 py-2">
          {FILTER_TABS.map(tab => (
            <button key={tab.id} type="button" onClick={() => handleFilter(tab.id as any)}
              className={`flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                activeFilter === tab.id ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'
              }`}>
              {tab.label}
              {(counts[tab.id] || 0) > 0 && (
                <span className={`rounded-full px-1.5 py-px text-[9px] font-bold tabular-nums ${
                  activeFilter === tab.id ? 'bg-white/20' : 'bg-gray-200 text-gray-600'
                }`}>{counts[tab.id] ?? 0}</span>
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
              {movements.length === 0 ? 'No movements recorded yet' : 'No movements match your filter'}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              {movements.length === 0
                ? 'Movements from POS sales, online orders, and manual adjustments will appear here'
                : 'Try clearing your search or selecting a different filter'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {paginated.map(m => {
              const cat = getCategory(m);
              const style = getCatStyle(cat);
              const source = getSourceBadge(m);
              const orderRef = getOrderRef(m);
              const sizeName = (typeof m.size === 'object' && m.size) ? (m.size.displayName || m.size.size) : (m.sizeName || null);
              const performer = m.performedBy
                ? (m.performedBy.posName || `${m.performedBy.firstName || ''} ${m.performedBy.lastName || ''}`.trim() || m.performedBy.email)
                : null;
              const canCancel = m.status !== 'cancelled' && cat !== 'sale';
              const isSelected = selected?._id === m._id;

              return (
                <div
                  key={m._id}
                  onClick={() => setSelected(isSelected ? null : m)}
                  className={`flex cursor-pointer items-start gap-3 px-4 py-3.5 transition-colors ${
                    isSelected ? 'bg-gray-50 ring-1 ring-inset ring-gray-200' : 'hover:bg-gray-50'
                  }`}
                >
                  {/* Icon */}
                  <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${style.bg} ${style.text}`}>
                    {style.icon}
                  </span>

                  {/* Content */}
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-medium text-gray-800">{formatType(m.type)}</span>
                      <span className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${source.cls}`}>
                        {source.icon}{source.label}
                      </span>
                      {sizeName && <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">{sizeName}</span>}
                      {orderRef && (
                        <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
                          <PiReceipt className="h-3 w-3" />{orderRef}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
                      <span>{formatDate(m.createdAt)}</span>
                      {performer && <span>· {performer}</span>}
                    </div>
                    {(m.reason || m.notes) && (
                      <p className="text-[11px] text-gray-400 truncate max-w-xs">{m.reason || m.notes}</p>
                    )}
                  </div>

                  {/* Right */}
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className={`text-sm font-bold tabular-nums ${getQtyColor(cat)}`}>
                      {getQtySign(cat)}{m.quantity}
                    </span>
                    {m.quantityBefore !== undefined && m.quantityAfter !== undefined && (
                      <span className="text-[10px] text-gray-400 tabular-nums">{m.quantityBefore}→{m.quantityAfter}</span>
                    )}
                    <StatusBadge status={m.status} />
                    {canCancel && (
                      <button type="button" onClick={e => handleCancel(m._id, e)}
                        disabled={cancelling === m._id}
                        className="mt-0.5 rounded p-1 text-gray-300 hover:bg-red-50 hover:text-red-500 disabled:opacity-40 transition-colors" title="Cancel movement">
                        {cancelling === m._id ? <PiSpinner className="h-3 w-3 animate-spin" /> : <PiTrash className="h-3 w-3" />}
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
              {(page-1)*ITEMS_PER_PAGE+1}–{Math.min(page*ITEMS_PER_PAGE, filtered.length)} of {filtered.length}
            </span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1}
                className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-40">Prev</button>
              {Array.from({length: Math.min(5, totalPages)}, (_,i) => {
                const pn = totalPages<=5 ? i+1 : i===0 ? 1 : i===4 ? totalPages : page-1+i;
                return (
                  <button key={pn} type="button" onClick={() => setPage(pn)}
                    className={`rounded px-2 py-1 text-xs font-medium ${page===pn ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                    {pn}
                  </button>
                );
              })}
              <button type="button" onClick={() => setPage(p => Math.min(totalPages,p+1))} disabled={page===totalPages}
                className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Full-screen modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => setSelected(null)}>
          <div className="w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col"
            onClick={e => e.stopPropagation()}>
            <MovementDetailPanel movement={selected} token={token} onClose={() => setSelected(null)} />
          </div>
        </div>
      )}
    </div>
  );
}
