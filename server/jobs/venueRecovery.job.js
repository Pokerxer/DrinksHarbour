'use strict';
const cron = require('node-cron');
function startVenueRecoveryCron() {
  return cron.schedule('* * * * *', async () => {
    try { await require('../services/venue/capacity-expiry').expireHolds(); await require('../services/venue/recovery').recoverVenueWork(); }
    catch { console.error('venueRecoveryFailed', { code: 'VENUE_WORKER_FAILED' }); }
  });
}
module.exports = { startVenueRecoveryCron };
