'use strict';
const { adminReportCache } = require('../services/adminReportCache');
const { subProductPageCache } = require('../services/subProductPageCache');
const PLATFORM = new Set(['admin', 'super_admin']);
const ADMIN = new Set([...PLATFORM, 'tenant_owner', 'tenant_admin', 'tenant_staff']);
const id = value => value ? String(value._id ?? value) : null;
function reportContext(req, resource, { tenantRequired = false } = {}) {
  const user = req.user;
  if (!id(user?._id) || !ADMIN.has(user.role)) return null;
  const tenant = id(user.tenant);
  const resolved = id(req.tenant);
  if (tenant && resolved && tenant !== resolved) return null;
  if ((tenantRequired || !PLATFORM.has(user.role)) && !tenant) return null;
  const { refresh, ...query } = req.query || {};
  return {
    scope: tenantRequired || !PLATFORM.has(user.role) ? `tenant:${tenant}` : 'platform',
    resource, query,
    day: new Date().toDateString(),
    principal: { user: id(user._id), role: user.role, tenant, resolved,
      permissions: user.customPermissions ?? null, customRole: id(user.customRole),
      pos: Boolean(req.posUser), posPermissions: req.posPermissions ?? null },
  };
}
function createAdminReportMiddleware(cache = adminReportCache) {
  function cacheReport(resource, options) {
    // Must be registered AFTER every auth, tenant, role, permission and plan guard.
    return async (req, res, next) => {
      const context = reportContext(req, resource, options);
      if (req.method !== 'GET' || (req.body && Object.keys(req.body).length) || !context || !cache.isEnabled()) return next();
      res.set('Cache-Control', 'private, no-store, max-age=0');
      const originalJson = res.json;
      try {
        const result = await cache.read(context, () => new Promise(resolve => {
          res.json = function(body) {
            res.json = originalJson;
            resolve({ status: res.statusCode, body, noCache: Boolean(res.getHeader('set-cookie')) });
            return res;
          };
          next();
        }), { fresh: req.query.refresh === 'true' });
        if (!res.writableEnded && !res.destroyed) originalJson.call(res.status(result.status), result.body);
      } catch (error) { res.json = originalJson; next(error); }
    };
  }
  function invalidateReports(req, res, next) {
    const invalidationCache = cache.isEnabled() ? cache : subProductPageCache;
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) || !invalidationCache.isEnabled()) return next();
    const originalJson = res.json;
    res.json = function(body) {
      res.json = originalJson;
      if (!req.user || res.statusCode < 200 || res.statusCode >= 300 || body?.success === false) return originalJson.call(res, body);
      const tenant = id(req.user.tenant);
      // Cross-tenant/platform writes invalidate all generations. Tenant writes
      // invalidate only that tenant plus the platform's aggregate reports.
      const scopes = tenant ? [`tenant:${tenant}`, 'platform'] : ['all', 'platform'];
      void invalidationCache.invalidate(scopes).then(() => originalJson.call(res, body), () => originalJson.call(res, body));
      return res;
    };
    next();
  }
  return { cacheReport, invalidateReports };
}
module.exports = { ...createAdminReportMiddleware(), createAdminReportMiddleware, reportContext };
