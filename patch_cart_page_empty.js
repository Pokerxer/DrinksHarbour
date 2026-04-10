const fs = require('fs');
const file = 'client/apps/isomorphic-starter/src/app/cart/page.tsx';
let code = fs.readFileSync(file, 'utf8');

const emptyReplace = `
            <Link
              href="/shop"
              className="inline-flex items-center gap-2 px-6 sm:px-8 py-3 bg-gray-900 text-white font-semibold rounded-xl hover:bg-gray-800 transition-colors"
            >
              <Icon.PiStorefront size={20} />
              Start Shopping
            </Link>
          </div>
        </div>
      </div>
    );
  }`;

const emptyReplacement = `
            <Link
              href="/shop"
              className="inline-flex items-center gap-2 px-6 sm:px-8 py-3 bg-gray-900 text-white font-semibold rounded-xl hover:bg-gray-800 transition-colors"
            >
              <Icon.PiStorefront size={20} />
              Start Shopping
            </Link>
          </div>
          
          {/* Recommended For You Section - Empty Cart */}
          <div className="mt-8 mb-8 max-w-7xl mx-auto">
            <RecommendedForYou maxItems={6} />
          </div>
        </div>
      </div>
    );
  }`;

code = code.replace(emptyReplace, emptyReplacement);

// Fix the undefined isMounted from earlier
code = code.replace(
  '{!isMounted || cartCount > 0 ? (',
  '{isClient ? ('
);

fs.writeFileSync(file, code);
