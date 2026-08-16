const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Metro must watch the whole workspace or it cannot resolve commerce-core.
config.watchFolders = [workspaceRoot];

// Resolve from the app first, then the workspace root — pnpm's layout means
// hoisted packages live at the root while direct deps live in the app.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// pnpm uses symlinks; without this Metro follows them to real paths and
// resolves the same module twice.
config.resolver.unstable_enableSymlinks = true;

// NOTE: `disableHierarchicalLookup = true` is the standard Expo-monorepo
// setting, but it is written for npm/yarn workspaces where every transitive
// dependency is hoisted to the root. pnpm does not hoist: transitive deps live
// in `.pnpm/` and are symlinked only into the packages that declare them. With
// the lookup disabled, Metro cannot walk up to reach them, and Expo's own
// internals fail to resolve one at a time — first `@babel/runtime`, then
// `whatwg-fetch`, and so on. Leaving hierarchical lookup ENABLED is what makes
// this work under pnpm.

module.exports = config;
