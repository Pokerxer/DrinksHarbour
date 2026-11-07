#!/usr/bin/env node
'use strict';
// Dry-run unless --apply and all explicit reviewed prerequisites are supplied.
const { main } = require('./preview-venue-catalog-costing');
if (require.main === module)
  main().catch((error) => {
    process.stderr.write(
      `Catalogue costing refused: ${error.code || 'MIGRATION_FAILED'}\n`,
    );
    process.exitCode = 1;
  });
module.exports = { main };
