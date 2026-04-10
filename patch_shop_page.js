const fs = require('fs');
const file = 'client/apps/isomorphic-starter/src/app/shop/page.tsx';
let code = fs.readFileSync(file, 'utf8');

const importStr = "import RecommendedForYou from '@/components/Shop/RecommendedForYou';\n";
const lastImportIndex = code.lastIndexOf('import ');
const eolAfterLastImport = code.indexOf('\n', lastImportIndex);
code = code.slice(0, eolAfterLastImport + 1) + importStr + code.slice(eolAfterLastImport + 1);

const toReplace = `
        <Shop
          productPerPage={12}
          dataType={type}
          data={products}
          productStyle="style-1"
          initialFilters={filterState}
          onFilterChange={handleFilterChange}
          searchQuery={searchQuery}
        />
      </div>
    </>
  );
}`;

const replacement = `
        <Shop
          productPerPage={12}
          dataType={type}
          data={products}
          productStyle="style-1"
          initialFilters={filterState}
          onFilterChange={handleFilterChange}
          searchQuery={searchQuery}
        />
        
        {/* Recommended For You Section */}
        <div className="mt-8">
          <RecommendedForYou maxItems={12} />
        </div>
      </div>
    </>
  );
}`;

code = code.replace(toReplace, replacement);
fs.writeFileSync(file, code);
