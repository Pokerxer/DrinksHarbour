const test=require('node:test');
const assert=require('node:assert/strict');
const {lineAmounts,convertDiscount}=require('../../packages/sales-money');
const svc=require('../services/salesOrder.service');
test('line discount and tax preserve kobo through stored snapshots',()=>{
 const line={lineType:'product',quantity:3,unitPrice:100.25,discount:10.10,discountType:'fixed',taxRate:7.5};
 const amount=lineAmounts(line);assert.equal(amount.gross,300.75);assert.equal(amount.untaxed,290.65);assert.equal(amount.tax,21.8);
 const saved=svc.mapLine(line);assert.equal(saved.lineTotal,290.65);assert.equal(saved.taxAmount,21.8);
});
test('percentage discount and promotion reduce taxable base once',()=>{
 const line={quantity:3,unitPrice:100.25,discount:2.5,discountType:'percentage',promoDiscount:5.15,taxRate:7.5};
 const amount=lineAmounts(line);assert.equal(amount.discount,7.52);assert.equal(amount.untaxed,288.08);assert.equal(amount.tax,21.61);
 assert.equal(svc.lineTaxOf(line),amount.tax);
});
test('presentation rows have no money and type switching preserves the resolved reduction',()=>{
 for(const lineType of ['note','section'])assert.equal(lineAmounts({lineType,unitPrice:100,quantity:10,discount:20,taxRate:99}).total,0);
 const line={unitPrice:100.25,quantity:3,discount:10.1,discountType:'fixed'};
 const percent=convertDiscount(line,'percentage');assert.equal(lineAmounts({...line,...percent}).discount,10.1);
 assert.equal(convertDiscount({...line,...percent},'fixed').discount,10.1);
 assert.equal(convertDiscount({...line,unitPrice:0},'percentage').discount,0);
});
test('product monetary inputs reject nonfinite values instead of saving a free line',()=>{
 for(const field of ['unitPrice','quantity','discount','taxRate'])assert.throws(()=>svc.mapLine({unitPrice:100,quantity:1,[field]:Infinity}),/finite/i);
});
test('shipping edits reject invalid values and round valid fees to kobo',async()=>{
 for(const shippingFee of [-1,Infinity,NaN])await assert.rejects(svc.applyEdit({tenant:'t'}, {shippingFee}),/shipping/i);
 const order={tenant:'t',subtotal:100,discountTotal:0,taxTotal:0};await svc.applyEdit(order,{shippingFee:12.345});assert.equal(order.shippingFee,12.35);assert.equal(order.total,112.35);
});
test('spend-threshold discounts preserve kobo like the live footer',async t=>{
 t.mock.method(require('../models/Pricelist'),'findOne',()=>({select(){return this;},lean:async()=>({rules:[{priceType:'cart_threshold',thresholdAmount:100,discountType:'percentage',discountPercentage:10,sequence:0}]})}));
 assert.equal(await require('../services/salesPricing.service').computeCartThresholdForOrder(123.45,{tenantId:'t',pricelistId:'p'}),12.35);
});
test('overflowing a line amount is rejected instead of becoming a free line',()=>{
 assert.throws(()=>svc.mapLine({unitPrice:Number.MAX_VALUE,quantity:2}),/large|finite/i);
});
