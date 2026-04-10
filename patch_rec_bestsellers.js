const fs = require('fs');
const file = 'server/services/product.service.js';
let code = fs.readFileSync(file, 'utf8');

// Replace return await getBestsellers(1, limit);
// with const best = await getBestsellers(1, limit); return best.products || [];

code = code.replace(
  'return await getBestsellers(1, limit);',
  'const best = await getBestsellers(1, limit); return best.products || [];'
);

fs.writeFileSync(file, code);
