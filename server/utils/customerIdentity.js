'use strict';
const loginScope = (user) =>
  user.role === 'customer' && user.tenant
    ? `tenant:${user.tenant._id || user.tenant}`
    : 'platform';
// Match legacy records too, until the namespace migration is applied.
const platformIdentity = () => ({
  $or: [{ role: { $ne: 'customer' } }, { tenant: null }],
});
const customerIdentity = (tenant) => ({
  tenant: tenant._id || tenant,
  role: 'customer',
});
module.exports = { loginScope, platformIdentity, customerIdentity };
