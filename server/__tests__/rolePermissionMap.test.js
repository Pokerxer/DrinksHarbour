// The admin client declares ROLE_PERMISSIONS (client/apps/admin/src/types/
// authorization.ts) but nothing consumes it — the whole
// types → utils → hooks → hoc chain is dead code, and so are
// lib/server-auth.ts's requirePermission/requireAnyPermission. Only the
// role-NAME exports are load-bearing.
//
// The map is kept rather than deleted, so it has to be true. This test reads
// the enforced role set for each bound endpoint off the live Express routers
// (via the authorizedRoles tags proven in authorizedRolesMetadata.test.js) and
// asserts the map agrees exactly.
//
// SCOPE, deliberately: only write/delete permissions are bound. Read
// permissions mostly back public storefront GETs where every role — including
// an anonymous caller — can read, so comparing them would say nothing. And the
// comparison is of ROUTE-LEVEL role gates only; documented inline narrowings
// (super_admin alone gets permanent user delete, tenant delete, product
// approve/reject, and cross-tenant includeAll/statusFilter) are finer than any
// route gate and are out of this matrix by design.
//
// See docs/superpowers/specs/2026-08-07-roles-permissions-hardening-design.md §2.4

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ALL_ROLES = ['super_admin', 'admin', 'tenant_owner', 'tenant_admin', 'tenant_staff', 'customer'];

const MAP_SOURCE = path.join(
  __dirname, '..', '..', 'client', 'apps', 'admin', 'src', 'types', 'authorization.ts'
);

/**
 * Reads ROLE_PERMISSIONS out of the TypeScript source. The declaration is a
 * plain object of string arrays, so slicing the literal and normalising quotes
 * and trailing commas is enough — and if the shape ever changes, this throws
 * loudly rather than silently comparing nothing.
 */
function readRolePermissions() {
  const src = fs.readFileSync(MAP_SOURCE, 'utf8');
  const start = src.indexOf('export const ROLE_PERMISSIONS');
  assert.notStrictEqual(start, -1, `ROLE_PERMISSIONS not found in ${MAP_SOURCE}`);

  const open = src.indexOf('{', start);
  let depth = 0;
  let end = -1;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') {
      depth -= 1;
      if (depth === 0) { end = i; break; }
    }
  }
  assert.notStrictEqual(end, -1, 'unbalanced braces in the ROLE_PERMISSIONS literal');

  const literal = src
    .slice(open, end + 1)
    .replace(/\/\/[^\n]*/g, '')                          // strip line comments
    // Quote the role keys BEFORE touching quotes, and only where a key is
    // followed by `[`. A naive /(\w+)\s*:/ would also match inside the values —
    // 'products:read' would become '"products":read' and blow up JSON.parse.
    .replace(/([A-Za-z_$][\w$]*)\s*:\s*\[/g, '"$1": [')
    .replace(/'/g, '"')                                   // single → double quotes
    .replace(/,(\s*[}\]])/g, '$1');                       // trailing commas

  return JSON.parse(literal);
}

/**
 * Effective role set for one endpoint: every authorizedRoles tag on the
 * router-level `use` layers that precede the route, intersected with the tags
 * on the route's own handler chain. This is exactly how Express composes them.
 */
function enforcedRoles(routerModule, method, routePath) {
  const router = require(routerModule);
  let roles = new Set(ALL_ROLES);
  let found = false;

  for (const layer of router.stack) {
    if (!layer.route) {
      if (layer.handle?.authorizedRoles) {
        roles = new Set([...roles].filter((r) => layer.handle.authorizedRoles.includes(r)));
      }
      continue;
    }
    if (layer.route.path !== routePath || !layer.route.methods[method]) continue;

    found = true;
    for (const sub of layer.route.stack) {
      if (sub.handle?.authorizedRoles) {
        roles = new Set([...roles].filter((r) => sub.handle.authorizedRoles.includes(r)));
      }
    }
    break;
  }

  assert.ok(found, `${method.toUpperCase()} ${routePath} not declared in ${routerModule}`);
  return [...roles];
}

// permission → the single endpoint that backs it.
const BINDINGS = [
  ['products:write',     '../routes/product.routes',     'post',   '/'],
  ['products:delete',    '../routes/product.routes',     'delete', '/:id'],
  ['categories:write',   '../routes/category.routes',    'post',   '/admin'],
  ['categories:delete',  '../routes/category.routes',    'delete', '/admin/:id'],
  ['brands:write',       '../routes/brand.routes',       'post',   '/admin'],
  ['brands:delete',      '../routes/brand.routes',       'delete', '/admin/:id'],
  ['subproducts:write',  '../routes/subproduct.routes',  'post',   '/'],
  ['subproducts:delete', '../routes/subproduct.routes',  'delete', '/:id'],
  ['users:read',         '../routes/user.routes',        'get',    '/'],
  ['users:write',        '../routes/user.routes',        'post',   '/'],
  ['users:delete',       '../routes/user.routes',        'delete', '/:id'],
  ['inventory:write',    '../routes/inventory.routes',   'post',   '/movements'],
  ['inventory:adjust',   '../routes/inventory.routes',   'post',   '/adjust'],
  ['customers:write',    '../routes/contact.routes',     'post',   '/'],
  ['tenant:manage',      '../routes/tenant.routes',      'put',    '/admin/:id'],
  ['orders:write',       '../routes/order.routes',       'post',   '/'],
];

test('ROLE_PERMISSIONS parses out of the TypeScript source', () => {
  const map = readRolePermissions();
  assert.deepStrictEqual(Object.keys(map).sort(), [...ALL_ROLES].sort());
});

for (const [permission, routerModule, method, routePath] of BINDINGS) {
  test(`${permission} matches ${method.toUpperCase()} ${routePath}`, () => {
    const map = readRolePermissions();
    const enforced = enforcedRoles(routerModule, method, routePath).sort();
    const granted = ALL_ROLES.filter((r) => map[r].includes(permission)).sort();

    assert.deepStrictEqual(
      granted,
      enforced,
      `ROLE_PERMISSIONS grants ${permission} to [${granted}] but ` +
      `${method.toUpperCase()} ${routePath} admits [${enforced}]`
    );
  });
}
