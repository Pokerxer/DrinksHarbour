// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useRef, useState } from 'react';
import { salesOrderService } from '@/services/salesOrder.service';
import { blankLine } from '../sales-create-pricing-helpers';
import type {DraftLine} from '../sales-line-types';
import { pricingSignature } from '../sales-repricing';
import { useSalesPricePreview } from './use-sales-price-preview';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
function useEditor(pricelistId: string, quantity: number) {
  const line = {
    ...blankLine(),
    key: 'one',
    subProductId: 'product',
    quantity,
  };
  const [lines, setLines] = useState([line]);
  const linesRef = useRef([line]);
  linesRef.current = [line];
  useSalesPricePreview({
    token: 'token',
    pricelistId,
    pricingSig: pricingSignature([line], pricelistId),
    linesRef,
    setLines,
    priceSeqRef: useRef(0),
    confirmedPricingSigRef: useRef(''),
  });
  return lines;
}
it('switching pricelist reprices immediately while quantity edits remain debounced', async () => {
  vi.useFakeTimers();
  const price = vi
    .spyOn(salesOrderService, 'priceLines')
    .mockResolvedValue({
      success: true,
      data: { items: [{ key: 'one', unitPrice: 900 }] },
    } as never);
  const { result, rerender } = renderHook(({ id, qty }) => useEditor(id, qty), {
    initialProps: { id: 'a', qty: 1 },
  });
  await act(() => vi.advanceTimersByTimeAsync(350));
  expect(result.current[0].baseUnitPrice).toBe(900);
  price.mockClear();
  rerender({ id: 'b', qty: 1 });
  await act(() => vi.advanceTimersByTimeAsync(0));
  expect(price).toHaveBeenCalledTimes(1);
  expect(price.mock.calls[0][0].pricelist).toBe('b');
  rerender({ id: 'b', qty: 2 });
  rerender({ id: 'b', qty: 3 });
  await act(() => vi.advanceTimersByTimeAsync(349));
  expect(price).toHaveBeenCalledTimes(1);
  await act(() => vi.advanceTimersByTimeAsync(1));
  expect(price).toHaveBeenCalledTimes(2);
  expect(price.mock.calls[1][0].items[0].quantity).toBe(3);
});

it('a slower response from the old pricelist cannot overwrite the selected price', async () => {
  vi.useFakeTimers();
  let oldResponse!: (value: never) => void;
  vi.spyOn(salesOrderService, 'priceLines')
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          oldResponse = resolve;
        })
    )
    .mockResolvedValue({
      success: true,
      data: { items: [{ key: 'one', unitPrice: 800 }] },
    } as never);
  const { result, rerender } = renderHook(({ id }) => useEditor(id, 1), {
    initialProps: { id: 'a' },
  });
  await act(() => vi.advanceTimersByTimeAsync(350));
  rerender({ id: 'b' });
  await act(() => vi.advanceTimersByTimeAsync(0));
  expect(result.current[0].baseUnitPrice).toBe(800);
  await act(async () => {
    oldResponse({
      success: true,
      data: { items: [{ key: 'one', unitPrice: 999 }] },
    } as never);
  });
  expect(result.current[0].baseUnitPrice).toBe(800);
});

it('manual-price preview includes discount inputs and retains server promotion metadata',async()=>{
 vi.useFakeTimers();const price=vi.spyOn(salesOrderService,'priceLines').mockResolvedValue({success:true,data:{items:[{key:'manual',unitPrice:999,promoDiscount:10.1,promoName:'Offer'}]}} as never);
 const {result}=renderHook(()=>{
   const [lines,setLines]=useState<DraftLine[]>([{...blankLine(),key:'manual',subProductId:'sp',quantity:2,baseUnitPrice:123.45,priceOverridden:true,discount:5,discountType:'percentage' as const}]);
   const linesRef=useRef(lines);linesRef.current=lines;
   useSalesPricePreview({token:'token',pricelistId:'',pricingSig:pricingSignature(lines,''),linesRef,setLines,priceSeqRef:useRef(0),confirmedPricingSigRef:useRef('')});return lines;
 });
 await act(()=>vi.advanceTimersByTimeAsync(350));
 expect(price).toHaveBeenCalledTimes(1);expect(price.mock.calls[0][0].items[0]).toMatchObject({discount:5,discountType:'percentage',priceOverridden:true});
 expect(result.current[0]).toMatchObject({baseUnitPrice:123.45,promoDiscount:10.1,promoName:'Offer'});
});
