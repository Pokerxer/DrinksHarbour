const test=require('node:test');
const assert=require('node:assert/strict');
const Reservation=require('../models/SalesStockReservation');
const Warehouse=require('../models/Warehouse');
const {projectReservations}=require('../services/salesReservations/projection');
test('cancelled order has neither active held nor waiting demand',async t=>{
 const query=()=>({select(){return this;},session(){return this;},lean:async()=>[]});
 t.mock.method(Reservation,'find',query);t.mock.method(Warehouse,'find',query);
 const [doc]=await projectReservations([{_id:'sale',reservationVersion:1,orderStatus:'cancelled',items:[{_id:'line',quantity:4,fulfilledQty:0}]}],'tenant');
 assert.equal(doc.items[0].reservedQty,0);assert.equal(doc.items[0].waitingQty,0);
});
