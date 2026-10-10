const asyncHandler = require('express-async-handler');
const {
  createInboxService,
} = require('../services/tenantNotifications.service');
function notificationController(service = createInboxService()) {
  const handle = (action) =>
    asyncHandler(async (req, res) => {
      res.set('Cache-Control', 'private, no-store');
      res.json({ success: true, data: await action(req) });
    });
  return {
    list: handle(service.list),
    markRead: handle(service.markRead),
    markAllRead: handle(service.markAllRead),
  };
}
module.exports = { notificationController };
