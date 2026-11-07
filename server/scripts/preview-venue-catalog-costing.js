#!/usr/bin/env node
'use strict';
const fs = require('node:fs/promises');
const mongoose = require('mongoose');
async function main(argv = process.argv.slice(2)) {
  const input = argv.find((arg) => arg.startsWith('--input='))?.slice(8);
  if (
    !input ||
    argv.some(
      (arg) =>
        ![
          '--apply',
          '--mapping-reviewed',
          '--index-change-reviewed',
          '--writers-paused',
        ].includes(arg) && !/^--(?:input|expected-hash)=/.test(arg),
    )
  )
    throw new Error('Explicit --input=<reviewed-mapping.md> required');
  const mappingApi = require('../services/venue/catalog-costing-mapping');
  const targetUri = mappingApi.requireCatalogCostingUri();
  const mapping = mappingApi.parseCatalogCostingMapping(
    await fs.readFile(input, 'utf8'),
  );
  await mongoose.connect(targetUri, {
    autoIndex: false,
    serverSelectionTimeoutMS: 5000,
  });
  try {
    const api = require('../services/venue/catalog-costing-migration');
    const args = { db: mongoose.connection.db, targetUri, mapping };
    const report = argv.includes('--apply')
      ? await api.applyCatalogCosting({
          ...args,
          expectedHash: argv
            .find((arg) => arg.startsWith('--expected-hash='))
            ?.slice(16),
          mappingReviewed: argv.includes('--mapping-reviewed'),
          indexChangeReviewed: argv.includes('--index-change-reviewed'),
          writersPaused: argv.includes('--writers-paused'),
        })
      : await api.previewCatalogCosting(args);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } finally {
    await mongoose.disconnect();
  }
}
if (require.main === module)
  main().catch((error) => {
    process.stderr.write(
      `Catalogue costing refused: ${error.code || 'MIGRATION_FAILED'}\n`,
    );
    process.exitCode = 1;
  });
module.exports = { main };
