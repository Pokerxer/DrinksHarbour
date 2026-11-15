const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Messages } = require('@anthropic-ai/sdk/resources/messages');
const {
  extractItemsFromImage,
  extractItemsFromText,
} = require('../services/scanMatch.service');

const item = {
  name: 'Hennessy VS',
  brand: 'Hennessy',
  type: 'cognac',
  sizeText: '70cl',
  qty: 2,
  packUnit: 'case',
};

const imageData = Buffer.alloc(100).toString('base64');
const sourceText = '2 cases of Hennessy VS 70cl';
const cases = [
  ['photo', () => extractItemsFromImage('data:image/png;base64,' + imageData), (content) => {
    assert.deepEqual(content[0], {
      type: 'image',
      source: { type: 'base64', media_type: 'image/png', data: imageData },
    });
  }],
  ['text', () => extractItemsFromText(sourceText), (content) => {
    assert.ok(content.includes(sourceText));
  }],
];

for (const [source, extract, checkContent] of cases) {
  test(`Scan & Match extracts ${source} items with Haiku 5.5-compatible options`, async (t) => {
    let request;
    t.mock.method(Messages.prototype, 'create', async (params) => {
      request = params;
      return {
        content: [
          { type: 'thinking', thinking: 'Identify the item and pack quantity' },
          { type: 'text', text: JSON.stringify({ items: [item] }) },
        ],
      };
    });

    assert.deepEqual(await extract(), [item]);
    assert.equal(request.model, 'claude-haiku-5-5');
    assert.deepEqual(request.output_config, { effort: 'low' });
    assert.equal('temperature' in request, false);
    checkContent(request.messages[0].content);
  });
}
