// Sources and scope: docs/superpowers/specs/RESUME-chateau-vartely-subcategories.md
const entries = [
  ['red-wine', 'Saperavi', 'saperavi', 'A deeply coloured red grape used in Château Vartely Individo, Cameo and Taraboste Tribut wines.'],
  ['red-wine', 'Rară Neagră', 'rara-neagra', 'A regional red grape used in Château Vartely Totem and Individo wines.'],
  ['red-wine', 'Fetească Neagră', 'feteasca-neagra', 'A regional red grape bottled in the Totem range and blended in Individo wines.'],
  ['red-wine', 'Red Blend', 'red-blend', 'Red wines combining grape varieties, including Cabernet Sauvignon–Merlot and regional Moldovan blends.'],
  ['white-wine', 'Fetească Regală', 'feteasca-regala', 'A regional white grape bottled in Château Vartely IGP and Totem wines.'],
  ['white-wine', 'Viorica', 'viorica', 'An aromatic Moldovan white grape represented in the Château Vartely Totem range.'],
  ['white-wine', 'White Blend', 'white-blend', 'White wines combining grape varieties, including the Individo blends and Cameo Cuvée Blanc.'],
  ['rose-wine', 'Fetească Neagră Rosé', 'feteasca-neagra-rose', 'Rosé made from Fetească Neagră, represented in Château Vartely Totem.'],
  ['sparkling-wine', 'Brut Sparkling', 'brut-sparkling', 'Dry sparkling wines including Château Vartely Brut White and Inspiro Fetească Regală Brut.'],
  ['fortified-wine', 'Pastoral', 'pastoral', 'A sweet red liqueur wine style represented by Château Vartely Pastoral.'],
  ['fortified-wine', 'Muscat Liqueur Wine', 'muscat-liqueur-wine', 'Sweet Muscat liqueur wines, distinct from the semi-sweet still Muscat range.'],
  ['brandy', 'Divin', 'divin', 'Moldovan brandy made from aged wine distillates, including Château Vartely VSOP and Tribut XO.'],
  ['brandy', 'Grape Brandy', 'grape-brandy', 'Spirits distilled from grape wine, including the Muscat Ottonel spirit Rachia di Moscato.'],
  ['brandy', 'Pomace Brandy', 'pomace-brandy', 'Spirits distilled from grape pomace, including Château Vartely Aqua Vie.'],
  ['brandy', 'Plum Brandy', 'plum-brandy', 'Spirits distilled from fermented plums, including Château Vartely Tramonto.'],
].map(([parent, name, slug, blurb]) => ({ parent, name, slug, blurb }));

const normalize = name => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const mappings = new Map([
  ['Chateau Vartely Taraboste Tribute Saperavi', 'red-wine', 'saperavi'],
  ['Chateau Vartely Divin Tribute XO', 'brandy', 'divin'],
  ['Chateau Vartely Divin VSOP', 'brandy', 'divin'],
  ['Château Vartely Individo Merlot Cabernet Sauvignon', 'red-wine', 'red-blend'],
  ['Chateau Vartely Individo Rara Neagra', 'red-wine', 'rara-neagra'],
  ['Château Vartely Individo Saperavi', 'red-wine', 'saperavi'],
  ['Chateau Vartely Merlot', 'red-wine', 'merlot'],
  ['Chateau Vartely Muscat Moldovenesc Semi-Sweet Red', 'red-wine', 'sweet-red-wine'],
  ['Château Vartely Muscat Moldovenesc Semi-Sweet Rosé', 'rose-wine', 'sweet-rose'],
  ['Château Vartely Muscat Moldovenesc Semi-Sweet White', 'white-wine', 'moscato'],
  ['Chateau Vartely Pastoral', 'fortified-wine', 'pastoral'],
  ['Chateau Vartely Taraboste Cabernet Sauvignon & Merlot 2018', 'red-wine', 'red-blend'],
  ['Chateau Vartely Taraboste Pinot Noir', 'red-wine', 'pinot-noir'],
  ['Château Vartely Totem Rară Neagră 2019', 'red-wine', 'rara-neagra'],
].map(([name, parent, slug]) => [normalize(name), { parent, slug }]));

function classifyProduct(name) {
  const classification = mappings.get(normalize(name));
  if (!classification) throw new Error(`Unreviewed product: ${name}`);
  return classification;
}

function validateExisting(matches, parentId) {
  if (matches.length > 1) throw new Error('Duplicate subcategory matches');
  if (matches[0] && String(matches[0].parent) !== String(parentId)) {
    throw new Error('Subcategory slug belongs to another parent');
  }
}

module.exports = { entries, classifyProduct, validateExisting };
