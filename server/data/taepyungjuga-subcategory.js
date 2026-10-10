// Sources and scope: docs/superpowers/specs/RESUME-taepyungjuga-subcategory.md
const productName = 'Taepyungjuga Korean Red Ginseng Wine';
const productId = '6a68c63623bea8db531756e2';
const entries = [{
  parent: 'liqueurs', name: 'Ginseng Liqueur (Insamju)', slug: 'ginseng-liqueur',
  blurb: 'Korean ginseng-infused distilled drinks, including red-ginseng expressions marketed as ginseng wine.',
}];
function classifyProduct(name) {
  if (name !== productName) throw new Error(`Unreviewed product: ${name}`);
  return { parent: 'liqueurs', slug: 'ginseng-liqueur', type: 'liqueur' };
}
module.exports = { entries, classifyProduct, productName, productId };
