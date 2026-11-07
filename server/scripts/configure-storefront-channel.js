#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const mongoose = require('mongoose');
async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log('Set STOREFRONT_CONFIG_MONGO_URI explicitly. Use --mapping=<JSON file> --actor=<super-admin ID> [--apply --stock-cutover-reviewed]. Preview is the default. No .env is loaded.');
    return;
  }
  if (args.some(a => !a.startsWith('--mapping=') && !a.startsWith('--actor=') && !['--apply', '--stock-cutover-reviewed'].includes(a))) throw new Error('Unsupported argument');
  const path = args.find(a => a.startsWith('--mapping='))?.slice(10);
  const actorId = args.find(a => a.startsWith('--actor='))?.slice(8);
  const apply = args.includes('--apply');
  if (!path || !actorId || !/^mongodb(?:\+srv)?:\/\//.test(process.env.STOREFRONT_CONFIG_MONGO_URI || '')) throw new Error('Explicit database, mapping and reviewer required');
  if (apply && !args.includes('--stock-cutover-reviewed')) throw new Error('Reviewed stock cutover acknowledgement required');
  const input = JSON.parse(fs.readFileSync(path, 'utf8'));
  require('../services/storefrontChannels').validateConfiguration(input);
  await mongoose.connect(process.env.STOREFRONT_CONFIG_MONGO_URI, { autoIndex: false, serverSelectionTimeoutMS: 10000 });
  console.log(JSON.stringify(await require('../services/storefrontConfiguration').configure(input, { actorId, apply }), null, 2));
}
main().catch(error => {
  console.error(`Storefront configuration failed: ${error.name || 'Error'}. Review mapping, active reviewer, website credentials, open legacy orders and explicit database. Sensitive connection details withheld.`);
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());
