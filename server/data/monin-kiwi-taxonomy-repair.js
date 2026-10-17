// Forward-only repair after concurrent catalog rename; see Monin session handoff.
const original = require('./monin-subcategories');
const reviewedProducts = original.reviewedProducts.map(p => p.id === '6ac609195a9646ade2908018'
  ? {...p,name:'Le Sirop de Monin Kiwi'} : {...p});
function classifyProduct(name) {
  const p=reviewedProducts.find(p=>p.name===name);
  if(!p) throw new Error(`Unreviewed product: ${name}`);
  return {parent:p.parent,slug:p.slug,type:p.type};
}
module.exports = {...original,reviewedProducts,classifyProduct};
