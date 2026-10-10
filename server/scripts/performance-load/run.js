'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const os = require('node:os');
const { fork } = require('node:child_process');
const mongoose = require('mongoose');
const { seed } = require('./fixtures');
const { load } = require('./client');
const { ensurePerformanceIndexes } = require('../../config/performanceIndexes');
const output = path.resolve(__dirname, '../../../docs/performance');
function waitMessage(child, type) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { cleanup(); reject(new Error(`Worker ${type} timed out`)); }, 60000);
    const message = value => { if (value.type === type) { cleanup(); resolve(value); } };
    const exit = code => { cleanup(); reject(new Error(`Worker exited ${code}`)); };
    function cleanup() { clearTimeout(timer); child.off('message', message); child.off('exit', exit); }
    child.on('message', message); child.once('exit', exit);
  });
}
async function control(child, type) {
  const promise = waitMessage(child, type);
  child.send({ type });
  return promise;
}
async function main() {
  fs.mkdirSync(output, { recursive: true });
  mongoose.set('autoIndex', false);
  let mongoVersion;
  for (const variant of ['before', 'after']) {
    await mongoose.connect(`mongodb://127.0.0.1:27919/drinks_load_test_${variant}`, { autoIndex: false, maxPoolSize: 5 });
    mongoVersion = (await mongoose.connection.db.admin().command({ buildInfo: 1 })).version;
    await seed(mongoose.connection);
    if (variant === 'after') await ensurePerformanceIndexes(mongoose.connection);
    await mongoose.disconnect();
    console.log(`Seeded ${variant}: shared catalogue 200, tenants 100, offers 20000, variants 40000, keys 35000`);
  }
  const runs = [], equivalence = new Map();
  const metadata = { mongoVersion, node: process.version, platform: process.platform, architecture: process.arch, cpu: os.cpus()[0].model,
    cpuCount: os.cpus().length, totalMemoryGB: os.totalmem() / 1024 ** 3, snapshots: {} };
  for (const variant of ['before', 'after']) for (const file of ['catalog.js', 'keys.js', 'logger.js']) {
    metadata.snapshots[`${variant}/${file}`] = crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, 'snapshots', variant, file))).digest('hex');
  }
  // Three paired rounds. Order alternates to reduce warm-cache/order bias.
  for (let round = 1; round <= 3; round++) for (const variant of round % 2 ? ['before', 'after'] : ['after', 'before']) {
    const descriptor = fs.openSync(`/tmp/drinksharbour-load-${round}-${variant}.log`, 'w');
    const child = fork(path.join(__dirname, 'worker.js'), [variant], { stdio: ['ignore', descriptor, descriptor, 'ipc'] });
    fs.closeSync(descriptor);
    try {
      const { port } = await waitMessage(child, 'ready');
      for (const scenario of ['hot', 'mixed']) for (const concurrency of [1, 10, 50]) {
        await load(port, scenario, concurrency, 100);
        await control(child, 'reset');
        const result = await load(port, scenario, concurrency, 600);
        const { counts } = await control(child, 'metrics');
        const key = `${scenario}:${concurrency}`;
        const signature = JSON.stringify(result.hashes);
        if (equivalence.has(key) && equivalence.get(key) !== signature) throw new Error('Before/after response mismatch');
        equivalence.set(key, signature);
        delete result.hashes;
        const row = { round, variant, scenario, concurrency, ...result, databaseCommands: counts };
        runs.push(row);
        fs.writeFileSync('/tmp/drinksharbour-load-results.json', JSON.stringify({ metadata, runs }, null, 2));
        console.log(`Round ${round} ${variant} ${scenario} c=${concurrency}: mean ${result.meanMs.toFixed(1)}ms p95 ${result.p95Ms.toFixed(1)}ms ${result.rps.toFixed(1)} req/s; 600/600 HTTP 200`);
      }
    } finally {
      if (child.connected) child.send({ type: 'stop' });
      await new Promise(resolve => { if (child.exitCode !== null) resolve(); else child.once('exit', resolve); });
    }
  }
  fs.writeFileSync('/tmp/drinksharbour-load-complete.json', JSON.stringify({ metadata, runs }, null, 2));
  // Both names and host are constants, never caller-supplied or production URIs.
  for (const variant of ['before', 'after']) {
    await mongoose.connect(`mongodb://127.0.0.1:27919/drinks_load_test_${variant}`, { autoIndex: false });
    await mongoose.connection.dropDatabase(); await mongoose.disconnect();
  }
  console.log('Completed 36 measured workloads; both isolated fixture databases removed.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
