// DRI-34 — /inventory Scrap surface (checklist item 8): NO UI CHANGE REQUIRED.
// CEO decision recorded: the shared preset set stands as the industry-agnostic
// default — it covers beverage spoilage, retail damaged/defective, food-service
// spoilage, theft and write-offs above any single industry, and the per-industry
// mapping is prose (no per-industry fork in the movement writer). This pin
// locks the preset set so a future per-industry fork cannot land silently.

import { expect, it } from 'vitest';
import { PRESETS } from './inventory-movements-presets';

it('scrap presets are the unchanged industry-agnostic default set', () => {
  expect(PRESETS.scrap.types).toEqual([
    'damaged',
    'expired',
    'theft',
    'written_off',
  ]);
  expect(PRESETS.scrap.tabs.map((t) => t.key)).toEqual([
    'all',
    'damaged',
    'expired',
    'theft',
    'written_off',
  ]);
  // Neutral shared nouns — no beverage-only unit or category vocabulary.
  expect(PRESETS.scrap.unitsLabel).toBe('Units Scrapped');
  expect(PRESETS.scrap.emptyNoun).toBe('scrapped stock');
});
