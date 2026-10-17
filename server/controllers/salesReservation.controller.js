const asyncHandler = require('express-async-handler');
const reservations = require('../services/salesReservations');
const activity = require('../services/salesActivity.service');
function action(method, subject) {
  return asyncHandler(async (req,res) => {
    const tenantId=req.tenant?._id;
    const doc=await reservations[method]({tenantId,orderId:req.params.id,
      warehouseId:req.body?.warehouseId,actorId:req.user?._id});
    await activity.logActivity(tenantId,doc._id,{subject,userId:req.user?._id});
    res.json({success:true,data:(await reservations.projectReservations([doc],tenantId))[0]});
  });
}
module.exports={confirmReservation:action('confirmReservation','Order confirmed; stock reserved without payment'),
  checkAvailability:action('checkAvailability','Stock availability checked')};
