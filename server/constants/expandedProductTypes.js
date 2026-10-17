const { generalTypes } = require('./generalProductTypes');
// Additive catalog types. Existing values remain valid for historic products.
const expandedTypes = [
  ['syrup','Syrup','MIXERS',false],
  ['flavoured_syrup','Flavoured Syrup','MIXERS',false],
  ['fruit_syrup','Fruit Syrup','MIXERS',false],
  ['sugar_free_syrup','Sugar-Free Syrup','MIXERS',false],
  ['fruit_puree','Fruit Purée','MIXERS',false],
  ['fruit_mix','Fruit Mix','MIXERS',false],
  ['juice_concentrate','Juice Concentrate','MIXERS',false],
  ['beverage_concentrate','Beverage Concentrate','MIXERS',false],
  ['cocktail_mix','Cocktail Mix','MIXERS',false],
  ['dessert_sauce','Dessert & Drink Sauce','MIXERS',false],
  ['frappe_mix','Frappé & Smoothie Base','MIXERS',false],
  ['malt_drink','Non-Alcoholic Malt Drink','SOFT_DRINKS',false],
  ['palm_wine','Palm Wine','WINE',true],
  ['rice_wine','Rice Wine','WINE',true],
  ['shochu','Shochu','SPIRITS',true],
  ['baijiu','Baijiu','SPIRITS',true],
  ['cordial','Cordial','MIXERS',false],
  ['shrub','Shrub','MIXERS',false],
].map(([value,label,group,alcoholic])=>({value,label,group,alcoholic,beverage:true})).concat(generalTypes);
const expandedTypeValues=expandedTypes.map(t=>t.value);
module.exports={expandedTypes,expandedTypeValues};
