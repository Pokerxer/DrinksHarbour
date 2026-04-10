const fs = require('fs');
const file = 'client/apps/isomorphic-starter/src/app/cart/page.tsx';
let code = fs.readFileSync(file, 'utf8');

const importStr = "import RecommendedForYou from '@/components/Shop/RecommendedForYou';\n";
const lastImportIndex = code.lastIndexOf('import ');
const eolAfterLastImport = code.indexOf('\n', lastImportIndex);
code = code.slice(0, eolAfterLastImport + 1) + importStr + code.slice(eolAfterLastImport + 1);

const toReplace = `
            </div>
          </div>
        </div>
      </div>
    </>
  );
}`;

const replacement = `
            </div>
          </div>
        </div>
        
        {/* Recommended For You Section */}
        <div className="mt-12 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <RecommendedForYou maxItems={12} />
        </div>
      </div>
    </>
  );
}`;

code = code.replace(toReplace, replacement);
fs.writeFileSync(file, code);
