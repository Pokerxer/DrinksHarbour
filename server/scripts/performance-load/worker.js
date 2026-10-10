'use strict';
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const mongoose = require('mongoose');
const variant = process.argv[2];
if (!['before', 'after'].includes(variant)) throw new Error('Invalid variant');
process.env.NODE_ENV = 'production';
process.env.VERCEL = '1';
process.env.MONGODB_URI = `mongodb://127.0.0.1:27919/drinks_load_test_${variant}`;
process.env.JWT_SECRET = 'isolated-local-load-secret';
mongoose.set('autoIndex', false);
function snapshot(name, relative) {
  const filename = path.resolve(__dirname, '../..', relative);
  const target = new Module(filename, module);
  target.filename = filename;
  target.paths = Module._nodeModulePaths(path.dirname(filename));
  target._compile(fs.readFileSync(path.join(__dirname, 'snapshots', variant, name), 'utf8'), filename);
  require.cache[filename] = target;
}
async function main() {
  await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false, maxPoolSize: 5, minPoolSize: 0,
    maxIdleTimeMS: 60000, bufferCommands: false, monitorCommands: true });
  global.mongoose = { conn: mongoose, promise: Promise.resolve(mongoose) };
  snapshot('catalog.js', 'services/storefrontCatalog.service.js');
  snapshot('keys.js', 'services/apiKey.service.js');
  snapshot('logger.js', 'middleware/requestLogger.js');
  const app = require('../../server');
  let counts = {};
  mongoose.connection.getClient().on('commandStarted', event => {
    counts[event.commandName] = (counts[event.commandName] || 0) + 1;
  });
  const server = app.listen(0, '127.0.0.1', () => {
    process.send({ type: 'ready', port: server.address().port });
  });
  process.on('message', async message => {
    if (message.type === 'reset') { counts = {}; process.send({ type: 'reset' }); }
    if (message.type === 'metrics') process.send({ type: 'metrics', counts });
    if (message.type === 'stop') {
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
      await mongoose.disconnect();
      process.exit(0);
    }
  });
}
main().catch(error => { console.error(error); process.exit(1); });
