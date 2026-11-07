const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function route() {
  let handler;
  const spoken = [];
  const router = { post(_path, _limiter, callback) { handler = callback; } };
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../routes/tts.routes.js'), 'utf8'), {
    module, console, process: { env: {} },
    require: name => {
      if (name === 'express') return { Router: () => router };
      if (name === 'express-rate-limit') return () => (_req, _res, next) => next();
      if (name === '../services/fishAudio.service') return {
        isConfigured: () => true,
        synthesize: async text => {
          spoken.push(text);
          return { buffer: Buffer.from('audio'), format: 'mp3', cached: false };
        },
      };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  const res = { code: 200, body: null,
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; },
    set() { return this; }, send(body) { this.body = body; return this; },
  };
  return { spoken, res, handle: text => handler({ body: { text } }, res) };
}

test('the speech route forwards the complete long passage without truncation', async () => {
  const { spoken, res, handle } = route();
  const text = 'A long history of craftsmanship. '.repeat(100).trim();
  await handle(text);
  assert.equal(res.code, 200);
  assert.deepEqual(spoken, [text]);
});

test('the speech route rejects input beyond its narration bound', async () => {
  const { spoken, res, handle } = route();
  await handle('x'.repeat(5001));
  assert.equal(res.code, 400);
  assert.equal(spoken.length, 0);
});
