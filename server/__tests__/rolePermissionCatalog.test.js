// The canonical permission catalogue (server/config/permissions.js) and the
// client's declarative map (client/apps/admin/src/types/authorization.ts) must
// never drift apart: a checkbox offered by the UI that the server does not know
// is rejected noise, and a catalog entry the client cannot render is invisible.
//
// rolePermissionMap.test.js already pins ROLE_PERMISSIONS to the live route
// guards. This test pins the NEW catalogue to the same TypeScript source, using
// the same parse-the-literal trick, so all three layers stay one language.
//
// Scope note (honest enforcement caveat): custom-role permissions are
// UI-gating only until a requirePermission() middleware exists. This test keeps
// the DECLARATION coherent, not the enforcement — see the roles-permissions
// continuation prompt, decision #5.

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const {
  PERMISSION_CATALOG,
  PERMISSION_GROUPS,
  PLATFORM_ONLY_PERMISSIONS,
  validatePermissions,
} = require('../config/permissions');

const MAP_SOURCE = path.join(
  __dirname,
  '..',
  '..',
  'client',
  'apps',
  'admin',
  'src',
  'types',
  'authorization.ts'
);

/** Reuses the literal-parsing approach proven in rolePermissionMap.test.js. */
function readSuperAdminPermissions() {
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
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  assert.notStrictEqual(end, -1, 'unbalanced braces in the ROLE_PERMISSIONS literal');

  const literal = src
    .slice(open, end + 1)
    .replace(/\/\/[^\n]*/g, '')
    .replace(/([A-Za-z_$][\w$]*)\s*:\s*\[/g, '"$1": [')
    .replace(/'/g, '"')
    .replace(/,(\s*[}\]])/g, '$1');

  return JSON.parse(literal).super_admin;
}

test('every catalog key mirrors a client Permission exactly', () => {
  const declared = readSuperAdminPermissions();
  const catalogKeys = PERMISSION_CATALOG.map((p) => p.key);

  assert.deepStrictEqual(
    [...catalogKeys].sort(),
    [...declared].sort(),
    'PERMISSION_CATALOG keys and the client Permission union must be the same set'
  );
});

test('every catalog entry carries key, label, group and description', () => {
  for (const entry of PERMISSION_CATALOG) {
    assert.ok(entry.key && /^[a-z]+:[a-z]+$/.test(entry.key), `${entry.key}: malformed key`);
    assert.ok(entry.label, `${entry.key}: missing label`);
    assert.ok(entry.description, `${entry.key}: missing description`);
    assert.ok(
      PERMISSION_GROUPS.includes(entry.group),
      `${entry.key}: unknown group "${entry.group}"`
    );
  }
});

test('platform-only permissions are a subset of the catalog', () => {
  const catalogKeys = new Set(PERMISSION_CATALOG.map((p) => p.key));
  for (const key of PLATFORM_ONLY_PERMISSIONS) {
    assert.ok(catalogKeys.has(key), `${key} is platform-only but absent from the catalog`);
  }
  // The four the design settled on must always be locked away from tenants.
  for (const key of ['tenant:manage', 'billing:read', 'billing:write']) {
    assert.ok(PLATFORM_ONLY_PERMISSIONS.includes(key), `${key} must be platform-only`);
  }
});

test('validatePermissions rejects unknown keys', () => {
  const result = validatePermissions(['products:read', 'not:a:permission'], 'platform');
  assert.strictEqual(result.ok, false);
  assert.ok(result.unknown.includes('not:a:permission'));
});

test('validatePermissions rejects platform-only keys for tenant scope', () => {
  const result = validatePermissions(['products:read', 'billing:write'], 'tenant');
  assert.strictEqual(result.ok, false);
  assert.deepStrictEqual(result.platformOnly, ['billing:write']);
});

test('validatePermissions accepts a clean tenant-scope selection', () => {
  const result = validatePermissions(['products:read', 'orders:write'], 'tenant');
  assert.strictEqual(result.ok, true);
});
