const fs = require('fs');
const file = 'client/apps/isomorphic-starter/src/app/page.tsx';
let code = fs.readFileSync(file, 'utf8');

// Add import
const importStr = "import RecommendedForYou from '@/components/Shop/RecommendedForYou';\n";
const lastImportIndex = code.lastIndexOf('import ');
const eolAfterLastImport = code.indexOf('\n', lastImportIndex);
code = code.slice(0, eolAfterLastImport + 1) + importStr + code.slice(eolAfterLastImport + 1);

// Replace "Just For You" with RecommendedForYou
const toReplace = `
        {/* Featured Deals */}
        <section className="py-4 bg-gray-100">
          <div className="container mx-auto px-3">
            <FeaturedDeals
              title="Just For You"
              subtitle="Personalized picks based on your preferences"
              limit={12}
            />
          </div>
        </section>`;

const replacement = `
        {/* Personalized Recommendations */}
        <RecommendedForYou maxItems={12} />`;

code = code.replace(toReplace, replacement);

fs.writeFileSync(file, code);
console.log('Successfully patched page.tsx');
