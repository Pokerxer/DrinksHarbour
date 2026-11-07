import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const cwd = fileURLToPath(new URL('../../client/apps/admin/', import.meta.url));
function outputDir(mode, override) {
  const env = { ...process.env, NODE_ENV: mode,
    NEXTAUTH_SECRET: 'local-config-test', NEXTAUTH_URL: 'http://localhost:3000' };
  delete env.VENUE_NEXT_DIST_DIR;
  if (override) env.VENUE_NEXT_DIST_DIR = override;
  const result = spawnSync(process.execPath, ['-e', `
    const loadConfig = require('next/dist/server/config').default;
    const phase = process.env.NODE_ENV === 'development'
      ? 'phase-development-server' : 'phase-production-build';
    loadConfig(phase, process.cwd()).then(config => {
      console.log('OUTPUT_DIR=' + config.distDir);
    }).catch(error => { console.error(error.message); process.exitCode = 1; });
  `], { cwd, env, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const dir = result.stdout.match(/^OUTPUT_DIR=(.+)$/m)?.[1];
  assert.ok(dir, 'Next config must resolve an output directory');
  return dir;
}

test('admin development and production outputs cannot overwrite each other', () => {
  const dev = outputDir('development');
  const production = outputDir('production');
  assert.notEqual(dev, production);
  assert.equal(dev, '.next-dev');
  assert.equal(production, '.next');
});

test('explicit isolated build directory is respected in either mode', () => {
  for (const mode of ['development', 'production']) {
    assert.equal(outputDir(mode, '.next-venue-test'), '.next-venue-test');
  }
});
