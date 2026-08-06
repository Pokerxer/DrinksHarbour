// server/__tests__/cjsRequireable.test.js
//
// Guard against ERR_REQUIRE_ESM in the deployed function runtime.
//
// On 2026-08-06 the whole backend went down: every route returned
// FUNCTION_INVOCATION_FAILED because `sanitize-html@2.17.6` pulled in
// `htmlparser2@12`, which is ESM-only (no `require` export condition), and
// `services/mailBody.service.js` + `services/snippet.service.js` require it at
// module scope. That kills the Express app before it can serve anything.
//
// Nothing caught it locally: Node >= 22.12 enables require(ESM) by default, so
// the whole suite stayed green while production was hard down. Vercel's
// function loader does NOT support require(ESM), so the same tree crashed there.
//
// `--no-experimental-require-module` reproduces the deployed loader's rules, so
// these tests fail locally on exactly the trees that fail in production.
const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const SERVER_DIR = path.join(__dirname, '..');

// Runs `script` in a child node that refuses to require() an ES module,
// matching the serverless loader. Returns { ok, output }.
function requireUnderCjsOnlyLoader(script) {
  const res = spawnSync(
    process.execPath,
    ['--no-experimental-require-module', '-e', script],
    { cwd: SERVER_DIR, encoding: 'utf8', timeout: 120000 }
  );
  return {
    ok: res.status === 0,
    output: `${res.stdout || ''}${res.stderr || ''}`,
  };
}

test('sanitize-html is requireable from CommonJS', () => {
  const { ok, output } = requireUnderCjsOnlyLoader("require('sanitize-html')");
  assert.ok(
    ok,
    `sanitize-html pulled in an ESM-only dependency. Pin it to a version whose ` +
      `htmlparser2 range still ships a CJS build (htmlparser2 >= 11 is ESM-only).\n${output}`
  );
});

test('the mail services that sanitize HTML load from CommonJS', () => {
  const { ok, output } = requireUnderCjsOnlyLoader(
    "require('./services/mailBody.service.js');require('./services/snippet.service.js')"
  );
  assert.ok(ok, `Mail services failed to load under the serverless loader.\n${output}`);
});

test('no module in the server graph is ESM-only', () => {
  // Sweeps every module the Express app pulls in at boot. A single ESM-only
  // dependency anywhere in here takes down every route, not just its own.
  const script = `
    const fs = require('fs');
    const failures = [];
    for (const dir of ['routes', 'controllers', 'services', 'models', 'middleware', 'utils', 'config']) {
      if (!fs.existsSync(dir)) continue;
      for (const file of fs.readdirSync(dir)) {
        if (!file.endsWith('.js')) continue;
        try {
          require('./' + dir + '/' + file);
        } catch (err) {
          if (err.code === 'ERR_REQUIRE_ESM') {
            failures.push(dir + '/' + file + ' :: ' + err.message.split('\\n')[0]);
          }
          // Other errors (missing env vars, DB config) are not this test's concern.
        }
      }
    }
    if (failures.length) {
      console.error('ERR_REQUIRE_ESM in:\\n' + failures.join('\\n'));
      process.exit(1);
    }
  `;
  const { ok, output } = requireUnderCjsOnlyLoader(script);
  assert.ok(ok, `ESM-only module(s) in the server graph.\n${output}`);
});
