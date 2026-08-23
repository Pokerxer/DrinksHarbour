import type { Order } from '@/services/order.service';

export interface ResolvedCustomer {
  name: string;
  email: string;
  phone: string;
  kind: 'web' | 'pos' | 'account' | 'unknown';
}

/** Customer identity lives in three different places depending on where the
 *  order came from: shippingAddress (web checkout), paymentDetails.customer
 *  (POS till) or the linked user account (signed-in checkout). Unlike the
 *  order-list variant, this keeps email/phone separate and tags the source so
 *  the detail page can badge "In-store" vs "Registered customer". */
export function resolveCustomer(order: Order): ResolvedCustomer {
  const addr = order.shippingAddress;
  const pos = order.paymentDetails?.customer;

  if (addr?.fullName || addr?.email || addr?.phone) {
    return {
      name:
        addr.fullName ||
        (order.user ? `${order.user.firstName} ${order.user.lastName}` : '—'),
      email: addr.email ?? order.user?.email ?? '',
      phone: addr.phone ?? '',
      kind: 'web',
    };
  }
  if (pos?.firstName || pos?.phone) {
    return {
      name:
        [pos.firstName, pos.lastName].filter(Boolean).join(' ') ||
        'Walk-in customer',
      email: '',
      phone: pos.phone ?? '',
      kind: 'pos',
    };
  }
  if (order.user) {
    return {
      name:
        `${order.user.firstName ?? ''} ${order.user.lastName ?? ''}`.trim() ||
        '—',
      email: order.user.email ?? '',
      phone: '',
      kind: 'account',
    };
  }
  return { name: '—', email: '', phone: '', kind: 'unknown' };
}
