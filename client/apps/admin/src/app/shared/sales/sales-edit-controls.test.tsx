// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import {
  salesOrderService,
  type SalesOrder,
} from '@/services/salesOrder.service';
import SalesEditControls from './sales-edit-controls';
import SalesEditDelivery from './sales-edit-delivery';
const doc = (patch: Partial<SalesOrder> = {}): SalesOrder =>
  ({
    _id: 'sale',
    soNumber: 'SO1',
    docType: 'order',
    orderStatus: 'draft',
    paymentStatus: 'unpaid',
    items: [
      {
        _id: 'line',
        name: 'Wine',
        lineType: 'product',
        quantity: 10,
        fulfilledQty: 6,
        returnedQty: 4,
      },
    ],
    fulfillments: [],
    ...patch,
  }) as SalesOrder;
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it('requires cancellation confirmation, discards dirty state only on success, and updates the document', async () => {
  const original = doc({ items: [] });
  const cancel = vi
    .spyOn(salesOrderService, 'cancel')
    .mockResolvedValue({
      success: true,
      data: { ...original, orderStatus: 'cancelled' },
    });
  const changed = vi.fn();
  render(
    <SalesEditControls
      so={original}
      token="token"
      disabled={false}
      beforeLock={async () => true}
      onChanged={changed}
      onBusyChange={() => {}}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Cancel order' }));
  expect(cancel).not.toHaveBeenCalled();
  expect(screen.getByRole('alertdialog')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Confirm cancellation' }));
  await waitFor(() =>
    expect(changed).toHaveBeenCalledWith(
      expect.objectContaining({ orderStatus: 'cancelled' }),
    ),
  );
  expect(cancel).toHaveBeenCalledTimes(1);
});

it('locking stops when saving pending edits fails and reports the error', async () => {
  const lock = vi.spyOn(salesOrderService, 'setLocked');
  render(
    <SalesEditControls
      so={doc({ items: [] })}
      token="token"
      disabled={false}
      beforeLock={async () => false}
      onChanged={() => {}}
      onBusyChange={() => {}}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Lock' }));
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toMatch(/save/i),
  );
  expect(lock).not.toHaveBeenCalled();
});

it('failed cancellation leaves the saved document intact and allows retry', async () => {
  vi.spyOn(salesOrderService, 'cancel').mockRejectedValue(
    new Error('Payment recorded elsewhere'),
  );
  const changed = vi.fn();
  render(
    <SalesEditControls
      so={doc({ items: [] })}
      token="token"
      disabled={false}
      beforeLock={async () => true}
      onChanged={changed}
      onBusyChange={() => {}}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Cancel order' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm cancellation' }));
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toContain(
      'Payment recorded elsewhere',
    ),
  );
  expect(changed).not.toHaveBeenCalled();
});

it('locked partly delivered orders can open delivery, retain gross quantities and expose unlock', () => {
  const original = doc({
    locked: true,
    orderStatus: 'partially_fulfilled',
    paymentStatus: 'partial',
    fulfillments: [
      {
        _id: 'f',
        ref: 'RCP1',
        at: '2026-10-15',
        status: 'done',
        items: [{ lineId: 'line', qty: 6 }],
      },
    ],
  });
  render(
    <>
      <SalesEditControls
        so={original}
        token="token"
        disabled={false}
        beforeLock={async () => true}
        onChanged={() => {}}
        onBusyChange={() => {}}
      />
      <SalesEditDelivery so={original} disabled={false} />
    </>,
  );
  expect(screen.getByRole('button', { name: 'Unlock' })).toBeTruthy();
  expect(
    (screen.getByRole('button', { name: 'Cancel order' }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  expect(
    screen
      .getByRole('link', { name: 'Deliver remaining items' })
      .getAttribute('href'),
  ).toBe('/sales/fulfill/sale');
  expect(
    screen.getByRole('table', { name: 'Delivery quantities' }).textContent,
  ).toMatch(/Wine1064/);
  expect(screen.getByText('RCP1')).toBeTruthy();
});

it('confirmation stops if saving edits fails and never opens a payment request', async () => {
  const reserve = vi.spyOn(salesOrderService, 'confirmReservation');
  const payment = vi.spyOn(salesOrderService, 'confirm');
  render(<SalesEditControls so={doc({items:[]})} token="token" disabled={false}
    beforeLock={async()=>false} onChanged={()=>{}} onBusyChange={()=>{}} />);
  fireEvent.click(screen.getByRole('button',{name:'Confirm'}));
  await waitFor(()=>expect(screen.getByRole('alert').textContent).toMatch(/save/i));
  expect(reserve).not.toHaveBeenCalled();expect(payment).not.toHaveBeenCalled();
});
it('confirmation reserves without payment and a locked order can check availability', async () => {
  const original=doc({items:[]});
  const confirmed={...original,orderStatus:'confirmed',reservationVersion:1} as SalesOrder;
  const reserve=vi.spyOn(salesOrderService,'confirmReservation').mockResolvedValue({success:true,data:confirmed});
  const payment=vi.spyOn(salesOrderService,'confirm');const changed=vi.fn();
  const view=render(<SalesEditControls so={original} token="token" disabled={false}
    beforeLock={async()=>true} onChanged={changed} onBusyChange={()=>{}} />);
  fireEvent.click(screen.getByRole('button',{name:'Confirm'}));
  await waitFor(()=>expect(changed).toHaveBeenCalledWith(confirmed));
  expect(reserve).toHaveBeenCalledTimes(1);expect(payment).not.toHaveBeenCalled();
  const topup=vi.spyOn(salesOrderService,'checkAvailability').mockResolvedValue({success:true,data:confirmed});
  view.rerender(<SalesEditControls so={{...confirmed,locked:true}} token="token" disabled={false}
    beforeLock={async()=>false} onChanged={changed} onBusyChange={()=>{}} />);
  fireEvent.click(screen.getByRole('button',{name:'Check availability'}));
  await waitFor(()=>expect(topup).toHaveBeenCalledTimes(1));
});

it('shows server-owned reserved and waiting amounts separately from remaining deliveries',()=>{
  const original=doc({reservationVersion:1,orderStatus:'partially_fulfilled'});
  original.items[0]={...original.items[0],reservedQty:3,waitingQty:1,reservations:[{warehouseId:'wh',warehouseName:'Main store',quantity:3}]};
  render(<SalesEditDelivery so={original} disabled={false}/>);
  const table=screen.getByRole('table',{name:'Delivery quantities'});
  expect(table.textContent).toContain('ReservedWaiting');
  expect(table.textContent).toContain('Main store: 3');
  expect(screen.getByRole('cell',{name:'1'})).toBeTruthy();
});

it('a cancelled unshipped order no longer shows waiting delivery demand',()=>{
  const original=doc({reservationVersion:1,orderStatus:'cancelled',items:[{_id:'line',name:'Wine',quantity:10,fulfilledQty:0} as SalesOrder['items'][number]]});
  render(<SalesEditDelivery so={original} disabled={false}/>);
  expect(screen.getAllByRole('cell').map(cell=>cell.textContent)).toEqual(['10','0','10','0','0']);
});
