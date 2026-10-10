const express = require('express');
const { protect } = require('../middleware/auth.middleware');
const {
  notificationController,
} = require('../controllers/notification.controller');
function createNotificationRouter(auth = protect, service) {
  const router = express.Router(),
    ctrl = notificationController(service);
  router.use(auth);
  router.get('/', ctrl.list);
  router.patch('/read-all', ctrl.markAllRead);
  router.patch('/:id/read', ctrl.markRead);
  return router;
}
module.exports = createNotificationRouter();
module.exports.createNotificationRouter = createNotificationRouter;
