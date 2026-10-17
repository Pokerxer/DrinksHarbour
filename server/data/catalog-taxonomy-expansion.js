// Additive taxonomy, scope and sources in RESUME-catalog-taxonomy-expansion.md.
const categories = [
  ['Ready-to-Drink Cocktails & Coolers','ready-to-drink-cocktails','cocktail','alcoholic','Prepared alcoholic cocktails and coolers, ready to serve without mixing.'],
  ['Non-Alcoholic Alternatives','non-alcoholic-alternatives','non_alcoholic','non_alcoholic','Non-alcoholic alternatives to wine, beer, spirits and cocktails.'],
  ['Sake & Rice Wine','sake-rice-wine','sake','alcoholic','Fermented rice beverages, including sake and regional rice wines.'],
  ['Fermented Drinks','fermented-drinks','fermented_drink','mixed','Fermented drinks including palm wine, mead, kombucha and water kefir.'],
].map(([name,slug,type,alcoholCategory,blurb])=>({name,slug,type,alcoholCategory,shortDescription:blurb}));
const subcategories = [
  ['ready-to-drink-cocktails','Spirit-Based RTD Cocktails','spirit-based-rtd-cocktails','Prepared spirit-based mixed drinks for immediate serving.'],
  ['ready-to-drink-cocktails','Wine-Based RTD Cocktails','wine-based-rtd-cocktails','Prepared cocktails using wine as their alcoholic base.'],
  ['ready-to-drink-cocktails','Alcopops & Coolers','alcopops-coolers','Packaged alcoholic coolers and alcopops in fruit and other flavours.'],
  ['ready-to-drink-cocktails','Hard Seltzers','hard-seltzers','Alcoholic sparkling water drinks with added flavour.'],
  ['ready-to-drink-cocktails','Palm Wine Cocktails','palm-wine-cocktails','Prepared alcoholic cocktails made with palm wine.'],
  ['non-alcoholic-alternatives','Non-Alcoholic Still Wine','non-alcoholic-still-wine','Still non-alcoholic wine alternatives in red, white and rosé styles.'],
  ['non-alcoholic-alternatives','Non-Alcoholic Sparkling Wine','non-alcoholic-sparkling-wine','Sparkling non-alcoholic wine alternatives.'],
  ['non-alcoholic-alternatives','Non-Alcoholic Beer','non-alcoholic-beer','Non-alcoholic alternatives to lager, ale and other beer styles.'],
  ['non-alcoholic-alternatives','Non-Alcoholic Spirits','non-alcoholic-spirits','Spirit-style non-alcoholic alternatives for mixed drinks.'],
  ['non-alcoholic-alternatives','Ready-to-Drink Mocktails','ready-to-drink-mocktails','Prepared non-alcoholic cocktails ready to serve.'],
  ['sake-rice-wine','Junmai Sake','junmai-sake','Sake made from rice, water and koji without added distilled alcohol.'],
  ['sake-rice-wine','Ginjo Sake','ginjo-sake','Ginjo-style sake, including junmai ginjo expressions.'],
  ['sake-rice-wine','Daiginjo Sake','daiginjo-sake','Daiginjo-style sake, including junmai daiginjo expressions.'],
  ['sake-rice-wine','Nigori Sake','nigori-sake','Cloudy sake styles containing fine rice solids.'],
  ['sake-rice-wine','Regional Rice Wines','regional-rice-wines','Fermented rice wines from regional traditions beyond sake.'],
  ['fermented-drinks','Traditional Palm Wine','traditional-palm-wine','Fermented palm sap beverages, distinct from prepared palm wine cocktails.'],
  ['fermented-drinks','Mead & Honey Wine','mead-honey-wine','Fermented honey beverages, including still and sparkling mead.'],
  ['fermented-drinks','Kombucha','kombucha-fermented-tea','Fermented tea drinks, with alcohol content depending on the product.'],
  ['fermented-drinks','Water Kefir','water-kefir','Fermented water-based drinks cultured with water kefir grains.'],
  ['syrup','Sugar-Free Syrups','sugar-free-syrups','Beverage syrups formulated without sugar; consult individual labels for ingredients.'],
  ['syrup','Floral Syrups','floral-syrups','Flower-flavoured syrups, including rose, lavender and elderflower.'],
  ['cocktail-mixers','Beverage Concentrates','beverage-concentrates','Concentrated drink bases intended for dilution or mixing.'],
  ['cocktail-mixers','Coffee Concentrates','coffee-concentrates','Concentrated coffee bases for prepared hot and cold drinks.'],
  ['cocktail-mixers','Tea Concentrates','tea-concentrates','Concentrated tea bases for mixed, iced and hot drinks.'],
  ['cocktail-mixers','Dessert & Drink Sauces','dessert-drink-sauces','Chocolate, caramel and other sauces for drinks and dessert preparation.'],
  ['cocktail-mixers','Frappé & Smoothie Bases','frappe-smoothie-bases','Drink bases and mixes for blended frappés and smoothies.'],
  ['cocktail-mixers','Shrubs & Drinking Vinegars','shrub-vinegar-mixers','Fruit and vinegar preparations used in mixed drinks.'],
  ['functional-drinks','Caffeinated Energy Drinks','caffeinated-energy-drinks','Energy drinks containing caffeine, excluding sugar-free variants grouped separately.'],
  ['functional-drinks','Sugar-Free Energy Drinks','sugar-free-energy-drinks','Sugar-free energy drink variants; check product labels for caffeine and ingredients.'],
  ['functional-drinks','Sports & Electrolyte Drinks','sports-electrolyte-drinks','Drinks formulated with electrolytes for sports and hydration occasions.'],
  ['functional-drinks','Protein & Nutrition Drinks','protein-nutrition-drinks','Prepared drinks containing protein or added nutrition.'],
  ['soft-drinks','Non-Alcoholic Malt Drinks','non-alcoholic-malt-drinks','Non-alcoholic malt beverages, including classic and flavoured styles.'],
  ['juice','Sparkling Fruit Juice','sparkling-fruit-juice','Carbonated fruit juices and sparkling juice blends.'],
].map(([parent,name,slug,blurb])=>({parent,name,slug,blurb,create:true}));
// Existing groups reused for exact reviewed Product assignments.
const existingTargets = [
 ['syrup','fruit-syrups'], ['syrup','flavoured-syrups-coffee'], ['syrup','simple-syrup'],
 ['syrup','herbal-mint-syrups'], ['syrup','confectionery-syrups'],
 ['cocktail-mixers','fruit-purees-mixes'], ['cocktail-mixers','lemon-juice-concentrates'],
].map(([parent,slug])=>({parent,slug}));
module.exports={categories,subcategories,existingTargets};
