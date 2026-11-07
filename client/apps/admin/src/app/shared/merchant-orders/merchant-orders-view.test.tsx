// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
const state = vi.hoisted(() => ({ role: 'tenant_owner', request: vi.fn() }));
vi.mock('@/hooks/use-authorization', () => ({
  useAuthorization: () => ({ role: state.role, user: { token: 'signed' } }),
}));
vi.mock('@/services/merchant-order.service', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('@/services/merchant-order.service')
  >()),
  merchantRequest: state.request,
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  state.role = 'tenant_owner';
});
const row = {
  _id: 'owned',
  order: 'parent',
  tenant: 'tenant',
  location: 'location',
  currency: 'NGN',
  state: 'pending',
  version: 1,
  lines: [
    {
      line: 'line',
      product: 'product',
      subproduct: 'sub',
      size: 'size',
      productName: 'Test bottle',
      quantity: 2,
      merchandiseMinor: 2000,
    },
  ],
  merchandiseMinor: 2000,
  shippingMinor: 0,
  taxMinor: 0,
  totalMinor: 2000,
  refundedMinor: 0,
  refundReservedMinor: 0,
  recipient: { fullName: 'Own recipient' },
};
async function view() {
  const imported = await import('./merchant-orders-view').catch(() => ({
    default: undefined,
  }));
  expect(imported.default).toBeTypeOf('function');
  const View = imported.default!;
  return render(<View />);
}
test('merchant queue shows own item and recipient and submits versioned acceptance', async () => {
  state.request.mockImplementation(
    async (_token: string, _path: string, method = 'GET') =>
      method === 'GET'
        ? { orders: [row] }
        : { order: { ...row, state: 'accepted', version: 2 } }
  );
  await view();
  await screen.findByText('Test bottle');
  expect(screen.getByText('Own recipient')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Accept order' }));
  await waitFor(() =>
    expect(state.request).toHaveBeenCalledWith(
      'signed',
      '/owned/actions',
      'POST',
      expect.objectContaining({
        action: 'accept',
        expectedVersion: 1,
        idempotencyKey: expect.any(String),
      })
    )
  );
});
test('customer role cannot fetch merchant operational records', async () => {
  state.role = 'customer';
  await view();
  expect(screen.getByRole('alert').textContent).toMatch(/staff|required/i);
  expect(state.request).not.toHaveBeenCalled();
});
test('uncertain network retry retains the exact merchant action key',async()=>{
 let attempts=0;
 state.request.mockImplementation(async(_token:string,_path:string,method='GET')=>{if(method==='GET')return{orders:[row]};attempts++;if(attempts===1)throw new Error('Temporary network failure');return{order:{...row,state:'accepted',version:2}};});
 await view();await screen.findByText('Test bottle');fireEvent.click(screen.getByRole('button',{name:'Accept order'}));await screen.findByText('Temporary network failure');
 fireEvent.click(screen.getByRole('button',{name:'Accept order'}));await waitFor(()=>expect(attempts).toBe(2));
 const writes=state.request.mock.calls.filter(call=>call[2]==='POST');expect(writes[0][3].idempotencyKey).toBe(writes[1][3].idempotencyKey);expect(writes[0][3].expectedVersion).toBe(1);
});

test('queue status and paging use matching server totals and make older work reachable',async()=>{
 state.request.mockImplementation(async(_token:string,path:string)=>path.includes('state=closed')?{orders:[{...row,_id:'closed',state:'delivered',lines:[{...row.lines[0],productName:'Completed bottle'}]}],total:1,page:1,pages:1,limit:25}:path.includes('page=2')?{orders:[{...row,_id:'older',lines:[{...row.lines[0],productName:'Older bottle'}]}],total:40,page:2,pages:2,limit:25}:{orders:[row],total:40,page:1,pages:2,limit:25});
 await view();await screen.findByText('Test bottle');
 expect(screen.getByText(/Page 1 of 2/)).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Next queue page'}));
 await screen.findByText('Older bottle');expect(screen.queryByText('Test bottle')).toBeNull();
 expect(state.request).toHaveBeenCalledWith('signed','?state=open&page=2&limit=25','GET',undefined,expect.any(AbortSignal));
 fireEvent.change(screen.getByLabelText('Queue status'),{target:{value:'closed'}});
 await screen.findByText('Completed bottle');expect(screen.getByText(/Page 1 of 1/)).toBeTruthy();
 expect(state.request).toHaveBeenCalledWith('signed','?state=closed&page=1&limit=25','GET',undefined,expect.any(AbortSignal));
});

test('old queue response cannot replace a newer status selection',async()=>{
 let resolveOpen!:(value:unknown)=>void;
 state.request.mockImplementation(async(_token:string,path:string)=>path.includes('state=closed')?{orders:[{...row,lines:[{...row.lines[0],productName:'Closed only'}]}],total:1,page:1,pages:1,limit:25}:new Promise(resolve=>{resolveOpen=resolve;}));
 await view();fireEvent.change(screen.getByLabelText('Queue status'),{target:{value:'closed'}});
 await screen.findByText('Closed only');resolveOpen({orders:[row],total:40,page:1,pages:2,limit:25});
 await waitFor(()=>expect(screen.queryByText('Test bottle')).toBeNull());
 expect(screen.getByText('Closed only')).toBeTruthy();
});

test('settlement statement renders inside refund review with recorded figures', async () => {
  const statement = {
    statementVersion: 1,
    readOnly: true,
    currency: 'NGN',
    scope: { childId: 'owned', orderId: 'order', tenantId: 'tenant' },
    totals: {
      grossMinor: 2000,
      discountMinor: 0,
      merchandiseMinor: 2000,
      tenantShareMinor: 1600,
      commissionMinor: 400,
      shippingMinor: 0,
      taxMinor: 0,
      totalMinor: 2000,
    },
    sources: { totals: 'merchant-order-immutable-v1' },
    refunds: {
      reservedMinor: 0,
      settledMinor: 0,
      settledCommissionMinor: 0,
      settledTenantShareMinor: 0,
      allocations: [],
    },
    commissionReversal: { settledMinor: 0, sourceIds: [] },
    goodsCost: {
      sourceId: null,
      originalCostMinor: 0,
      cancelledCostMinor: 0,
      netCostMinor: 0,
      sourceNote: 'No recorded goods cancellation.',
    },
    carrierCost: {
      sourceId: null,
      committedMinor: 0,
      reservedMinor: 0,
      journalExempt: true,
      sourceNote: 'No committed carrier spend.',
    },
    netReceivable: { settledMinor: 1600, reservedMinor: 0, projectedMinor: 1600 },
    journals: { sales: null, refunds: [], goodsCancellations: [] },
    reconciliation: { state: 'reconciled' },
    payout: {
      state: 'review_required',
      reason: 'No payout execution exists; payout policy requires review.',
    },
    set: {
      orderId: 'set',
      totals: { merchandiseMinor: 2000, settledMinor: 0, netReceivableMinor: 1600 },
    },
  };
  state.request.mockImplementation(async (_token: string, path: string) =>
    path.endsWith('/settlement-statement')
      ? { statement }
      : path.endsWith('/refunds')
        ? { refunds: [] }
        : { orders: [row] }
  );
  await view();
  await screen.findByText('Test bottle');
  fireEvent.click(
    screen.getByRole('button', { name: 'Review merchandise refunds' })
  );
  await screen.findByRole('region', { name: 'Merchant settlement statement' });
  expect(screen.getByText(/Reconciled/)).toBeTruthy();
  expect(
    screen.getByText(
      'No payout execution exists; payout policy requires review.'
    )
  ).toBeTruthy();
});

test('unit-based orders show unit refund controls and hide whole-order shipment and amount requests',async()=>{
 state.request.mockImplementation(async(_token:string,path:string)=>path.includes('/quantity/allocations')?{allocations:[],pagination:{hasMore:false,nextCursor:null}}:path.endsWith('/refunds')?{refunds:[{_id:'refund',merchantOrder:'owned',fulfillmentVersion:2,unitRanges:[{line:'line',ranges:[{start:0,quantity:1}]}],amountMinor:1000,currency:'NGN',reason:'Damaged item',state:'reserved'}]}:{orders:[{...row,state:'accepted',fulfillmentVersion:2,quantityProgress:[{line:'line',shipped:0,delivered:0,cancelled:0,financialBlocks:[]}]}]});
 await view();await screen.findByText('Test bottle');
 expect(screen.getByRole('button',{name:'Request unit refund'})).toBeTruthy();
 expect(screen.queryByRole('button',{name:'Ship order'})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Review merchandise refunds'}));
 await screen.findByText('Damaged item',{exact:false});
 expect(screen.queryByLabelText(/Merchandise refund amount/)).toBeNull();
 expect(screen.getByText(/Units 1.*Test bottle/)).toBeTruthy();
});
