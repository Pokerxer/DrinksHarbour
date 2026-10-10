'use strict';
const mongoose = require('mongoose');
process.env.NODE_ENV = 'production';
process.env.VERCEL = '1';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27919/drinks_redis_test';
process.env.JWT_SECRET = 'isolated-local-load-secret';
process.env.REDIS_URL = process.argv[2] !== 'baseline' ? 'redis://127.0.0.1:27920' : '';
process.env.REDIS_PUBLIC_METADATA_CACHE = process.argv[2] === 'metadata' ? 'true' : 'false';
process.env.REDIS_NAMESPACE = 'drinks-redis-test';
mongoose.set('autoIndex', false);
async function main() {
  await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false, maxPoolSize: 5, monitorCommands: true });
  global.mongoose = { conn: mongoose, promise: Promise.resolve(mongoose) };
  const app = require('../../server');
  let counts = {};
  mongoose.connection.getClient().on('commandStarted', event => { counts[event.commandName] = (counts[event.commandName] || 0) + 1; });
  const server = app.listen(0, '127.0.0.1', () => process.send({type: 'ready', port: server.address().port}));
  process.on('message', async message => {
    if (message.type === 'reset') { counts = {}; process.send({type: 'reset'}); }
    if (message.type === 'metrics') process.send({type: 'metrics', counts});
    if (message.type === 'stop') {
      server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
      await require('../../config/redis').closeRedis(); await mongoose.disconnect(); process.exit(0);
    }
  });
}
main().catch(error => { console.error(error); process.exit(1); });
