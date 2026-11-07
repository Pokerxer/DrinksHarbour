/**
 * Canonical venue workspace tool keys, shared by the workspace client state
 * and the `/venue` server page so a URL deep link restores the selected tool.
 *
 * Pure module: no 'use client' — the server page imports the validator while
 * client components import the href helper. Keep the keys aligned with the
 * tabs in `workspace-navigation.tsx`.
 */

export const venueToolKeys = [
  'overview',
  'profile',
  'menu',
  'recipes',
  'servings',
  'production',
  'counts',
  'cost-sources',
  'profitability',
  'floor',
  'floor-ops',
  'capacity',
  'money',
  'stations',
  'courses',
  'door',
  'waitlist',
  'packages',
  'practice',
] as const;

export type Tab = (typeof venueToolKeys)[number];

/**
 * Resolve a raw `?tool=` query value to a workspace tool. Returns undefined
 * for anything unknown so callers can fall back to their default tab.
 */
export function resolveVenueTool(value: string | undefined): Tab | undefined {
  return typeof value === 'string' && (venueToolKeys as readonly string[]).includes(value)
    ? (value as Tab)
    : undefined;
}

/** Canonical URL for a tool so back/refresh restores the selected workspace tool. */
export function venueToolHref(tool: Tab): string {
  return tool === 'overview' ? '/venue' : `/venue?tool=${tool}`;
}
