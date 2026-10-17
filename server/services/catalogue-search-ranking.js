'use strict';

const { preprocessQuery, toSearchPattern } = require('./semanticSearch.service');
const normalize = (value) => String(value || '').normalize('NFKD')
  .replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const tokens = (value) => [...new Set(normalize(value).split(/\s+/))]
  .filter((word) => word.length >= 2).slice(0, 10);

// Damerau-Levenshtein also recognizes adjacent transpositions, e.g. "walkre".
function distance(left, right) {
  const a = left.slice(0, 48), b = right.slice(0, 48);
  const rows = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= b.length; j++) rows[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1,
        rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
      }
    }
  }
  return rows[a.length][b.length];
}

function wordScore(query, word) {
  if (query === word) return 1;
  if (word.startsWith(query)) return 0.95;
  if (query.length < 4 || /^\d+$/.test(query)) return 0;
  const edits = distance(query, word);
  return edits <= (query.length >= 7 ? 2 : 1) && edits / Math.max(query.length, word.length) <= 0.3
    ? 1 - edits / Math.max(query.length, word.length) : 0;
}

function coverage(queryWords, field) {
  const words = tokens(field);
  return queryWords.map((query) => Math.max(0, ...words.map((word) => wordScore(query, word))));
}

function rankCatalogueProducts(products, rawQuery) {
  const query = normalize(rawQuery).slice(0, 160);
  const queryWords = tokens(query);
  if (!queryWords.length) return [];
  const expanded = preprocessQuery(query).expandedTerms.map(normalize);

  return products.map((product) => {
    const name = normalize(product.name);
    const nameMatches = coverage(queryWords, name);
    const count = nameMatches.filter(Boolean).length;
    const metadata = [product.type, product.subType, product.brand?.name, product.category?.name,
      product.subCategory?.name, product.originCountry, product.producer,
      ...(product.flavorProfile || []), product.shortDescription].map(normalize).join(' ');
    let score = 0, matchKind = 'related', matchReason = 'Related product';
    if (product.barcode && normalize(product.barcode) === query) {
      score = 10000; matchKind = 'exact'; matchReason = 'Exact barcode';
    } else if (name === query) {
      score = 9000; matchKind = 'exact'; matchReason = 'Exact name';
    } else if (name.startsWith(query)) {
      score = name[query.length] === ' ' ? 8000 : 6500;
      matchKind = 'close'; matchReason = 'Name starts with your search';
    } else if (name.includes(query)) {
      score = 7000; matchKind = 'close'; matchReason = 'Matching name';
    } else if (count === queryWords.length) {
      score = 6000 + nameMatches.reduce((sum, value) => sum + value, 0) * 100;
      matchKind = 'close'; matchReason = nameMatches.every((value) => value === 1)
        ? 'Matching name words' : 'Similar name';
    } else if (count) {
      score = 3000 + (count / queryWords.length) * 1000;
      matchReason = 'Partially matching name';
    } else if (expanded.some((term) => term.length >= 2 && (
      normalize(metadata).includes(term) || coverage(tokens(term), name).every(Boolean)
    ))) {
      score = 2000; matchReason = 'Related brand, type or description';
    }
    return { ...product, matchKind, matchReason, matchScore: score };
  }).filter((product) => product.matchScore > 0)
    .sort((a, b) => b.matchScore - a.matchScore || normalize(a.name).length - normalize(b.name).length || a.name.localeCompare(b.name)
      || String(a._id).localeCompare(String(b._id)));
}

// Bounded, escaped single-edit patterns retrieve candidates even before ranking.
function catalogueNamePattern(rawQuery) {
  const patterns = tokens(rawQuery).filter((word) => word.length <= 32).flatMap((word) => {
    const variants = [toSearchPattern(word)];
    if (word.length >= 4 && !/^\d+$/.test(word)) {
      for (let index = 0; index < word.length; index++) {
        const before = toSearchPattern(word.slice(0, index));
        const after = toSearchPattern(word.slice(index + 1));
        variants.push(`${before}[a-zà-ž]${after}`, `${before}${after}`,
          `${before}[a-zà-ž]${toSearchPattern(word.slice(index))}`);
        if (index < word.length - 1) {
          variants.push(toSearchPattern(word.slice(0, index) + word[index + 1] + word[index] + word.slice(index + 2)));
        }
      }
    }
    return variants.map((pattern) => `(?:^|[\\s&'’._/-])${pattern}`);
  });
  return new RegExp(patterns.join('|') || '(?!)', 'i');
}

module.exports = { rankCatalogueProducts, catalogueNamePattern, normalize };
