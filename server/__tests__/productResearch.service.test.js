'use strict';

const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
const {
  researchProduct,
  formatFactsForPrompt,
  clearResearchCache,
  extractSources,
  sanitizeFacts,
  FACTUAL_FIELDS,
} = require('../services/productResearch.service');

// Minimal stand-in for the Anthropic client: records calls and replays canned
// messages, so nothing here touches the network.
function stubClient(messages) {
  const queue = Array.isArray(messages) ? messages.slice() : [messages];
  const client = {
    calls: 0,
    lastParams: null,
    messages: {
      stream(params) {
        client.calls += 1;
        client.lastParams = params;
        const next = queue.length > 1 ? queue.shift() : queue[0];
        return {
          finalMessage: async () => {
            if (next instanceof Error) throw next;
            return next;
          },
        };
      },
    },
  };
  return client;
}

const searchResultBlock = (results) => ({
  type: 'web_search_tool_result',
  tool_use_id: 'srvtoolu_1',
  content: results.map((r) => ({ type: 'web_search_result', ...r })),
});

const textBlock = (obj) => ({
  type: 'text',
  text: typeof obj === 'string' ? obj : JSON.stringify(obj),
});

beforeEach(() => clearResearchCache());

test('extractSources reads web_search_tool_result blocks only', () => {
  const content = [
    searchResultBlock([
      { title: 'Hennessy Official', url: 'https://www.hennessy.com/vsop', page_age: null },
      { title: 'Cognac Expert', url: 'https://cognac-expert.com/hennessy-vsop' },
    ]),
    textBlock('See also https://totally-made-up-source.example/hennessy for more.'),
  ];

  const sources = extractSources(content);

  assert.strictEqual(sources.length, 2);
  assert.deepStrictEqual(sources.map((s) => s.url), [
    'https://www.hennessy.com/vsop',
    'https://cognac-expert.com/hennessy-vsop',
  ]);
});

test('extractSources ignores a URL that appears only in model prose', () => {
  const sources = extractSources([
    textBlock('According to https://invented.example/page the ABV is 40%.'),
  ]);
  assert.deepStrictEqual(sources, []);
});

test('extractSources dedupes repeated URLs and survives a tool error block', () => {
  const sources = extractSources([
    searchResultBlock([{ title: 'A', url: 'https://a.example/x' }]),
    { type: 'web_search_tool_result', content: { type: 'web_search_tool_result_error', error_code: 'max_uses_exceeded' } },
    searchResultBlock([{ title: 'A again', url: 'https://a.example/x' }]),
  ]);
  assert.deepStrictEqual(sources, [{ title: 'A', url: 'https://a.example/x' }]);
});

test('sanitizeFacts drops unknown keys, placeholders and empty values', () => {
  const facts = sanitizeFacts({
    abv: 40,
    originCountry: 'France',
    region: 'unknown',
    appellation: '',
    producer: 'N/A',
    caskType: null,
    grapeVarieties: [],
    ingredients: ['Grapes', '  ', 'n/a'],
    someFieldWeNeverAskedFor: 'ignore me',
  });

  assert.deepStrictEqual(facts, {
    originCountry: 'France',
    abv: 40,
    ingredients: ['Grapes'],
  });
});

test('sanitizeFacts coerces numeric fields and rejects unusable numbers', () => {
  const facts = sanitizeFacts({ abv: '40%', volumeMl: '750 ml', vintage: 0, age: 'twelve' });
  assert.strictEqual(facts.abv, 40);
  assert.strictEqual(facts.volumeMl, 750);
  assert.ok(!('vintage' in facts), 'zero vintage is not a confirmed value');
  assert.ok(!('age' in facts), 'unparseable age is dropped');
});

test('researchProduct returns confirmed facts and real sources', async () => {
  const client = stubClient({
    stop_reason: 'end_turn',
    content: [
      searchResultBlock([
        { title: 'Hennessy Official', url: 'https://www.hennessy.com/vsop' },
      ]),
      textBlock({
        found: true,
        originCountry: 'France',
        region: 'Cognac',
        abv: 40,
        volumeMl: 700,
        summary: 'A VSOP cognac blended from eau-de-vie aged at least four years.',
      }),
    ],
  });

  const brief = await researchProduct({ name: 'Hennessy VSOP' }, { client });

  assert.strictEqual(brief.found, true);
  assert.strictEqual(brief.facts.originCountry, 'France');
  assert.strictEqual(brief.facts.abv, 40);
  assert.deepStrictEqual(brief.sources, [
    { title: 'Hennessy Official', url: 'https://www.hennessy.com/vsop' },
  ]);
  assert.match(brief.summary, /VSOP cognac/);
});

test('fields absent from the response are reported as unverified', async () => {
  const client = stubClient({
    content: [
      searchResultBlock([{ title: 'Src', url: 'https://src.example/p' }]),
      textBlock({ found: true, originCountry: 'France', abv: 40 }),
    ],
  });

  const brief = await researchProduct({ name: 'Hennessy VSOP' }, { client });

  assert.ok(brief.unverified.includes('vintage'));
  assert.ok(brief.unverified.includes('caskType'));
  assert.ok(!brief.unverified.includes('abv'));
  assert.strictEqual(
    brief.unverified.length,
    FACTUAL_FIELDS.length - Object.keys(brief.facts).length
  );
});

test('facts without any source do not count as found', async () => {
  const client = stubClient({
    content: [textBlock({ found: true, originCountry: 'France', abv: 40 })],
  });

  const brief = await researchProduct({ name: 'Obscure Local Gin' }, { client });

  assert.strictEqual(brief.found, false, 'unsourced facts are model recall, not research');
  assert.deepStrictEqual(brief.sources, []);
});

test('malformed JSON yields a not-found brief instead of throwing', async () => {
  const client = stubClient({
    content: [
      searchResultBlock([{ title: 'Src', url: 'https://src.example/p' }]),
      textBlock('I searched but the response got cut off {"abv": 4'),
    ],
  });

  const brief = await researchProduct({ name: 'Broken Response' }, { client });

  assert.strictEqual(brief.found, false);
  assert.deepStrictEqual(brief.facts, {});
  assert.deepStrictEqual(brief.unverified, FACTUAL_FIELDS);
});

test('an explicit found:false is preserved along with the sources searched', async () => {
  const client = stubClient({
    content: [
      searchResultBlock([{ title: 'Nothing', url: 'https://src.example/none' }]),
      textBlock({ found: false }),
    ],
  });

  const brief = await researchProduct({ name: 'Made Up Bottle 1998' }, { client });

  assert.strictEqual(brief.found, false);
  assert.deepStrictEqual(brief.facts, {});
  assert.strictEqual(brief.sources.length, 1);
});

test('a refusal is handled as not-found, not as an exception', async () => {
  const client = stubClient({ stop_reason: 'refusal', content: [] });
  const brief = await researchProduct({ name: 'Something' }, { client });
  assert.strictEqual(brief.found, false);
  assert.match(brief.error, /declined/i);
});

test('a network failure degrades to a not-found brief', async () => {
  const client = stubClient(new Error('socket hang up'));
  const brief = await researchProduct({ name: 'Hennessy VSOP' }, { client });
  assert.strictEqual(brief.found, false);
  assert.strictEqual(brief.error, 'socket hang up');
});

test('repeat lookups hit the cache instead of searching again', async () => {
  const client = stubClient({
    content: [
      searchResultBlock([{ title: 'Src', url: 'https://src.example/p' }]),
      textBlock({ found: true, abv: 40 }),
    ],
  });

  await researchProduct({ name: 'Hennessy VSOP' }, { client });
  await researchProduct({ name: '  hennessy   vsop ' }, { client });

  assert.strictEqual(client.calls, 1, 'normalised name should hit the same cache key');
});

test('the cache expires after its TTL', async () => {
  const client = stubClient({
    content: [
      searchResultBlock([{ title: 'Src', url: 'https://src.example/p' }]),
      textBlock({ found: true, abv: 40 }),
    ],
  });
  const t0 = 1_700_000_000_000;

  await researchProduct({ name: 'Hennessy VSOP' }, { client, now: () => t0 });
  await researchProduct(
    { name: 'Hennessy VSOP' },
    { client, now: () => t0 + 25 * 60 * 60 * 1000 }
  );

  assert.strictEqual(client.calls, 2);
});

test('cacheOnly returns null on a miss and never calls the client', async () => {
  const client = stubClient({ content: [] });

  const miss = await researchProduct({ name: 'Cold Cache' }, { client, cacheOnly: true });

  assert.strictEqual(miss, null);
  assert.strictEqual(client.calls, 0);
});

test('cacheOnly serves a brief that a previous search warmed', async () => {
  const client = stubClient({
    content: [
      searchResultBlock([{ title: 'Src', url: 'https://src.example/p' }]),
      textBlock({ found: true, abv: 40 }),
    ],
  });

  await researchProduct({ name: 'Hennessy VSOP' }, { client });
  const warm = await researchProduct({ name: 'Hennessy VSOP' }, { client, cacheOnly: true });

  assert.strictEqual(client.calls, 1);
  assert.strictEqual(warm.facts.abv, 40);
});

test('different brands are cached separately', async () => {
  const client = stubClient({
    content: [
      searchResultBlock([{ title: 'Src', url: 'https://src.example/p' }]),
      textBlock({ found: true, abv: 40 }),
    ],
  });

  await researchProduct({ name: 'Reserve', brand: 'Alpha' }, { client });
  await researchProduct({ name: 'Reserve', brand: 'Beta' }, { client });

  assert.strictEqual(client.calls, 2);
});

test('the search request declares the web_search tool', async () => {
  const client = stubClient({ content: [textBlock({ found: false })] });
  await researchProduct({ name: 'Anything' }, { client });

  const tools = client.lastParams.tools;
  assert.strictEqual(tools.length, 1);
  assert.strictEqual(tools[0].name, 'web_search');
  assert.match(tools[0].type, /^web_search_/);
});

test('formatFactsForPrompt renders confirmed facts and the no-inference rule', () => {
  const block = formatFactsForPrompt({
    found: true,
    facts: { originCountry: 'France', abv: 40 },
    summary: 'A cognac.',
    sources: [{ title: 'A', url: 'https://a.example' }],
    searchedAt: '2026-07-29T10:00:00.000Z',
  });

  assert.match(block, /- originCountry: France/);
  assert.match(block, /- abv: 40/);
  assert.match(block, /do NOT infer/);
  assert.match(block, /1 live source/);
});

test('formatFactsForPrompt returns empty string for a not-found brief', () => {
  assert.strictEqual(formatFactsForPrompt({ found: false, facts: {} }), '');
  assert.strictEqual(formatFactsForPrompt(null), '');
});

// ── applyBriefToProduct ─────────────────────────────────────────────────────

const { applyBriefToProduct } = require('../services/productResearch.service');

test('applyBriefToProduct overwrites model output with confirmed facts', () => {
  const generated = { abv: 43, originCountry: 'Spain', region: 'Rioja' };
  const brief = { found: true, facts: { abv: 40, originCountry: 'France', region: 'Cognac' } };

  const { data } = applyBriefToProduct(generated, brief);

  assert.strictEqual(data.abv, 40, 'the brief wins over the fill pass');
  assert.strictEqual(data.originCountry, 'France');
  assert.strictEqual(data.region, 'Cognac');
  assert.strictEqual(data.proof, 80, 'proof is derived from the verified ABV');
});

test('applyBriefToProduct blanks and flags facts no source confirmed', () => {
  const generated = { abv: 40, vintage: 2015, caskType: 'ex-bourbon', standardSizes: ['70cl'] };
  const brief = { found: true, facts: { abv: 40 } };

  const { data, unverified } = applyBriefToProduct(generated, brief);

  assert.strictEqual(data.abv, 40);
  assert.strictEqual(data.vintage, null, 'an unsourced vintage must not survive');
  assert.strictEqual(data.caskType, '');
  assert.deepStrictEqual(data.standardSizes, []);
  assert.ok(unverified.includes('vintage'));
  assert.ok(unverified.includes('caskType'));
  assert.ok(!unverified.includes('abv'));
});

test('applyBriefToProduct never blanks fields the admin supplied', () => {
  const generated = { brand: 'Hennessy', region: 'Cognac' };
  const brief = { found: true, facts: {} };

  const { data, unverified } = applyBriefToProduct(generated, brief, { preserve: ['brand'] });

  assert.strictEqual(data.brand, 'Hennessy');
  assert.ok(!unverified.includes('brand'));
  assert.strictEqual(data.region, '');
});

test('applyBriefToProduct drops confirmed values that fail the schema enum', () => {
  const brief = { found: true, facts: { standardSizes: ['70cl', '19.4cl'], productionMethod: 'sous_vide' } };

  const { data, unverified } = applyBriefToProduct({}, brief, {
    enums: { standardSizes: ['70cl', '75cl'], productionMethod: ['pot_still', 'blended'] },
  });

  assert.deepStrictEqual(data.standardSizes, ['70cl'], 'unrepresentable size is filtered out');
  assert.strictEqual(data.productionMethod, null);
  assert.ok(unverified.includes('productionMethod'));
});

test('applyBriefToProduct clears proof when the ABV is unverified', () => {
  const { data } = applyBriefToProduct({ abv: 40, proof: 80 }, { found: true, facts: {} });
  assert.strictEqual(data.abv, null);
  assert.strictEqual(data.proof, null);
});

// ── Source ranking and size normalisation ───────────────────────────────────

const { filterToEnum } = require('../services/productResearch.service');

test('extractSources ranks marketplace listings last', () => {
  const sources = extractSources([
    searchResultBlock([
      { title: 'eBay listing', url: 'https://www.ebay.de/p/123' },
      { title: 'UberEats', url: 'https://www.ubereats.com/store/abc' },
      { title: 'Hennessy official', url: 'https://www.hennessy.com/vsop' },
      { title: 'Cognac Expert', url: 'https://www.cognac-expert.com/hennessy' },
    ]),
  ]);

  assert.deepStrictEqual(
    sources.map((s) => s.url),
    [
      'https://www.hennessy.com/vsop',
      'https://www.cognac-expert.com/hennessy',
      'https://www.ebay.de/p/123',
      'https://www.ubereats.com/store/abc',
    ]
  );
});

test('extractSources caps the list so the admin gets something checkable', () => {
  const many = Array.from({ length: 30 }, (_, i) => ({
    title: `Source ${i}`,
    url: `https://example.com/${i}`,
  }));
  assert.strictEqual(extractSources([searchResultBlock(many)]).length, 12);
});

test('filterToEnum matches a sourced bottle size written in another unit', () => {
  const allowed = ['70cl', '75cl', '1L', '1.75L', '100cl'];

  // A real search returned exactly these for Hennessy VSOP.
  assert.deepStrictEqual(
    filterToEnum(['700ml', '750ml', '1L', '1.75L'], allowed, 'standardSizes'),
    ['70cl', '75cl', '1L', '1.75L']
  );
});

test('filterToEnum handles cl and litre spellings and dedupes', () => {
  const allowed = ['70cl', '75cl'];
  assert.deepStrictEqual(
    filterToEnum(['0.7L', '70 cl', '700ml', '75cl'], allowed, 'standardSizes'),
    ['70cl', '75cl']
  );
});

test('filterToEnum still drops a size the schema genuinely cannot store', () => {
  assert.deepStrictEqual(filterToEnum(['1.94L'], ['70cl', '75cl'], 'standardSizes'), []);
});

test('filterToEnum leaves non-size fields to exact matching', () => {
  assert.strictEqual(filterToEnum('sous_vide', ['pot_still'], 'productionMethod'), undefined);
  assert.strictEqual(filterToEnum('pot_still', ['pot_still'], 'productionMethod'), 'pot_still');
});

test('applyBriefToProduct keeps a size the source wrote in millilitres', () => {
  const { data, unverified } = applyBriefToProduct(
    {},
    { found: true, facts: { standardSizes: ['700ml'] } },
    { enums: { standardSizes: ['70cl', '75cl'] } }
  );
  assert.deepStrictEqual(data.standardSizes, ['70cl']);
  assert.ok(!unverified.includes('standardSizes'));
});

// ── Timeout guard ───────────────────────────────────────────────────────────

const { withTimeout } = require('../services/productResearch.service');

test('withTimeout returns the message when the stream finishes in time', async () => {
  const stream = { finalMessage: async () => ({ content: [] }), abort() { this.aborted = true; } };
  const msg = await withTimeout(stream, 1000);
  assert.deepStrictEqual(msg, { content: [] });
  assert.ok(!stream.aborted);
});

test('withTimeout aborts a stream that overruns the ceiling', async () => {
  // A tool loop that never settles — the SDK request timeout did not interrupt
  // this in practice, which is why the guard exists.
  const stream = {
    aborted: false,
    finalMessage: () => new Promise(() => {}),
    abort() { this.aborted = true; },
  };

  await assert.rejects(() => withTimeout(stream, 20), /timed out after/i);
  assert.strictEqual(stream.aborted, true, 'the hung stream must be aborted, not leaked');
});

test('a timed-out research call degrades to a blank, flagged brief', async () => {
  const client = stubClient(new Error('Research timed out after 90s'));
  const brief = await researchProduct({ name: 'Slow Product' }, { client });
  assert.strictEqual(brief.found, false);
  assert.deepStrictEqual(brief.facts, {});
  assert.deepStrictEqual(brief.unverified, FACTUAL_FIELDS);
});

// ── Model + reasoning params ────────────────────────────────────────────────
// The whole product/sub-product AI surface runs on Haiku. Haiku 4.5 rejects
// `output_config.effort` and adaptive thinking with a 400, so a research call
// that carried either would fail at request time, not in review.

const {
  reasoningParams,
  RESEARCH_MODEL,
} = require('../services/productResearch.service');

test('research runs on Haiku by default', () => {
  assert.match(RESEARCH_MODEL, /^claude-haiku/);
});

test('the research call sends Haiku-legal reasoning params', async () => {
  const client = stubClient({
    content: [
      searchResultBlock([{ title: 'Src', url: 'https://src.example/p' }]),
      textBlock({ found: true, abv: 40 }),
    ],
  });

  await researchProduct({ name: 'Params Probe' }, { client });
  const params = client.lastParams;

  assert.match(params.model, /^claude-haiku/);
  assert.ok(!('output_config' in params), 'effort 400s on Haiku 4.5');
  assert.strictEqual(params.thinking.type, 'enabled');
  assert.ok(
    params.thinking.budget_tokens >= 1024 &&
      params.thinking.budget_tokens < params.max_tokens,
    'thinking budget must sit between the 1024 minimum and max_tokens'
  );
});

test('reasoningParams still emits adaptive+effort for a non-Haiku override', () => {
  const params = reasoningParams('claude-opus-4-8');
  assert.strictEqual(params.thinking.type, 'adaptive');
  assert.ok(!('budget_tokens' in params.thinking), 'budget_tokens 400s on Opus 4.7+');
  assert.ok(params.output_config.effort);
});
