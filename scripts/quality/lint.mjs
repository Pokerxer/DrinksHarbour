import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
// Both supported ESLint majors can read the existing explicit eslintrc policy.
// Keep this compatibility setting here instead of weakening or skipping lint.
const require = createRequire(path.join(process.cwd(), 'package.json'));
const manifest = require.resolve('eslint/package.json');
const cli = path.join(path.dirname(manifest), 'bin/eslint.js');
const result = spawnSync(process.execPath, [cli, 'src', '--ext', '.js,.jsx,.ts,.tsx', ...process.argv.slice(2)], {
  env: { ...process.env, ESLINT_USE_FLAT_CONFIG: 'false' }, stdio: 'inherit',
});
process.exitCode = result.status ?? 1;
