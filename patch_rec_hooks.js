const fs = require('fs');
const file = 'client/apps/isomorphic-starter/src/components/Shop/RecommendedForYou.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace('}, [maxItems]);', '}, [maxItems, isAuthenticated]);');
fs.writeFileSync(file, code);
