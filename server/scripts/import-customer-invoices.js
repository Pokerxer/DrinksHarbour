// Run without --apply first. Requires exactly one tenant; never posts journals.
require('dotenv').config();
const mongoose = require('mongoose');
mongoose.set('autoIndex', false);
const { importInvoices } = require('../services/customerInvoice/import');
async function main() {
  const args = process.argv.slice(2);
  const value = key => args.find(a => a.startsWith(`${key}=`))?.slice(key.length + 1);
  if (!mongoose.isValidObjectId(value('--tenant'))) throw new Error('Use --tenant=<tenant-id> [--apply] [--after=<cursor>] [--limit=5000]');
  await require('../config/db').connectDB();
  if (args.includes('--apply')) {
    await require('../models/CustomerInvoice').createIndexes();
    await require('../models/InvoiceCounter').createIndexes();
  }
  const result = await importInvoices({ tenantId: value('--tenant'), apply: args.includes('--apply'),
    after: value('--after'), limit: value('--limit') });
  console.log(JSON.stringify(result, null, 2));
  if (result.errors.length) process.exitCode = 1;
}
main().catch(err => { console.error(err.message); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
