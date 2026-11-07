const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function loadService(voice) {
  const requests = [];
  const reads = [];
  const source = fs.readFileSync(path.join(__dirname, '../services/fishAudio.service.js'), 'utf8');
  const module = { exports: {} };
  vm.runInNewContext(source, {
    module, Buffer, console,
    __dirname: path.join(__dirname, '../services'),
    process: { env: { FISH_AUDIO_API_KEY: 'test-key', ...(voice === undefined ? {} : { FISH_AUDIO_VOICE_ID: voice }) } },
    require: name => name === 'fs' ? {
      mkdirSync() {},
      readFileSync(file) { reads.push(file); throw new Error('cache miss'); },
      writeFileSync() {},
    } : require(name),
    fetch: async (_url, options) => {
      requests.push(JSON.parse(options.body));
      return { ok: true, arrayBuffer: async () => Buffer.from('audio') };
    },
  });
  return { ...module.exports, requests, reads };
}

test('every separately generated section pins the same reference voice without configuration', async () => {
  const service = loadService();
  await service.synthesize('First section of a product description.');
  await service.synthesize('Second section of the same description.');
  assert.deepEqual(service.requests.map(body => body.reference_id), [
    '802e3bc2b27e49c2995d23ef70e6ac89', '802e3bc2b27e49c2995d23ef70e6ac89',
  ]);
});

test('preserves a full narration in one request with voice continuity and restrained variation', async () => {
  const service = loadService();
  const text = 'A house with a long history and distinctive craft. '.repeat(75).trim();
  await service.synthesize(text);
  assert.equal(service.requests.length, 1);
  assert.equal(service.requests[0].text, text);
  assert.equal(service.requests[0].condition_on_previous_chunks, true);
  assert.ok(service.requests[0].temperature <= 0.4);
});

test('rejects oversized narration rather than dropping the end silently', async () => {
  const service = loadService();
  await assert.rejects(service.synthesize('x'.repeat(5001)), { status: 400 });
  assert.equal(service.requests.length, 0);
});

test('blank voice configuration still pins a reference voice', async () => {
  const service = loadService('  ');
  await service.synthesize('A full product description.');
  assert.equal(service.requests[0].reference_id, '802e3bc2b27e49c2995d23ef70e6ac89');
});

test('a configured reference voice is used consistently instead of the fallback', async () => {
  const service = loadService('configured-voice');
  await service.synthesize('First section of a product description.');
  await service.synthesize('Second section of the same description.');
  assert.deepEqual(service.requests.map(body => body.reference_id), ['configured-voice', 'configured-voice']);
});

test('fixed voice synthesis never reads the old unspecified-voice cache entry', async () => {
  const text = 'A full product description.';
  const service = loadService();
  await service.synthesize(text);
  const previousHash = crypto.createHash('sha1').update(text + '|s2.1-pro-free|default').digest('hex');
  const oldFixedHash = crypto.createHash('sha1').update(text + '|s2.1-pro-free|802e3bc2b27e49c2995d23ef70e6ac89').digest('hex');
  const resolvedHash = crypto.createHash('sha1').update(text + '|s2.1-pro-free|802e3bc2b27e49c2995d23ef70e6ac89|continuous-v1').digest('hex');
  assert.notEqual(path.basename(service.reads[0]), `${previousHash}.mp3`);
  assert.notEqual(path.basename(service.reads[0]), `${oldFixedHash}.mp3`);
  assert.equal(path.basename(service.reads[0]), `${resolvedHash}.mp3`);
});
