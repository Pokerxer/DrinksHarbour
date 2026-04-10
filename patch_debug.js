const fs = require('fs');
const file = 'client/apps/isomorphic-starter/src/components/Shop/RecommendedForYou.tsx';
let code = fs.readFileSync(file, 'utf8');

// Add debug logging to fetchRecommendations
code = code.replace(
  'const fetchRecommendations = useCallback(async (auth: boolean) => {',
  'const fetchRecommendations = useCallback(async (auth: boolean) => {\n    console.log("DEBUG: fetchRecommendations called, auth=", auth);'
);

// Add debug to normalizeProducts
code = code.replace(
  'const normalizeProducts = (data: any): any[] => {',
  'const normalizeProducts = (data: any): any[] => {\n    console.log("DEBUG normalizeProducts input:", JSON.stringify(data).substring(0, 200));'
);

code = code.replace(
  "return [];",
  "console.log(\"DEBUG normalizeProducts returning:\", result.length, \"items\");\n    return result;"
);

fs.writeFileSync(file, code);
console.log('Debug added');
