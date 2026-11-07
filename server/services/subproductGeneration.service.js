const { isValidObjectId } = require("mongoose");
const { buildPrompt, normalizeDraft } = require("./subproductGenerationPrompt");
const fail = (status, message) => {
  const error = new Error(message);
  error.statusCode = status;
  throw error;
};
function createSubproductGenerator({ Product, SubProduct, generate, model }) {
  return async (req, res) => {
    const {
      productId,
      subProductId,
      inlineContext,
      mode = "content",
      target = "listing",
    } = req.body || {};
    const admin = ["super_admin", "admin"].includes(req.user?.role);
    if (
      !admin &&
      !["tenant_owner", "tenant_admin", "tenant_staff"].includes(req.user?.role)
    )
      fail(403, "Catalog access required");
    if (!["listing", "product"].includes(target))
      fail(400, "Invalid generation target");
    if (target === "product" && !admin)
      fail(403, "Central catalog management requires platform access");
    if (target === "product" && (!productId || subProductId || inlineContext))
      fail(400, "Central drafts require a saved product ID only");
    const tenant = req.user?.tenant?._id || req.user?.tenant;
    if (!admin && !tenant) fail(403, "Tenant context required");
    if (!["content", "seo"].includes(mode))
      fail(400, "Invalid generation mode");
    for (const id of [productId, subProductId])
      if (id && !isValidObjectId(id)) fail(400, "Invalid product identifier");
    let listing = null;
    let targetId = productId;
    if (subProductId) {
      listing = await SubProduct.findOne({
        _id: subProductId,
        ...(!admin ? { tenant } : {}),
      })
        .select("product tenant sizes")
        .populate(
          "sizes",
          "size displayName colorName unitType volumeMl weightGrams unitsPerPack dimensions",
        )
        .lean();
      if (!listing) fail(404, "Subproduct not found");
      targetId = String(listing.product?._id || listing.product);
      if (productId && String(productId) !== targetId)
        fail(400, "Product does not match this listing");
    }
    let product;
    if (targetId) {
      product = await Product.findOne({
        _id: targetId,
        ...(!admin
          ? {
              $or: [
                { publicationScope: { $ne: "tenant_private" } },
                { owningTenant: tenant },
              ],
            }
          : {}),
      })
        .populate("brand", "name")
        .populate("category", "name")
        .populate("subCategory", "name")
        .lean();
      if (!product) fail(404, "Product not found");
    } else {
      if (
        !inlineContext ||
        typeof inlineContext.name !== "string" ||
        !inlineContext.name.trim()
      )
        fail(400, "A product or product name is required");
      product = inlineContext;
    }
    const prompt = buildPrompt(product, listing || {}, mode, target);
    let data;
    try {
      data = normalizeDraft(await generate(prompt), mode, target);
    } catch (error) {
      fail(502, "Unable to generate a complete draft. Please try again.");
    }
    res.json({
      success: true,
      data,
      metadata: {
        productId: targetId || null,
        subProductId: subProductId || null,
        productName: product.name,
        mode,
        target,
        provider: "Anthropic",
        model,
        generatedAt: new Date().toISOString(),
      },
    });
  };
}
module.exports = { createSubproductGenerator };
