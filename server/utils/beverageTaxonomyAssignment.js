// Reviewed legacy beverage-business roots. Shared gifts/snacks, smoking, Beauty
// and Home trees are deliberately not adopted merely because industry is absent.
const BEVERAGE_CATEGORY_SLUGS = new Set([
  'beer', 'red-wine', 'white-wine', 'rose-wine', 'sparkling-wine', 'champagne',
  'wine', 'whiskey', 'scotch', 'bourbon', 'rye-whiskey', 'vodka', 'gin', 'rum',
  'tequila', 'brandy', 'cognac', 'soju', 'baijiu', 'shochu', 'liqueurs',
  'cider-perry', 'coffee', 'tea', 'soft-drinks', 'soda', 'juice', 'water',
  'milk', 'yogurt-drink', 'functional-drinks', 'syrup', 'bitters',
  'irish-whiskey', 'japanese-whisky', 'world-whisky', 'port-wine',
  'fortified-wine', 'ready-to-drink-cocktails', 'non-alcoholic-alternatives',
  'sake-rice-wine', 'fermented-drinks', 'drink-powders-instant-mixes',
  'traditional-non-alcoholic-drinks', 'cocktail-mixers',
  'glassware', 'decanters-carafes', 'bar-tools-equipment', 'wine-accessories',
  'cocktail-serving-accessories', 'drinkware-flasks', 'coolers-ice',
  'coffee-tea-equipment', 'beverage-packaging-supplies',
]);
const unassigned = doc => doc.industry == null || doc.industry === '';
function planBeverageAssignment(categories, subcategories) {
  const adopted = new Set(categories.filter(c => BEVERAGE_CATEGORY_SLUGS.has(c.slug)).map(c => String(c._id)));
  let changed;
  do {
    changed = false;
    for (const category of categories) {
      if (adopted.has(String(category.parent)) && !adopted.has(String(category._id))) {
        adopted.add(String(category._id)); changed = true;
      }
    }
  } while (changed);
  const selected = {
    categories: categories.filter(c => adopted.has(String(c._id))),
    subcategories: subcategories.filter(s => adopted.has(String(s.parent))),
  };
  for (const rows of Object.values(selected)) {
    for (const row of rows) {
      if (!unassigned(row) && row.industry !== 'beverage') throw new Error(`Conflicting industry on ${row.slug || row._id}: ${row.industry}`);
    }
  }
  return {
    categories: selected.categories.filter(unassigned),
    subcategories: selected.subcategories.filter(unassigned),
    totals: { categories: selected.categories.length, subcategories: selected.subcategories.length },
  };
}
module.exports = { BEVERAGE_CATEGORY_SLUGS, planBeverageAssignment };
