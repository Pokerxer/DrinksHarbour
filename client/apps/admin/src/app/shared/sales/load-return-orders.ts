import { salesOrderService, type SalesOrder } from '@/services/salesOrder.service';

export async function loadReturnOrders(token: string): Promise<SalesOrder[]> {
  const groups = await Promise.all(['fulfilled', 'partially_fulfilled'].map(async status => {
    const orders: SalesOrder[] = [];
    let page = 1;
    while (true) {
      const response = await salesOrderService.list(token, {
        docType: 'order', status, page, limit: 100, includeReturns: '1',
      });
      orders.push(...(response.data || []));
      if (!response.pagination?.hasNextPage) break;
      page++;
    }
    return orders;
  }));
  return groups.flat();
}
