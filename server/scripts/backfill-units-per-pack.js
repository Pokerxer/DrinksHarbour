// Backfill Size.unitsPerPack from pack-style size names (pack-6 → 6, case-12 → 12)
// so multi-pack sizes qualify for the tenant pack rate (resolveRevenueRates).
//
// Usage:
//   MONGODB_URI="mongodb+srv://..." node scripts/backfill-units-per-pack.js          # dry run
//   MONGODB_URI="mongodb+srv://..." node scripts/backfill-units-per-pack.js --apply  # write changes
const mongoose = require('mongoose');
const Size = require('../models/Size');

const APPLY = process.argv.includes('--apply');
const PACK_NAME_RX = /^(?:pack|case)-(\d+)$/;

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('Set MONGODB_URI');
  await mongoose.connect(uri);

  const candidates = await Size.find({
    size: { $regex: /^(pack|case)-\d+$/ },
    $or: [{ unitsPerPack: { $in: [null, 1] } }, { unitsPerPack: { $exists: false } }],
  })
    .select('_id size unitsPerPack')
    .lean();

  const ops = [];
  const bySize = {};
  for (const s of candidates) {
    const units = parseInt(s.size.match(PACK_NAME_RX)[1], 10);
    if (!(units >= 2)) continue;
    bySize[s.size] = (bySize[s.size] || 0) + 1;
    ops.push({
      updateOne: {
        filter: { _id: s._id },
        update: { $set: { unitsPerPack: units } },
      },
    });
  }

  const totalPackNamed = await Size.countDocuments({ size: { $regex: /^(pack|case)-\d+$/ } });
  const alreadySet = await Size.countDocuments({
    size: { $regex: /^(pack|case)-\d+$/ },
    unitsPerPack: { $gt: 1 },
  });

  console.log(`pack/case-named sizes in DB : ${totalPackNamed}`);
  console.log(`already have unitsPerPack>1 : ${alreadySet}`);
  console.log(`to backfill                 : ${ops.length}`);
  for (const [name, n] of Object.entries(bySize).sort()) console.log(`  ${name}: ${n}`);

  if (APPLY && ops.length) {
    const res = await Size.bulkWrite(ops, { ordered: false });
    console.log(`\nAPPLIED — modified ${res.modifiedCount} sizes`);
  } else if (!APPLY) {
    console.log('\nDRY RUN — re-run with --apply to write');
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
