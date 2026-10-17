// Pure, snapshot-driven plan. No database or file side effects.
function planTaxonomy({ categories, subcategories }) {
  const category = slug => {
    const matches = categories.filter(c => c.slug === slug);
    if (matches.length !== 1) throw new Error(`Missing or ambiguous category: ${slug}`);
    return matches[0];
  };
  const child = (slug, parent) => {
    const matches = subcategories.filter(s => s.slug === slug);
    if (matches.length > 1) throw new Error(`Ambiguous subcategory: ${slug}`);
    if (matches[0] && String(matches[0].parent) !== String(parent._id)) throw new Error(`Wrong parent for ${slug}`);
    return matches[0];
  };
  const vapes = category('vapes-e-cigarettes'), wine = category('white-wine'), snacks = category('snacks-treats');
  const devices = child('vape-kits-and-devices', vapes), pinot = child('pinot-grigio', wine), nuts = child('nuts-and-seeds', snacks);
  if (!devices || !pinot || !nuts) throw new Error('Missing existing subcategory shelf');
  const cashew = child('cashew-nuts', snacks);
  // Reuse alternate-slug spelling rather than silently duplicating the name.
  if (!cashew && subcategories.some(s => String(s.name).trim().toLowerCase() === 'cashew nuts')) throw new Error('Cashew Nuts exists under another slug; reconcile before creating');
  return {
    creates: cashew ? [] : [{ name: 'Cashew Nuts', slug: 'cashew-nuts', parent: snacks._id, type: 'nuts', subType: 'cashew', status: 'draft', showInMenu: false }],
    mappings: {
      vape: { type: 'vape', categoryId: vapes._id, subCategoryId: devices._id, size: 'unit-single', ageRestricted: true },
      wine: { type: 'white_wine', categoryId: wine._id, subCategoryId: pinot._id, size: '75cl' },
      cashew: { type: 'nuts', categoryId: snacks._id, subCategoryId: cashew?._id || null, size: '240g' },
    },
  };
}
module.exports = { planTaxonomy };
