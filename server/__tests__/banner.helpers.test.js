// server/__tests__/banner.helpers.test.js
const test = require('node:test');
const assert = require('node:assert');
const {
  BANNER_TYPES,
  BANNER_PLACEMENTS,
  BANNER_CTA_STYLES,
  BANNER_TEXT_FIELDS,
  AI_FIELD_ACTIONS,
  ENHANCE_GOALS,
  isEnhanceableField,
  snapEnum,
  snapHexColor,
  clampField,
  parseAiJson,
  sanitizeBannerData,
  computeScheduledStatus,
  MANAGED_STATUSES,
} = require('../services/banner.helpers');

test('isEnhanceableField accepts non-empty text fields, rejects empty/unknown', () => {
  for (const f of BANNER_TEXT_FIELDS) {
    assert.strictEqual(isEnhanceableField(f, 'Shop Now'), true, `${f} with text`);
    assert.strictEqual(isEnhanceableField(f, '   '), false, `${f} blank`);
    assert.strictEqual(isEnhanceableField(f, ''), false, `${f} empty`);
  }
  assert.strictEqual(isEnhanceableField('description', 'hi'), false);
  assert.strictEqual(isEnhanceableField('backgroundColor', '#fff'), false);
  assert.strictEqual(isEnhanceableField('title', null), false);
});

test('snapEnum matches case-insensitively and falls back', () => {
  assert.strictEqual(snapEnum('HERO', BANNER_TYPES), 'hero');
  assert.strictEqual(snapEnum('Home_Hero', BANNER_PLACEMENTS), 'home_hero');
  assert.strictEqual(snapEnum('bogus', BANNER_TYPES), null);
  assert.strictEqual(snapEnum('bogus', BANNER_TYPES, 'promotional'), 'promotional');
});

test('snapHexColor validates #RRGGBB and falls back otherwise', () => {
  assert.strictEqual(snapHexColor('#1A2B3C'), '#1A2B3C');
  assert.strictEqual(snapHexColor('#fff'), '#1a1a2e'); // 3-digit not accepted
  assert.strictEqual(snapHexColor('red'), '#1a1a2e');
  assert.strictEqual(snapHexColor(undefined, '#000000'), '#000000');
});

test('clampField collapses whitespace and enforces per-field limits', () => {
  assert.strictEqual(clampField('ctaText', '  Shop   Now  '), 'Shop Now');
  assert.strictEqual(clampField('title', 'x'.repeat(80)).length, 60);
  assert.strictEqual(clampField('subtitle', 'x'.repeat(200)).length, 100);
  assert.strictEqual(clampField('ctaText', 'x'.repeat(50)).length, 30);
});

test('parseAiJson handles raw JSON, fenced JSON, arrays, prose, and control chars', () => {
  assert.deepStrictEqual(parseAiJson('{"a":1}'), { a: 1 });
  assert.deepStrictEqual(parseAiJson('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepStrictEqual(parseAiJson('Sure! [{"a":1}] done'), [{ a: 1 }]);
  assert.deepStrictEqual(parseAiJson('not json', []), []);
  assert.deepStrictEqual(parseAiJson('', { fallback: true }), { fallback: true });
});

test('sanitizeBannerData clamps copy, validates colors, snaps enums', () => {
  const out = sanitizeBannerData({
    title: 'x'.repeat(80),
    subtitle: '  Great   drinks  ',
    ctaText: 'x'.repeat(50),
    backgroundColor: 'notacolor',
    textColor: '#FFFFFF',
    tags: Array(20).fill('t'),
    contentPosition: 'weird',
    textAlignment: 'RIGHT',
    styleNote: 'urgent tone',
  });
  assert.strictEqual(out.title.length, 60);
  assert.strictEqual(out.subtitle, 'Great drinks');
  assert.strictEqual(out.ctaText.length, 30);
  assert.strictEqual(out.backgroundColor, '#1a1a2e'); // invalid -> fallback
  assert.strictEqual(out.textColor, '#FFFFFF');
  assert.strictEqual(out.tags.length, 10);
  assert.strictEqual(out.contentPosition, 'center'); // invalid -> fallback
  assert.strictEqual(out.textAlignment, 'right'); // snapped case-insensitively
  assert.strictEqual(out.styleNote, 'urgent tone');
});

test('sanitizeBannerData tolerates non-object / missing fields', () => {
  const out = sanitizeBannerData(null);
  assert.strictEqual(out.title, '');
  assert.deepStrictEqual(out.tags, []);
  assert.strictEqual(out.contentPosition, 'center');
});

test('sanitizeBannerData snaps AI-picked type/placement/ctaStyle when valid', () => {
  const out = sanitizeBannerData({
    title: 'Hi',
    type: 'PRODUCT',
    placement: 'Home_Hero',
    ctaStyle: 'Outline',
  });
  assert.strictEqual(out.type, 'product');
  assert.strictEqual(out.placement, 'home_hero');
  assert.strictEqual(out.ctaStyle, 'outline');
});

test('sanitizeBannerData omits invalid/missing type/placement/ctaStyle', () => {
  const withGarbage = sanitizeBannerData({ title: 'Hi', type: 'nope', placement: 'x', ctaStyle: 'fancy' });
  assert.ok(!('type' in withGarbage), 'invalid type omitted');
  assert.ok(!('placement' in withGarbage), 'invalid placement omitted');
  assert.ok(!('ctaStyle' in withGarbage), 'invalid ctaStyle omitted');

  const bare = sanitizeBannerData({ title: 'Hi' });
  assert.ok(!('type' in bare) && !('placement' in bare) && !('ctaStyle' in bare));
});

test('exports BANNER_CTA_STYLES', () => {
  assert.deepStrictEqual(BANNER_CTA_STYLES, ['primary', 'secondary', 'outline', 'text', 'custom']);
});

test('computeScheduledStatus flips scheduled/active/expired by window', () => {
  const now = new Date('2026-07-15T12:00:00Z');
  const past = '2026-07-01T00:00:00Z';
  const future = '2026-08-01T00:00:00Z';

  // before start -> scheduled
  assert.strictEqual(computeScheduledStatus({ status: 'scheduled', startDate: future }, now), 'scheduled');
  assert.strictEqual(computeScheduledStatus({ status: 'active', startDate: future }, now), 'scheduled');
  // within window -> active
  assert.strictEqual(computeScheduledStatus({ status: 'scheduled', startDate: past, endDate: future }, now), 'active');
  assert.strictEqual(computeScheduledStatus({ status: 'active', startDate: past, endDate: future }, now), 'active');
  // past end -> expired (end takes precedence over start)
  assert.strictEqual(computeScheduledStatus({ status: 'active', startDate: past, endDate: past }, now), 'expired');
  assert.strictEqual(computeScheduledStatus({ status: 'scheduled', endDate: past }, now), 'expired');
  // extended endDate can revive an expired banner
  assert.strictEqual(computeScheduledStatus({ status: 'expired', startDate: past, endDate: future }, now), 'active');
  // no dates -> stays active
  assert.strictEqual(computeScheduledStatus({ status: 'active' }, now), 'active');
});

test('computeScheduledStatus never touches manual statuses', () => {
  const now = new Date('2026-07-15T12:00:00Z');
  for (const status of ['draft', 'paused', 'archived']) {
    assert.strictEqual(computeScheduledStatus({ status, endDate: '2026-07-01T00:00:00Z' }, now), null);
  }
  assert.strictEqual(computeScheduledStatus(null, now), null);
  assert.deepStrictEqual(MANAGED_STATUSES, ['scheduled', 'active', 'expired']);
});

test('exports action + goal enums', () => {
  assert.deepStrictEqual(AI_FIELD_ACTIONS, ['rewrite', 'expand', 'shorten', 'punchier']);
  assert.deepStrictEqual(ENHANCE_GOALS, ['urgency', 'engagement', 'trust', 'conversions']);
  assert.deepStrictEqual(BANNER_TEXT_FIELDS, ['title', 'subtitle', 'ctaText']);
});
