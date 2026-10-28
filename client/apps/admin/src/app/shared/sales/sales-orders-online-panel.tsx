// client/apps/admin/src/app/shared/sales/sales-orders-online-panel.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { PiStorefrontBold } from 'react-icons/pi';
import {
  orderService,
  type Order,
} from '@/services/order.service';
import { routes } from '@/config/routes';

// Marketplace orders that still need this tenant's hands. POS orders belong
// to the till, and delivered/cancelled/refunded need no fulfilment.
const OPEN_STATUSES = new Set(['pending', 'confirmed', 'processing', 'shipped']);
const PAGE_SIZE = 8;

function fmtNaira(n: number) {
  return `₦${(n ?? 0).toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
}

function lineLabel(item: Order['items'][number]) {
  return (
    item.productName ||
    item.product?.name ||
    item.subproduct?.name ||
    'Item'
  );
}

function customerOf(order: Order) {
  const fromUser = `${order.user?.firstName ?? ''} ${order.user?.lastName ?? ''}`.trim();
  return (
    fromUser ||
    order.shippingAddress?.fullName ||
    `${order.customer?.firstName ?? ''} ${order.customer?.lastName ?? ''}`.trim() ||
    order.customer?.email ||
    'Customer'
  );
}

function needsFulfilment(order: Order) {
  if (order.isVoided) return false;
  if (order.source && order.source !== 'web') return false;
  if (!OPEN_STATUSES.has(order.status)) return false;
  const paidOrCollectable =
    order.paymentStatus === 'paid' || order.paymentMethod === 'cash_on_delivery';
  return paidOrCollectable;
}

export default function SalesOrdersOnlinePanel() {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string } | undefined)?.token ?? '';
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await orderService.getOrders(
          token,
          // The server scopes this list to the tenant's own lines already
          // (getAllOrders → items.tenant); we only pick the web slice.
          { source: 'web', sort: 'placedAt', order: 'desc', limit: 50, page: 1 },
          signal
        );
        setOrders(res.orders.filter(needsFulfilment).slice(0, PAGE_SIZE));
        setError('');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load online orders');
      } finally {
        if (!signal) setLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    // A management surface, not a live terminal: refetch when the user comes
    // back to the tab. The POS popup + bell cover the live path.
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => {
      controller.abort();
      window.removeEventListener('focus', onFocus);
    };
  }, [load]);

  async function fulfil(order: Order, status: 'shipped' | 'delivered') {
    setActingId(order._id);
    try {
      await orderService.updateStatus(token, order._id, status);
      toast.success(`Order #${order.orderNumber} marked ${status}`);
      setOrders((prev) =>
        status === 'delivered' ? prev.filter((o) => o._id !== order._id) : prev
      );
      if (status === 'shipped') load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update the order');
    } finally {
      setActingId(null);
    }
  }

  if (loading) {
    return (
      <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
        <p className="text-sm font-semibold text-gray-500">Online orders…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (!orders.length) return null;

  return (
    <section className="mb-4 overflow-hidden rounded-xl border border-gray-200 bg-white">
      <header className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
        <div className="flex items-center gap-2">
          <PiStorefrontBold className="text-[#b20202]" size={18} />
          <h2 className="text-sm font-semibold text-gray-900">
            Online orders to fulfil
          </h2>
          <span className="rounded-full bg-[#b20202]/10 px-2 py-0.5 text-xs font-bold text-[#b20202]">
            {orders.length}
          </span>
        </div>
        <Link
          href={routes.eCommerce.orders}
          className="text-xs font-medium text-gray-500 hover:text-gray-800"
        >
          View all orders →
        </Link>
      </header>

      <ul className="divide-y divide-gray-100">
        {orders.map((order) => (
          <li
            key={order._id}
            className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <Link
                  href={routes.eCommerce.orderDetails(order._id)}
                  className="font-mono text-xs font-semibold text-gray-900 hover:underline"
                >
                  #{order.orderNumber}
                </Link>
                <span className="text-xs text-gray-400">{customerOf(order)}</span>
              </div>
              <p className="mt-0.5 truncate text-xs text-gray-500">
                {order.items
                  .slice(0, 4)
                  .map((i) => `${i.quantity}× ${lineLabel(i)}`)
                  .join(' · ')}
                {order.items.length > 4 ? ' …' : ''}
              </p>
              <p className="mt-0.5 text-[11px] uppercase tracking-wide text-gray-400">
                {order.paymentStatus === 'paid' ? 'Paid' : 'Cash on delivery'}
                {order.fulfillmentStatus ? ' · partially fulfilled' : ''}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="text-sm font-bold text-gray-900">
                {fmtNaira(order.totalAmount)}
              </span>
              <button
                type="button"
                disabled={actingId === order._id}
                onClick={() => fulfil(order, 'shipped')}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Mark shipped
              </button>
              <button
                type="button"
                disabled={actingId === order._id}
                onClick={() => fulfil(order, 'delivered')}
                className="rounded-lg bg-[#b20202] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#8f0202] disabled:opacity-50"
              >
                Mark delivered
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
