const fs = require('fs');
const file = 'client/apps/isomorphic-starter/src/components/Shop/RecommendedForYou.tsx';
let code = fs.readFileSync(file, 'utf8');

// Replace the trending fetch to use local proxy
code = code.replace(
  'const response = await fetchWithTimeout(`${API_URL}/api/products/trending?limit=${maxItems}`);',
  'const response = await fetchWithTimeout(`/api/products/trending?limit=${maxItems}`);'
);

// Replace the bestsellers fetch to use local proxy
code = code.replace(
  'const response = await fetchWithTimeout(`${API_URL}/api/products/bestsellers?limit=${maxItems}`);',
  'const response = await fetchWithTimeout(`/api/products/bestsellers?limit=${maxItems}`);'
);

// Replace the new-arrivals fetch to use local proxy
code = code.replace(
  'const response = await fetchWithTimeout(`${API_URL}/api/products/new-arrivals?limit=${maxItems}`);',
  'const response = await fetchWithTimeout(`/api/products/new-arrivals?limit=${maxItems}`);'
);

fs.writeFileSync(file, code);
console.log('Patched to use local API routes');
