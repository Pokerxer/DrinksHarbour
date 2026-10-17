import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { expect, it } from 'vitest';

// Vitest's esbuild does not enforce Next's client boundary directive placement.
// Exercise the installed Next compiler so this build failure cannot pass tests.
const require = createRequire(resolve(process.cwd(), 'package.json'));
const { transform } = require('next/dist/build/swc') as {
  transform: (source: string, options: object) => Promise<unknown>;
};
const { getLoaderSWCOptions } = require('next/dist/build/swc/options') as {
  getLoaderSWCOptions: (options: object) => object;
};
it('sales client modules compile with Next server-component boundary checks', async () => {
  const directory = resolve(process.cwd(), 'src/app/shared/sales');
  const names = readdirSync(directory, { recursive: true }) as string[];
  const failures: string[] = [];
  for (const name of names) {
    if (!/\.(ts|tsx)$/.test(name) || name.includes('.test.')) continue;
    const filename = resolve(directory, name);
    const source = readFileSync(filename, 'utf8');
    if (!/['"]use client['"]/.test(source)) continue;
    try {
      await transform(source, getLoaderSWCOptions({
        filename, relativeFilePathFromRoot: name, development: true, isServer: true,
        serverComponents: true, bundleLayer: 'rsc', esm: true,
        jsConfig: { compilerOptions: {} }, isCacheComponents: false,
        useCacheEnabled: false, serverReferenceHashSalt: 'test',
      }));
    } catch (error) {
      failures.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  expect(failures).toEqual([]);
});
