import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { posApi } from '@/app/shared/point-of-sale/api';
import {
  usePOSAuth,
  usePOSCart,
  usePOSUI,
} from '@/app/shared/point-of-sale/store';
import type { CartTableBinding, POSCartItem } from '../types';
import type { CartCustomer } from '../store/cart-types';
import { useOnlineStatus } from '../offline/use-online-status';

type ReparkState = {
  token?: string | null;
  items: POSCartItem[];
  customer: Pick<
    CartCustomer,
    'customerId' | 'firstName' | 'lastName' | 'email' | 'phone'
  >;
  note: string;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  binding: CartTableBinding | null;
};

/**
 * Guard + request body for re-parking a bound cart onto its held tab.
 * Returns null when there is nothing legitimate to park: no token, no
 * binding, a legacy persisted binding without a held order id, or an empty
 * cart (an emptied cart must not wipe the party's server-side tab).
 */
export function reparkRequest(state: ReparkState) {
  if (!state.token || !state.binding?.heldOrderId || state.items.length === 0)
    return null;
  const { customerId, firstName, lastName, email, phone } = state.customer;
  return {
    token: state.token,
    heldOrderId: state.binding.heldOrderId,
    body: {
      items: state.items,
      customer: {
        ...(customerId ? { customerId } : {}),
        firstName,
        lastName,
        email,
        phone,
      },
      note: state.note,
      discountType: state.discountType,
      discountValue: state.discountValue,
    },
  };
}

/** Last-parked fingerprint: heldOrderId|subProduct:size:qty:price…|note|discount */
export function reparkSignature(req: NonNullable<ReturnType<typeof reparkRequest>>) {
  return [
    req.heldOrderId,
    ...req.body.items.map((i) =>
      [i.subProductId, i.sizeId ?? '', i.quantity, i.price].join(':')
    ),
    req.body.note,
    req.body.discountType,
    req.body.discountValue,
  ].join('|');
}

/**
 * Auto-repark: when the cashier leaves the sell screen with a table-bound cart,
 * push the current lines onto the tab's held order so the floor map and any
 * other terminal stay current — without the cashier ever pressing "hold".
 *
 * Fires on transitions away from the 'sell' view and on unmount while on it
 * (which covers lock-screen and other-route navigation). Leaving from the
 * payment/receipt views does not repark; those views cannot edit cart lines,
 * so the sell→payment park is already current — and after settlement the hold
 * no longer exists, so a late repark would only produce a spurious error.
 *
 * Online-only by design: offline the server-side tab simply keeps its last
 * parked state until the next online transition.
 */
export default function useTabAutoRepark() {
  const { activeView } = usePOSUI();
  const { token } = usePOSAuth();
  const { items, customer, note, discountType, discountValue, tableBinding } =
    usePOSCart();
  const isOnline = useOnlineStatus();

  // Cleanup reads these without the effect being keyed on cart state — a
  // cart-keyed effect would fire a repark on every keystroke.
  const live = useRef<ReparkState & { isOnline: boolean }>({
    token,
    items,
    customer,
    note,
    discountType,
    discountValue,
    binding: tableBinding,
    isOnline,
  });
  live.current = {
    token,
    items,
    customer,
    note,
    discountType,
    discountValue,
    binding: tableBinding,
    isOnline,
  };

  const lastPark = useRef('');

  useEffect(() => {
    if (activeView !== 'sell') return undefined;
    return () => {
      const req = reparkRequest(live.current);
      if (!req || !live.current.isOnline) return;
      const signature = reparkSignature(req);
      if (signature === lastPark.current) return;
      lastPark.current = signature;
      posApi.updateTableTab(req.token, req.heldOrderId, req.body).catch(() => {
        // Un-mark so the next transition retries instead of skipping.
        lastPark.current = '';
        toast.error('Could not save table tab changes');
      });
    };
  }, [activeView]);
}
