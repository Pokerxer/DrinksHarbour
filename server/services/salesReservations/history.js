const WarehouseMovement = require('../../models/WarehouseMovement');
const InventoryMovement = require('../../models/InventoryMovement');
async function recordShipment({key,quantity,before,after,reference,actorId,product,orderId,session}) {
  await WarehouseMovement.create([{...key,type:'shipped',quantity,balanceBefore:before,balanceAfter:after,
    stockChange:-quantity,reference,performedBy:actorId}],{session});
  await InventoryMovement.create([{...key,product,type:'shipped',category:'out',quantity,
    quantityBefore:before,quantityAfter:after,reference,referenceType:'order',
    relatedSalesOrder:orderId,source:'system',status:'confirmed',performedBy:actorId,performedAt:new Date()}],{session});
}
module.exports={recordShipment};
