// Reviewed sources: docs/superpowers/specs/RESUME-perdigoes-subcategories.md
const { validateExisting } = require('./chateau-vartely-subcategories');
const entries = [
  ['red-wine', 'Alicante Bouschet', 'alicante-bouschet', 'A deeply coloured red grape bottled on its own by Monte dos Perdigões and used in Portuguese blends.'],
  ['red-wine', 'Touriga Nacional', 'touriga-nacional', 'A Portuguese red grape represented by Lagar dos Perdigões Touriga Nacional and the estate blends.'],
  ['red-wine', 'Trincadeira', 'trincadeira', 'A Portuguese red grape found in Monte dos Perdigões and Sunblessed wines.'],
  ['red-wine', 'Tinta Caiada', 'tinta-caiada', 'A regional red grape represented in the Monte dos Perdigões rosé blend.'],
  ['white-wine', 'Antão Vaz', 'antao-vaz', 'An Alentejo white grape used in Monte dos Perdigões, Lagar, Tapada, Poliphonia and Sunblessed blends.'],
  ['white-wine', 'Gouveio', 'gouveio', 'A Portuguese white grape blended with Viognier in Monte dos Perdigões wines.'],
  ['white-wine', 'Viosinho', 'viosinho', 'A Portuguese white grape represented in Tapada do Barão Colheita Seleccionada Branco.'],
  ['white-wine', 'Arinto', 'arinto', 'A Portuguese white grape represented in Sunblessed Branco and Poliphonia white blends.'],
  ['white-wine', 'Blanc de Noirs (Still White)', 'still-blanc-de-noirs', 'Still white wines made from red grapes, including Monte dos Perdigões Blanc de Noir from Trincadeira.'],
  ['red-wine', 'Red Blend', 'red-blend', 'Red wines combining grape varieties, including the Portuguese estate blends of Monte dos Perdigões.'],
  ['white-wine', 'White Blend', 'white-blend', 'White wines combining grape varieties, including the Portuguese estate blends of Monte dos Perdigões.'],
  ['rose-wine', 'Blend Rosé', 'blend-rose', 'Rosé wines combining grape varieties, including the Monte dos Perdigões and Tapada rosés.'],
].map(([parent, name, slug, blurb]) => ({ parent, name, slug, blurb }));

const reviewedNames = [
  'Polyphonia Reserve Red Wine',
  'Poliphonia Family Blend Vinho Tinto',
  'Poliphonia Reserve Vinho Tinto',
  'Lagar dos Perdigões Colheita Vinho Tinto',
  'Lagar dos Perdigões Colheita Vinho Branco',
  'Lagar dos Perdigões Reserva Alentejano Vinho Tinto',
  'Monte do Barao Colheita Selectionada Vinho Branco',
  'Monte do Barão Vinho Tinto',
  'Monte do Barao Reserva Vinho Tinto',
  'Monte do Barao Colheita Selectionada Vinho Tinto',
  'Tapada do Barao Colheita Selectionada Vinho Tinto',
  'Monte Dos Perdigoes Vinhas Velhas Tinto',
  'Tapada do Barao Colheita Selectionada Vinho Branco',
  'Monte dos Perdigões Superior Vinho Tinto',
  'Monte dos Perdigões Viognier & Gouveio Vinho Branco',
  'Sunblessed Vinho Tinto',
  'Sunblessed Vinho Branco',
  'Monte Perdigoes Alicante Bouschet Vinho Tinto',
  'Monte dos Perdigoes Colheita Selectionada Vinho Tinto',
  'Monte do Barao Vinho Branco',
];
const excludedNames = ['Digo Samanja'];
const normalize = name => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const mappings = new Map(reviewedNames.map(name => {
  const white = name.includes('Branco');
  const varietal = name.includes('Alicante Bouschet');
  return [normalize(name), { parent: white ? 'white-wine' : 'red-wine',
    slug: varietal ? 'alicante-bouschet' : white ? 'white-blend' : 'red-blend' }];
}));
function classifyProduct(name) {
  const classification = mappings.get(normalize(name));
  if (!classification) throw new Error(`Unreviewed product: ${name}`);
  return classification;
}
module.exports = { entries, classifyProduct, validateExisting, reviewedNames, excludedNames };
