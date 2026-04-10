const fs = require('fs');
const file = 'client/apps/isomorphic-starter/src/components/Shop/RecommendedForYou.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  'const init = async () => {',
  'const init = async () => {\n    console.log("DEBUG init called");'
);

code = code.replace(
  'const response = await fetch(\'/api/auth/me\');',
  'console.log("DEBUG: checking auth...");\n        const response = await fetch(\'/api/auth/me\');'
);

fs.writeFileSync(file, code);
