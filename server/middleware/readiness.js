'use strict';
// Liveness answers whether the process runs; readiness proves the DB can answer.
function createReadinessHandler({ connection, timeoutMs = 1000 }) {
  return async function readiness(req, res) {
    res.set('Cache-Control', 'no-store');
    let ready = false, timer;
    if (connection.readyState === 1 && connection.db) {
      try {
        const result = await Promise.race([
          connection.db.admin().ping(),
          new Promise((resolve, reject) => { timer = setTimeout(() => reject(new Error('timeout')), timeoutMs); }),
        ]);
        ready = result?.ok === 1;
      } catch { ready = false; }
      finally { clearTimeout(timer); }
    }
    if (!ready) res.set('Retry-After', '5');
    return res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'not_ready',
      database: ready ? 'reachable' : 'unreachable' });
  };
}
module.exports = { createReadinessHandler };
