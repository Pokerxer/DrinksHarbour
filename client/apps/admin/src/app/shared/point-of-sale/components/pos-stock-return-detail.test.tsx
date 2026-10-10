import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { POSStockReturnDetail } from './pos-stock-return-detail';
it('shows receipt value without presenting a stock return as a cash refund', () => {
 const html=renderToStaticMarkup(<POSStockReturnDetail
   refund={{receiptNumber:'Sales return · SO00008',items:[{orderItemIndex:0,quantity:60}]}}
   order={{receiptNumber:'RCP-20260928-0001',items:[{name:'Sunblessed',quantity:60,priceAtPurchase:1000,itemSubtotal:60000}]}}
   onClose={()=>{}} />);
 expect(html).toContain('60,000.00');
 expect(html).toContain('1,000.00');
 expect(html).toContain('Returned goods value');
 expect(html).toContain('Cash refund');
 expect(html).toContain('Not recorded');
 expect(html).not.toContain('Cashier');
 expect(html).not.toContain('Refund via');
 expect(html).not.toContain('−');
});
