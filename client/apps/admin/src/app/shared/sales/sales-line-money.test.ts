import { expect, it } from 'vitest';
import {
  lineAmounts,
  documentTotal,
} from '../../../../../../../packages/sales-money';
import {
  blankLine,
  soItemToDraftLine,
  resolveDiscount,
} from './sales-create-pricing-helpers';
it('saved promotions survive reload and reduce line tax and footer total once', () => {
  const line = soItemToDraftLine({
    _id: 'p',
    lineType: 'product',
    quantity: 3,
    unitPrice: 100.25,
    discount: 2.5,
    discountType: 'percentage',
    promoDiscount: 5.15,
    taxRate: 7.5,
  } as never);
  const amount = lineAmounts({ ...line, unitPrice: line.baseUnitPrice });
  expect(line.promoDiscount).toBe(5.15);
  expect(resolveDiscount(100.25, line)).toBe(7.52);
  expect(amount.tax).toBe(21.61);
  expect(
    documentTotal({
      subtotal: 300.75,
      discountTotal: 7.52,
      promotionTotal: 5.15,
      taxTotal: 21.61,
      shippingFee: 10.25,
    }),
  ).toBe(319.94);
  expect(
    lineAmounts({
      ...blankLine('note'),
      quantity: 3,
      unitPrice: 500,
      taxRate: 7.5,
    }).total,
  ).toBe(0);
});
it('footer additions preserve kobo without floating point residue', () => {
  expect(documentTotal({ subtotal: 0.1, shippingFee: 0.2 })).toBe(0.3);
});
it('section subtotals include legacy product rows and deduct promotions once',async()=>{
 const {sectionSubtotals}=await import('./sales-line-read-rows');
 const rows=[{_id:'s',lineType:'section'}, {_id:'p',quantity:2,lineTotal:100.25,promoDiscount:10.1}, {_id:'n',lineType:'note',lineTotal:999}] as never;
 expect(sectionSubtotals(rows).get('s')).toBe(90.15);
});
it('adding a heading places the pending product beneath it without losing its draft',async()=>{
 const {appendPresentationLine}=await import('./sales-create-pricing-helpers');
 const pending={...blankLine(),key:'pending',name:'Wine search'};
 const rows=appendPresentationLine([pending],'section');
 expect(rows.map(row=>row.lineType)).toEqual(['section','product']);expect(rows[1]).toBe(pending);
 expect(appendPresentationLine(rows,'note').map(row=>row.lineType)).toEqual(['section','note','product']);
});
