// scripts/fixSchemas.js

const fs = require('fs');
const path = require('path');

const fixes = {
  'models/User.js': {
    search: /email: \{[^}]*index: true,/g,
    replace: (match) => match.replace(', index: true', ''),
  },
  'models/Tenant.js': {
    search: /stripeCustomerId: \{[^}]*index: true,/g,
    replace: (match) => match.replace(', index: true', ''),
  },
  'models/Product.js': {
    search: /barcode: \{[^}]*index: true,/g,
    replace: (match) => match.replace(', index: true', ''),
  },
  'models/SubProduct.js': {
    search: /sku: \{[^}]*index: true,/g,
    replace: (match) => match.replace(', index: true', ''),
  },
  'models/Size.js': {
    search: [
      /sku: \{[^}]*index: true,/g,
      /barcode: \{[^}]*index: true,/g,
      /availability: \{[^}]*index: true,/g,
      /sizeCategory: \{[^}]*index: true,/g,
    ],
    replace: (match) => match.replace(', index: true', ''),
  },
  'models/Category.js': {
    search: /parent: \{[^}]*index: true,/g,
    replace: (match) => match.replace(', index: true', ''),
  },
  'models/Tag.js': {
    search: [
      /isNew: \{/g,
      /name: \{[^}]*index: true,/g,
      /slug: \{[^}]*index: true,/g,
    ],
    replace: (match, index) => {
      if (index === 0) return 'isNewArrival: {';
      return match.replace(', index: true', '');
    },
  },
  'models/Flavor.js': {
    search: [
      /name: \{[^}]*index: true,/g,
      /value: \{[^}]*index: true,/g,
    ],
    replace: (match) => match.replace(', index: true', ''),
  },
  'models/SubCategory.js': {
    search: /isNew: \{/g,
    replace: 'isNewArrival: {',
  },
};

console.log('Fixing schema files...\n');

Object.entries(fixes).forEach(([file, config]) => {
  const filePath = path.join(__dirname, '..', file);
  
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    if (Array.isArray(config.search)) {
      config.search.forEach((searchPattern, index) => {
        content = content.replace(searchPattern, (match) => 
          typeof config.replace === 'function' 
            ? config.replace(match, index) 
            : config.replace
        );
      });
    } else {
      content = content.replace(config.search, config.replace);
    }
    
    fs.writeFileSync(filePath, content);
    console.log(`✓ Fixed ${file}`);
  } catch (error) {
    console.error(`✗ Error fixing ${file}:`, error.message);
  }
});

console.log('\n✅ Schema fixes applied!');