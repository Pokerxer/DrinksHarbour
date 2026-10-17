import {
  salesOrderService,
  type SalesOrder,
} from '@/services/salesOrder.service';

export async function loadFulfillmentOrders(
  token: string
): Promise<SalesOrder[]> {
  const groups = await Promise.all(
    ['confirmed', 'partially_fulfilled'].map(async (status) => {
      const orders: SalesOrder[] = [];
      let page = 1;
      while (true) {
        const response = await salesOrderService.list(token, {
          docType: 'order',
          status,
          page,
          limit: 100,
          includeReturns: '1',
        });
        orders.push(...(response.data || []));
        if (!response.pagination?.hasNextPage) break;
        if (!response.data?.length)
          throw new Error('Delivery results are incomplete. Try refreshing.');
        page++;
      }
      return orders;
    })
  );
  return Array.from(
    new Map(groups.flat().map((order) => [order._id, order])).values()
  );
}
