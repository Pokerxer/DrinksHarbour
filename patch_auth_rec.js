const fs = require('fs');
const file = 'client/apps/isomorphic-starter/src/components/Shop/RecommendedForYou.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace("await fetch('/api/auth/session')", "await fetch('/api/auth/me')");
code = code.replace("const session = await response.json();\n        setIsAuthenticated(!!session?.user);", "const data = await response.json();\n        setIsAuthenticated(!!data.user);");

fs.writeFileSync(file, code);
