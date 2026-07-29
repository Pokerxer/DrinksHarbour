/**
 * The single place the storefront turns a product into the identifiers a cart
 * line needs: which SubProduct, which Size, which Tenant.
 *
 * Why this module exists: `POST /api/cart/validate` resolves every line with
 * `Size.findOne({ _id: sizeId, subproduct: subProductId })` and reports the
 * line as `unavailable` when that misses — which /cart and ModalCart render as
 * a red **"Out of Stock"** badge. Call sites that sent a real `subProductId`
 * next to a blank `sizeId` therefore made fully-stocked products read as sold
 * out. Others sent neither id, so validation skipped the line entirely and the
 * shopper only discovered the problem at checkout.
 *
 * The invariant both failures broke: **a cart line carries either both ids,
 * taken from the same `availableAt` entry, or neither.** That is what this
 * function guarantees.
 *
 * Shape note: on every /api/products* response `availableAt[n]._id` is the
 * SubProduct _id (product.service.js maps `_id: subProduct._id`), `sizes[n]._id`
 * is the Size _id, and `tenant._id` is the Tenant _id. The `fields=card`
 * projection keeps all three.
 */

/**
 * First in-stock size, falling back to the first when all are sold out.
 *
 * Deliberately a copy of `pickDefaultSizeFrom` in ./default-variant rather than
 * an import: that module is loaded by plain `node --experimental-strip-types`
 * from the server-rendered product page, and an extensionless import of it
 * cannot be resolved there. `cart-line.test.mjs` asserts the two stay in step.
 */
const firstInStock = <T extends { stock?: number }>(sizes: T[]): T | null =>
  sizes.length ? sizes.find((s) => (s?.stock ?? 0) > 0) ?? sizes[0] : null;

export interface CartLine {
  subProductId: string;
  sizeId: string;
  tenantId: string;
  vendorName: string;
  size: string;
  price?: number;
}

export interface ResolveCartLineOptions {
  /** Tenant _id the shopper picked in a vendor switcher, if any. */
  vendorId?: string | null;
  /** Size label ("70cl") the shopper picked, if any. */
  size?: string | null;
}

/**
 * Resolve the cart-line identifiers for `product`.
 *
 * Vendor choice: the requested `vendorId`, else the first vendor stocking the
 * requested `size`, else the first vendor. Size choice: the requested label
 * within that vendor, else the first in-stock size (`pickDefaultSizeFrom`, the
 * same rule the product page uses to pick its default variant).
 *
 * Returns `null` — never a partial line — when the product has no vendors or
 * the chosen vendor/size is missing an `_id`. Callers should then add the item
 * with no ids rather than with half of them.
 */
export function resolveCartLine(
  product: any,
  options: ResolveCartLineOptions = {},
): CartLine | null {
  const vendors: any[] = Array.isArray(product?.availableAt) ? product.availableAt : [];
  if (!vendors.length) return null;

  const { vendorId, size: wantedSize } = options;

  const vendor =
    (vendorId && vendors.find((v) => v?.tenant?._id === vendorId)) ||
    (wantedSize && vendors.find((v) => v?.sizes?.some((s: any) => s?.size === wantedSize))) ||
    vendors[0];

  const sizes: any[] = Array.isArray(vendor?.sizes) ? vendor.sizes : [];
  const chosen =
    (wantedSize && sizes.find((s) => s?.size === wantedSize)) || firstInStock<any>(sizes);

  // Both ids or neither — a subProductId without its sizeId reads as "Out of
  // Stock" at validation, which is worse than an unvalidated line.
  if (!vendor?._id || !chosen?._id) return null;

  return {
    subProductId: String(vendor._id),
    sizeId: String(chosen._id),
    tenantId: vendor.tenant?._id ? String(vendor.tenant._id) : '',
    vendorName: vendor.tenant?.name || '',
    size: chosen.size || '',
    price: chosen.pricing?.websitePrice,
  };
}
