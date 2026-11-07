// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';

/**
 * Structural RSC-boundary guard for the /ecommerce dashboard folder.
 *
 * Why this exists: `best-sellers.tsx` lost its `'use client'` directive during
 * a polish edit and Webpack shipped it into the RSC graph — the runtime then
 * threw "Attempted to call useDashboard() from the server". jsdom vitest and
 * `tsc` cannot see this class of break (both only compile per-file types), so
 * this test enforces the two documented RSC rules from index.tsx structurally:
 *
 * 1. Any module that calls a client hook must declare `'use client'` BEFORE
 *    its first import. The intentionally presentational dashboard-skeleton.tsx
 *    has no hooks and is rendered by the server page — if you ever add a hook
 *    to it, move its skeleton content into a client child instead.
 * 2. rizzui must be imported by SUBPATH only (`rizzui/typography`); the barrel
 *    eagerly pulls @headlessui/react into the RSC graph, where `createContext`
 *    does not exist.
 */

const dashboardDir = path.resolve(process.cwd(), 'src/app/shared/ecommerce/dashboard');
const ecommerceDir = path.resolve(dashboardDir, '..');

const files: string[] = [];
for (const dir of [dashboardDir, ecommerceDir]) {
  for (const entry of fs.readdirSync(dir)) {
    if (!entry.endsWith('.tsx') || /\.test\.tsx$/.test(entry)) continue;
    files.push(path.join(dir, entry));
  }
}

const HOOK =
  /\b(useDashboard|useDashboardMeta|useDashboardRefreshControl|useState|useReducer|useEffect|useLayoutEffect|useMemo|useCallback|useRef|useContext|useTransition|useId|useSyncExternalStore|useOptimistic)\s*[<(]/;

test('no dashboard module slips into the RSC graph without a client directive', () => {
  const offenders: string[] = [];
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    if (!HOOK.test(source)) continue;
    if (path.basename(file) === 'dashboard-skeleton.tsx') continue;

    const directive = source.indexOf(`'use client'`);
    const firstImport = source.match(/^[ \t]*import /m)?.index ?? -1;
    const declaredBeforeImports =
      directive !== -1 && (firstImport === -1 || directive < firstImport);
    if (!declaredBeforeImports) {
      offenders.push(
        path.relative(dashboardDir, file) +
          ' calls client hooks but its use-client directive is missing ' +
          'or appears after the imports — the module will be evaluated on ' +
          'the server, and calling useDashboard() there throws the RSC ' +
          'runtime error.'
      );
    }
  }
  expect(
    offenders.join('\n'),
    'RSC-boundary check failed — a use-client directive was dropped from a dashboard module'
  ).toBe('');
});

test('rizzui is always imported by subpath in dashboard modules', () => {
  const offenders: string[] = [];
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    if (/^[ \t]*import[^\n]*from\s+['"]rizzui['"];?[ \t]*$/m.exec(source)) {
      offenders.push(
        `${path.relative(dashboardDir, file)} imports the rizzui barrel — use subpath imports ('rizzui/typography', 'rizzui/button', …)`
      );
    }
  }
  expect(offenders.join('\n')).toBe('');
});
