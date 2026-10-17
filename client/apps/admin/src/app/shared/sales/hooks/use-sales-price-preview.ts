'use client';
import {
  useEffect,
  useRef,
  type Dispatch,
  type SetStateAction,
  type MutableRefObject,
} from 'react';
import { salesOrderService } from '@/services/salesOrder.service';
import type { DraftLine } from '../sales-line-table';

interface Options {
  token?: string | null;
  pricingSig: string;
  pricelistId: string;
  linesRef: MutableRefObject<DraftLine[]>;
  setLines: Dispatch<SetStateAction<DraftLine[]>>;
  priceSeqRef: MutableRefObject<number>;
  confirmedPricingSigRef: MutableRefObject<string>;
}
export function useSalesPricePreview({
  token,
  pricingSig,
  pricelistId,
  linesRef,
  setLines,
  priceSeqRef,
  confirmedPricingSigRef,
}: Options) {
  const previousPricelist = useRef(pricelistId);
  useEffect(() => {
    const switchedPricelist = previousPricelist.current !== pricelistId;
    previousPricelist.current = pricelistId;
    const seq = ++priceSeqRef.current;
    const alreadyPriced = pricingSig === confirmedPricingSigRef.current;
    confirmedPricingSigRef.current = '';
    if (!token || !pricingSig || alreadyPriced) return;
    let cancelled = false;
    const t = setTimeout(
      async () => {
        if (seq !== priceSeqRef.current) return;
        try {
          const items = linesRef.current
            .filter(
              (l) =>
                l.lineType === 'product' && l.subProductId
            )
            .map((l) => ({
              key: l.key,
              subproduct: l.subProductId,
              size: l.sizeId,
              quantity: l.quantity,
              unitPrice: l.baseUnitPrice,
              priceOverridden: l.priceOverridden,
              discount:l.discount,discountType:l.discountType,taxRate:l.taxRate,
            }));
          if (!items.length) return;
          const res = await salesOrderService.priceLines(
            { items, pricelist: pricelistId || null },
            token
          );
          if (cancelled || seq !== priceSeqRef.current) return; // superseded response
          const byKey = new Map((res?.data?.items ?? []).map((item) => [item.key,item]));
          setLines((previous)=>previous.map(line=>{
            const result=byKey.get(line.key);
            if(!result||typeof result.unitPrice!=='number'||!Number.isFinite(result.unitPrice))return line;
            const price=line.priceOverridden?line.baseUnitPrice:result.unitPrice;
            const promotion=typeof result.promoDiscount==='number'?result.promoDiscount:line.promoDiscount;
            const name=result.promoName??line.promoName;
            if(line.baseUnitPrice===price&&line.promoDiscount===promotion&&line.promoName===name&&line.enginePriced)return line;
            return {...line,baseUnitPrice:price,enginePriced:true,promoDiscount:promotion,promoName:name};
          }));
        } catch {
          // keep the client-side estimate; the server reprices on save anyway
        }
      },
      switchedPricelist ? 0 : 350
    );
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [
    pricingSig,
    token,
    pricelistId,
    linesRef,
    setLines,
    priceSeqRef,
    confirmedPricingSigRef,
  ]);
}
