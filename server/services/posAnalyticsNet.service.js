const {orderReturnTotals}=require('./posReturnTotals.service');
const {settled}=require('./posSessionTotals.service');
const money=n=>Math.round(n*100)/100;
function orderLineNetTotals(order) {
 const items=order.items||[];
 const weights=items.map(i=>Math.max(0,(i.itemSubtotal ?? (i.priceAtPurchase||0)*i.quantity-(i.discountAmount||0))+(i.taxAmount||0)));
 const base=weights.reduce((n,v)=>n+v,0);
 const lines=items.map((item,index)=>{
  const share=base>0?weights[index]/base:0;
  let returned=0;
  const refunds=(order.refunds||[]).map(refund=>{
   const own=(refund.items||[]).filter(row=>row.orderItemIndex===index);
   returned+=own.reduce((n,row)=>n+Math.max(0,row.quantity-(refund.source==='sales'?0:(row.salesReturnedQuantity||0))),0);
   const amounts=(refund.items||[]).reduce((n,row)=>n+(row.amount||0),0);
   return {...refund,totalRefunded:(refund.totalRefunded||0)*(amounts>0?own.reduce((n,row)=>n+(row.amount||0),0)/amounts:share),
    items:own.map(row=>({...row,orderItemIndex:0}))};
  });
  // The line's share of the *commercial* gross, not of the tendered total. Using
  // the tender total made a gratuity look like a return on the line: the tip is
  // distributed across lines by the same weighting, so it has to be taken back
  // out here or `returnedValue` would report staff earnings as returned goods.
  const shareOrder={...order,totalAmount:(order.totalAmount||0)*share,items:[item],refunds};
  const lineTotals=orderReturnTotals(shareOrder);
  return {grossShare:lineTotals.grossRevenue,
   returnedValue:money(Math.max(0,lineTotals.grossRevenue-lineTotals.netSales)),
   netSales:lineTotals.netSales,
   returnedQuantity:Math.min(item.quantity,returned),netQuantity:Math.max(0,item.quantity-returned)};
 });
 if(lines.length){const delta=money(orderReturnTotals(order).netSales-lines.reduce((n,row)=>n+row.netSales,0));lines[lines.length-1].netSales=money(lines[lines.length-1].netSales+delta);
  // The rounding correction moves net sales, so it must move the share's
  // returned value with it or the line identity breaks on the last line.
  lines[lines.length-1].returnedValue=money(lines[lines.length-1].returnedValue+delta);}
 return lines;
}
function summarizeNetOrders(orders) {
 const stats={totalSales:0,orderCount:0,totalTips:0,totalRounding:0,breakdown:{}};
 for(const order of orders.filter(settled)){
  const net=orderReturnTotals(order).netSales;stats.totalSales+=net;stats.orderCount++;
  stats.totalTips+=order.tipAmount||0;stats.totalRounding+=order.roundingAmount||0;
  const row=stats.breakdown[order.paymentMethod||'cash'] ||= {total:0,count:0};row.total=money(row.total+net);row.count++;
 }
 stats.totalSales=money(stats.totalSales);return stats;
}
module.exports={orderLineNetTotals,summarizeNetOrders};
