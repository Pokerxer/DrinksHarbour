// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
const request = vi.hoisted(() => vi.fn());
vi.mock('@/services/merchant-order.service', async () => ({
  ...(await vi.importActual('@/services/merchant-order.service')),
  merchantRequest: request,
}));
afterEach(() => {
  cleanup();
  request.mockReset();
});
test('financial readiness displays exact accepted components and unresolved policy without an execution override', async () => {
  request.mockResolvedValue({
    readiness: {
      currency: 'NGN',
      merchandise: {
        availableMinor: 1001,
        reservable: true,
        executionEnabled: false,
        state: 'supported',
        reason: 'Original receipt determines money.',
      },
      shipping: {
        acceptedMinor: 301,
        state: 'review_required',
        reason: 'Shipping policy requires review.',
      },
      tax: {
        acceptedMinor: 71,
        state: 'review_required',
        reason: 'Tax policy requires review.',
      },
      payout: {
        state: 'review_required',
        reason: 'Payout approval remains separate.',
      },
      goods: {
        state: 'independent',
        reason: 'Physical receipt is independent.',
      },
      fullCancellationReady: false,
    },
  });
  const { default: View } = await import('./refund-readiness-panel');
  render(<View token="session" childId="own" version={2} />);
  expect(
    await screen.findByText('Shipping policy requires review.')
  ).toBeTruthy();
  expect(screen.getByText('Tax policy requires review.')).toBeTruthy();
  expect(screen.getByText('Payout approval remains separate.')).toBeTruthy();
  expect(screen.getByText(/₦3.01/)).toBeTruthy();
  expect(screen.getByText('Refund execution is disabled.')).toBeTruthy();
  expect(screen.queryByRole('button')).toBeNull();
  expect(request).toHaveBeenCalledWith(
    'session',
    '/own/refund-readiness',
    'GET',
    undefined,
    expect.any(AbortSignal)
  );
});
test('changing session or order hides a stale financial readiness response', async () => {
  let resolve: (v: unknown) => void = () => {};
  request
    .mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r;
        })
    )
    .mockResolvedValue({ readiness: null });
  const { default: View } = await import('./refund-readiness-panel');
  const rendered = render(<View token="first" childId="first" version={1} />);
  rendered.rerender(<View token="second" childId="second" version={1} />);
  resolve({
    readiness: {
      currency: 'NGN',
      merchandise: { reason: 'Private first-order reason' },
    },
  });
  await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
  expect(screen.queryByText('Private first-order reason')).toBeNull();
});
test('existing refund reconciliation accepts numeric original-provider evidence without client success or money fields',async()=>{
 const {fireEvent}=await import('@testing-library/react');
 request.mockImplementation((_token:string,path:string)=>Promise.resolve(path.endsWith('/refunds')?{refunds:[{_id:'refund',merchantOrder:'own',amountMinor:1001,currency:'NGN',reason:'Original refund',state:'uncertain'}]}:{readiness:null}));
 const {default:Panel}=await import('./merchant-refund-panel');
 const save=vi.fn(async()=>true);
 render(<Panel token="session" platform busy={false} save={save} row={{_id:'own',order:'parent',tenant:'tenant',location:'location',currency:'NGN',state:'accepted',version:1,lines:[],merchandiseMinor:1001,shippingMinor:0,taxMinor:0,totalMinor:1001,refundedMinor:0,refundReservedMinor:1001}}/>);
 fireEvent.click(screen.getByRole('button',{name:'Review merchandise refunds'}));
 const field=await screen.findByLabelText('Existing provider refund ID') as HTMLInputElement;
 fireEvent.change(field,{target:{value:'71'}});expect(field.checkValidity()).toBe(true);
 fireEvent.submit(field.closest('form')!);
 expect(save).toHaveBeenCalledWith('/own/refunds/refund/reconcile',{providerRefundId:'71'},'reconcile:refund:71');
});
