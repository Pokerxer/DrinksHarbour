import type { ProductType } from '@/types/product.types';
import { readOfferProduct, searchOffers } from './catalogue';
import { findLiveOffer, productId, type Offer } from './offers';
import { matchesIngredient, needsKitTaxonomy, type KitRecipe } from './kitRecipes';

export type KitItem = { offer: Offer } | { inCart: string };
export type KitCartLine = ProductType & { selectedProductId?: string; selectedVendorId?: string; tenantId?: string };
type Ingredient = KitRecipe['base'];
type Request = Parameters<typeof searchOffers>[1];

export function getKitContents(recipe: KitRecipe, lines: KitCartLine[]) {
  const optional = recipe.optional;
  return {
    base: lines.find(item => matchesIngredient(item, recipe.base)),
    mixer: lines.find(item => matchesIngredient(item, recipe.mixer)),
    optional: optional ? lines.find(item => matchesIngredient(item, optional)) : undefined,
  };
}

export async function restoreKitTaxonomy(lines: KitCartLine[], request: Request) {
  const products = new Map<string, Promise<ProductType | null>>();
  return Promise.all(lines.map(async line => {
    if (!line.slug || !needsKitTaxonomy(line)) return line;
    let pending = products.get(line.slug);
    if (!pending) {
      pending = readOfferProduct(line.slug, request).catch(() => null);
      products.set(line.slug, pending);
    }
    const product = await pending;
    return product && productId(product) === (line.selectedProductId || productId(line))
      ? { ...line, type: product.type, subType: product.subType, category: product.category,
        subCategory: product.subCategory, isAlcoholic: product.isAlcoholic, abv: product.abv }
      : line;
  }));
}

async function findIngredient(role: Ingredient, sellers: string[], ids: Set<string>, request: Request) {
  const queries = [new URLSearchParams(role.types.map(type => ['type', type]))];
  const subCategories = new Set([...role.types.map(type => type.replaceAll('_', '-')), ...(role.subCategories ?? []), ...(role.searchSubCategories ?? [])]);
  queries.push(new URLSearchParams({ subCategory: [...subCategories].join(',') }));
  const subTypes = new Set(role.types.flatMap(type => [
    type, type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
  ]));
  queries.push(new URLSearchParams([...subTypes].map(type => ['subType', type])));
  if (role.categories?.length) queries.push(new URLSearchParams({ category: role.categories.join(',') }));

  async function search(params: URLSearchParams) {
    if (!role.alcoholic) params.set('isAlcoholic', 'false');
    return searchOffers(params, request).catch(() => []);
  }

  async function check(products: ProductType[], requiredSeller = false) {
    const unique = new Map(products.filter(product => !ids.has(productId(product)) && matchesIngredient(product, role))
      .map(product => [productId(product), product]));
    return findLiveOffer([...unique.values()], sellers, async slug => {
      const current = await readOfferProduct(slug, request);
      return current && matchesIngredient(current, role) ? current : null;
    }, request.signal, { requiredSeller });
  }

  const typed = await Promise.all(queries.map(search));
  const exactOffer = await check(typed.flat());
  if (request.signal.aborted || exactOffer && (!sellers.length || sellers.includes(exactOffer.seller.tenant._id))) {
    return exactOffer;
  }
  const legacyParams = new URLSearchParams({ q: role.query });
  if (exactOffer && sellers.length === 1) {
    const scoped = [...queries, legacyParams].map(params => {
      const query = new URLSearchParams(params);
      query.set('tenantId', sellers[0]);
      return search(query);
    });
    return await check((await Promise.all(scoped)).flat(), true) ?? exactOffer;
  }
  return await check(await search(legacyParams), Boolean(exactOffer)) ?? exactOffer;
}

export async function resolveDrinkKit(recipe: KitRecipe, lines: KitCartLine[], request: Request) {
  const contents = getKitContents(recipe, lines);
  const ids = new Set(lines.map(item => item.selectedProductId || productId(item)));
  const sellers = [...new Set(lines.flatMap(item => {
    const seller = item.selectedVendorId || item.tenantId;
    return seller ? [seller] : [];
  }))];

  const baseOffer = contents.base ? undefined : await findIngredient(recipe.base, sellers, ids, request);
  if ((!contents.base && !baseOffer) || request.signal.aborted) return null;
  if (baseOffer) ids.add(productId(baseOffer.product));
  const baseSeller = contents.base?.selectedVendorId || contents.base?.tenantId || baseOffer?.seller.tenant._id;
  const preferred = baseSeller ? [baseSeller] : sellers;

  const mixerOffer = contents.mixer ? undefined : await findIngredient(recipe.mixer, preferred, ids, request);
  if ((!contents.mixer && !mixerOffer) || request.signal.aborted) return null;
  if (mixerOffer) ids.add(productId(mixerOffer.product));
  const optionalOffer = recipe.optional && !contents.optional
    ? await findIngredient(recipe.optional, preferred, ids, request)
    : undefined;

  const items: KitItem[] = [];
  for (const [existing, offer] of [[contents.base, baseOffer], [contents.mixer, mixerOffer], [contents.optional, optionalOffer]] as const) {
    if (existing) items.push({ inCart: existing.name });
    else if (offer) items.push({ offer });
  }
  const missing = items.flatMap(item => 'offer' in item ? [item.offer] : []);
  return {
    recipe, items, missing,
    present: items.length - missing.length,
    sameSeller: !!baseSeller && missing.every(offer => offer.seller.tenant._id === baseSeller),
  };
}
