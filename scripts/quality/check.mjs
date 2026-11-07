import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const checks = [
  ['Credentials', process.execPath, ['scripts/quality/secret-scan.mjs']],
  ['Quality tooling', 'npm', ['run', 'test:quality']],
  ['API tests', 'npm', ['--prefix', 'server', 'test']],
  ['Dashboard types', 'pnpm', ['--dir', 'client', '--filter', 'admin', 'type:check']],
  ['Storefront types', 'pnpm', ['--dir', 'client', '--filter', 'platform', 'type:check']],
  ['Dashboard lint', 'pnpm', ['--dir', 'client', '--filter', 'admin', 'lint']],
  ['Storefront lint', 'pnpm', ['--dir', 'client', '--filter', 'platform', 'lint']],
  ['Dashboard tests', 'pnpm', ['--dir', 'client', '--filter', 'admin', 'test']],
];
const failed = [];
for (const [name, command, args] of checks) {
  console.log(`\nChecking: ${name}`);
  const result = spawnSync(command, args, { cwd: root, env: process.env, stdio: 'inherit', timeout: 20 * 60 * 1000 });
  if (result.status !== 0) failed.push(name);
}
console.log(failed.length ? `Failed checks: ${failed.join(', ')}` : 'All configured local checks passed. Production builds, integration flows and release controls require separate verification.');
process.exitCode = failed.length ? 1 : 0;
