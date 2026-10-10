// Evidence and scope: docs/superpowers/specs/RESUME-zaria-subcategories.md
const reviewedProducts = [
  { id: '6ac23f77bd88e5f3c49c0404', name: '1979 Wine Cocktail Zaria Orange Tangerine' },
  { id: '6ac23f7abd88e5f3c49c0434', name: '1979 Zaria Peach & Pineapple Lightly Sparkling Wine Cocktail' },
];
const entries = [{
  parent: 'sparkling-wine', name: 'Sparkling Wine Cocktails', slug: 'sparkling-wine-cocktails',
  blurb: 'Ready-to-drink wine cocktails with fruit flavours and gentle effervescence, including orange and tangerine or peach and pineapple.',
}];
function classifyProduct(name) {
  if (!reviewedProducts.some(p => p.name === name)) throw new Error(`Unreviewed product: ${name}`);
  return { parent: 'sparkling-wine', slug: 'sparkling-wine-cocktails', type: 'cocktail_ready_to_drink' };
}
module.exports = { entries, classifyProduct, reviewedProducts };
