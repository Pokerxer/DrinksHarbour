// Sources and scope: docs/superpowers/specs/RESUME-monin-subcategories.md
const brandId = '6a5a10d85d61e5374ed3fdc8';
const entries = [
  {parent:'syrup',name:'Herbal & Mint Syrups',slug:'herbal-mint-syrups',create:true,
    blurb:'Herb and mint flavoured syrups for cocktails, mocktails, teas and other drinks.'},
  {parent:'syrup',name:'Confectionery Syrups',slug:'confectionery-syrups',create:true,
    blurb:'Candy-inspired beverage syrups, including bubble gum flavours for mixed and dessert drinks.'},
  {parent:'cocktail-mixers',name:'Fruit Purées & Mixes',slug:'fruit-purees-mixes',create:true,
    blurb:'Concentrated fruit purées and fruit mixes for cocktails, mocktails, smoothies and other prepared drinks.'},
  {parent:'cocktail-mixers',name:'Lemon Juice Concentrates',slug:'lemon-juice-concentrates',create:true,
    blurb:'Lemon juice concentrates used to add citrus acidity and flavour to cocktails, mocktails and lemonades.'},
  {parent:'syrup',slug:'simple-syrup'},
  {parent:'syrup',slug:'fruit-syrups'},
  {parent:'syrup',slug:'flavoured-syrups-coffee'},
  {parent:'liqueurs',slug:'cr-me-de-cassis'},
  {parent:'liqueurs',slug:'triple-sec-orange-liqueurs'},
];
const reviewedProducts = [
  ["6a5a10d85d61e5374ed3fdcb", "Le Liqueur de Monin Blackcurrant", "liqueurs", "cr-me-de-cassis", "fruit_liqueur"],
  ["6ac608ff5a9646ade2907e26", "Blue Curaçao Liqueur Monin", "liqueurs", "triple-sec-orange-liqueurs", "liqueur"],
  ["6ac609015a9646ade2907e55", "Le Fruit de Monin Kiwi Aromes Naturels", "cocktail-mixers", "fruit-purees-mixes", "mixer"],
  ["6ac609045a9646ade2907e86", "Le Fruit De Monin Mango Aromes Naturels", "cocktail-mixers", "fruit-purees-mixes", "mixer"],
  ["6ac609065a9646ade2907ea8", "Le Fruit de Monin Passion Fruit Aromes Naturels", "cocktail-mixers", "fruit-purees-mixes", "mixer"],
  ["6ac609085a9646ade2907ecb", "Le Fruit de Monin Strawberry Arômes Naturels", "cocktail-mixers", "fruit-purees-mixes", "mixer"],
  ["6ac6090a5a9646ade2907efc", "Le Sirop De Monin Blackberry", "syrup", "fruit-syrups", "simple_syrup"],
  ["6ac6090c5a9646ade2907f1e", "Le Sirop de Monin Blue Curacao Aromes Naturels", "syrup", "fruit-syrups", "simple_syrup"],
  ["6ac6090e5a9646ade2907f41", "Le Sirop de Monin Bubble Gum Aromes Naturels", "syrup", "confectionery-syrups", "simple_syrup"],
  ["6ac609105a9646ade2907f64", "Le Sirop de Monin Cane Sugar", "syrup", "simple-syrup", "simple_syrup"],
  ["6ac609125a9646ade2907f95", "Le Sirop de Monin Caramel Aromes Naturels", "syrup", "flavoured-syrups-coffee", "simple_syrup"],
  ["6ac609155a9646ade2907fc5", "Le Sirop de Monin Coconut Aromes Naturels", "syrup", "fruit-syrups", "simple_syrup"],
  ["6ac609165a9646ade2907fe7", "Le Sirop de Monin Green Mint Aromes Naturels", "syrup", "herbal-mint-syrups", "simple_syrup"],
  ["6ac609195a9646ade2908018", "Monin Kiwi Syrup", "syrup", "fruit-syrups", "simple_syrup"],
  ["6ac6091b5a9646ade2908048", "Le Sirop de Monin Lemon Rantcho", "cocktail-mixers", "lemon-juice-concentrates", "mixer"],
  ["6ac6091d5a9646ade290806a", "Le Sirop de Monin Passion Fruit Aromes Naturels", "syrup", "fruit-syrups", "simple_syrup"],
  ["6ac609205a9646ade290809b", "Le Sirop de Monin Peach Aromes Naturels", "syrup", "fruit-syrups", "simple_syrup"],
  ["6ac609215a9646ade29080bd", "Le Sirop de Monin Strawberry Aromes Naturels", "syrup", "fruit-syrups", "simple_syrup"],
  ["6ac609245a9646ade29080ee", "Le Sirop de Monin Triple Sec Curaçao Arômes Naturels", "syrup", "fruit-syrups", "simple_syrup"],
  ["6ac609265a9646ade290811e", "Le Sirop de Monin Vanilla Aromes Naturels", "syrup", "flavoured-syrups-coffee", "simple_syrup"],
  ["6ac609285a9646ade2908140", "Le Sirop de Monin Mango Aromes Naturels", "syrup", "fruit-syrups", "simple_syrup"],
  ["6ac6092a5a9646ade2908163", "Le Sirop de Monin Pineapple Aromes Naturels", "syrup", "fruit-syrups", "simple_syrup"],
  ["6ac6092b5a9646ade290816f", "Triple Sec Liqueur Monin", "liqueurs", "triple-sec-orange-liqueurs", "liqueur"],
].map(([id,name,parent,slug,type]) => ({id,name,parent,slug,type}));
function classifyProduct(name) {
  const p = reviewedProducts.find(p => p.name === name);
  if (!p) throw new Error(`Unreviewed product: ${name}`);
  return {parent:p.parent,slug:p.slug,type:p.type};
}
module.exports = { entries, reviewedProducts, classifyProduct, brandId };
