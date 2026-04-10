const fs = require('fs');
const file = 'client/apps/isomorphic-starter/src/app/cart/page.tsx';
let code = fs.readFileSync(file, 'utf8');

const toReplace = `
            </div>
          </div>
        </div>
      )}

      {/* Clear Cart Confirmation Modal */}`;

const replacement = `
            </div>
          </div>
        </div>
      )}

      {/* Recommended For You */}
      {!isMounted || cartCount > 0 ? (
        <div className="mt-12 mb-8">
          <RecommendedForYou maxItems={6} />
        </div>
      ) : null}

      {/* Clear Cart Confirmation Modal */}`;

code = code.replace(toReplace, replacement);
fs.writeFileSync(file, code);
