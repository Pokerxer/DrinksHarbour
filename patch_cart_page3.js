const fs = require('fs');
const file = 'client/apps/isomorphic-starter/src/app/cart/page.tsx';
let code = fs.readFileSync(file, 'utf8');

const toReplace = `
            </div>
          </div>
        </div>
      </div>

      {/* Clear Cart Confirmation Modal */}`;

const replacement = `
            </div>
          </div>
        </div>
      </div>

      {/* Recommended For You */}
      {!isMounted || cartCount > 0 ? (
        <div className="mt-8 mb-8 max-w-7xl mx-auto px-4">
          <RecommendedForYou maxItems={6} />
        </div>
      ) : null}

      {/* Clear Cart Confirmation Modal */}`;

if (code.includes(toReplace)) {
  code = code.replace(toReplace, replacement);
  fs.writeFileSync(file, code);
  console.log('Replaced correctly');
} else {
  console.log('Could not find string to replace');
}
