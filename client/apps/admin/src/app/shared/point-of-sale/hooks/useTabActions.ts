'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { posApi } from '@/app/shared/point-of-sale/api';
import {
  usePOSAuth,
  usePOSCart,
  usePOSTables,
} from '@/app/shared/point-of-sale/store';
import type {
  POSHoldOrder,
  POSRecallCart,
  POSTableSummary,
} from '@/app/shared/point-of-sale/types';
import { recallCartToItems } from '@/app/shared/point-of-sale/components/pos-recall-cart-lines';

/**
 * The held-orders list is the only read-only source of a tab's parked cart —
 * recall would consume it. The server includes holdMetadata on each row; older
 * deployments omit it, so every access tolerates its absence.
 */
export type HeldOrderWithCart = POSHoldOrder & {
  holdMetadata?: {
    cartItems?: POSRecallCart['items'];
    customer?: Partial<POSRecallCart['customer']>;
    discountType?: 'percent' | 'fixed';
    discountValue?: number;
  };
};

/** The hold entry backing a table's current tab, if the list still has it. */
export function findHeldTab(
  orders: HeldOrderWithCart[],
  tabId: string | null | undefined
): HeldOrderWithCart | undefined {
  if (!tabId) return undefined;
  return orders.find((o) => o._id === tabId);
}

/**
 * A tab snapshot rebuilt as recall-cart input — identical to what a manual
 * recall hands the cart, minus note/pricelist which tabs never stored.
 */
export function tabToRecallCart(
  snapshot: NonNullable<HeldOrderWithCart['holdMetadata']>
): POSRecallCart {
  return {
    items: snapshot.cartItems ?? [],
    customer: {
      firstName: snapshot.customer?.firstName ?? 'Walk-in',
      lastName: snapshot.customer?.lastName ?? 'Customer',
      email: snapshot.customer?.email ?? '',
      phone: snapshot.customer?.phone ?? '',
    },
    note: '',
    discountType: snapshot.discountType ?? 'percent',
    discountValue: snapshot.discountValue ?? 0,
    pricelistId: null,
  };
}

/**
 * Tab lifecycle actions shared by the floor strip and the kitchen panel:
 * opening a tab on a free table and loading an occupied table's tab into the
 * cart (with binding). Both bind the SAME way so whichever surface the
 * cashier uses leaves the cart in the same state.
 */
export function useTabActions() {
  const { token, terminal } = usePOSAuth();
  const { items, bindTable, addItem, clearCart } = usePOSCart();
  const { refresh } = usePOSTables();

  const [opening, setOpening] = useState(false);
  const [loadingTabId, setLoadingTabId] = useState<string | null>(null);

  async function openTabAndBind(table: POSTableSummary, guests?: number) {
    if (!token || opening) return;
    setOpening(true);
    try {
      const { tab } = await posApi.openTableTab(token, {
        tableId: table._id,
        guests,
        terminalType: terminal ?? 'retail',
      });
      bindTable({
        tableId: table._id,
        name: table.name,
        guests,
        heldOrderId: String(tab._id),
      });
      toast.success(`Tab opened on ${table.name}`);
      refresh(token);
    } catch (err: unknown) {
      // 409 (table taken elsewhere) surfaces the server's own message.
      toast.error(err instanceof Error ? err.message : 'Could not open the tab');
    } finally {
      setOpening(false);
    }
  }

  async function loadTabAndBind(table: POSTableSummary) {
    if (!token || !table.currentTabId || loadingTabId) return;
    if (
      items.length > 0 &&
      !window.confirm(`Replace current cart with ${table.name} tab?`)
    )
      return;
    setLoadingTabId(table._id);
    try {
      const data = await posApi.getHeldOrders(token);
      const entry = findHeldTab(
        data.orders as HeldOrderWithCart[],
        table.currentTabId
      );
      const snapshot = entry?.holdMetadata;
      if (!snapshot?.cartItems?.length) {
        toast.error(`${table.name} has no saved lines to load`);
        return;
      }
      clearCart();
      for (const line of recallCartToItems(tabToRecallCart(snapshot)))
        addItem(line);
      bindTable({
        tableId: table._id,
        name: table.name,
        guests: table.tab?.guests,
        heldOrderId: table.currentTabId,
      });
      toast.success(`${table.name} tab loaded`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not load the tab');
    } finally {
      setLoadingTabId(null);
    }
  }

  return { opening, loadingTabId, openTabAndBind, loadTabAndBind };
}
