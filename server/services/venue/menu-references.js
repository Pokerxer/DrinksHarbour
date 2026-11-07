'use strict';
// Config and accepted-line reference checks share owned lookups; config remains
// writable only through experience.saveConfiguration's versioned transaction.
const { fail } = require('./errors');
const { id } = require('./eligibility');
async function servingForItem({ tenantId, item, mongoSession }) {
  const snapshot = await require('./servings').servingSnapshot({
    tenantId,
    subProductId: item.subProductId,
    sizeId: item.sizeId,
    mongoSession,
  });
  if (!snapshot)
    fail('INVALID_INPUT', 'Menu v2 requires an explicit venue serving', 400);
  if (snapshot.servingVersion !== item.servingVersion)
    fail('STATE_CHANGED', 'Serving changed; refresh menu configuration');
  return snapshot;
}
async function recipeForItem({
  tenantId,
  item,
  snapshot,
  mongoSession,
  draft = false,
}) {
  if (!item.acceptedRecipeVersionId) {
    if (!draft && ['made_to_order', 'prepared_batch'].includes(snapshot.mode))
      fail('STATE_CHANGED', 'A reviewed output recipe is required');
    return null;
  }
  const recipe = await require('../../models/RecipeVersion')
    .findOne({
      _id: item.acceptedRecipeVersionId,
      tenant: tenantId,
      'output.subProduct': item.subProductId,
      'output.size': item.sizeId,
    })
    .session(mongoSession)
    .lean();
  if (!recipe) fail('NOT_FOUND', 'Output recipe not found', 404);
  if (recipe.supersededBy)
    fail('STATE_CHANGED', 'Recipe changed; refresh menu configuration');
  return String(recipe._id);
}
async function validateMenuReferences({ context, config, mongoSession }) {
  const tenantId = id(context.tenant);
  const locationId = id(context.location);
  for (const section of config.sections) {
    const ids = section.servicePresetIds || [];
    if (
      ids.length &&
      (await require('../../models/VenueServicePreset')
        .countDocuments({
          _id: { $in: ids },
          tenant: tenantId,
          location: locationId,
        })
        .session(mongoSession)) !== ids.length
    )
      fail('NOT_FOUND', 'Service preset not found at this location', 404);
    for (const item of section.items) {
      const snapshot = await servingForItem({ tenantId, item, mongoSession });
      await recipeForItem({
        tenantId,
        item,
        snapshot,
        mongoSession,
        draft: !item.published,
      });
      for (const group of require('./menu-modifiers').groupsOf(item))
        for (const option of group.options) {
          if (option.allowedSizeIds?.length) {
            const count = await require('../../models/Size')
              .countDocuments({
                _id: { $in: option.allowedSizeIds },
                tenant: tenantId,
                subproduct: item.subProductId,
              })
              .session(mongoSession);
            if (count !== option.allowedSizeIds.length)
              fail('NOT_FOUND', 'Modifier portion not found', 404);
          }
          if (option.type === 'instruction') continue;
          const optionSnapshot = await servingForItem({
            tenantId,
            item: option,
            mongoSession,
          });
          await recipeForItem({
            tenantId,
            item: option,
            snapshot: optionSnapshot,
            mongoSession,
          });
          const sp = await require('../../models/SubProduct')
            .findOne({ _id: option.subProductId, tenant: tenantId })
            .select('product')
            .populate('product', 'type catalogKind')
            .session(mongoSession)
            .lean();
          if (!sp) fail('NOT_FOUND', 'Modifier item not found', 404);
          require('./pricing').assertVenueProduct(sp.product);
          if (item.published)
            await require('./pricing').priceVenueLines({
              ...context,
              mongoSession,
              lines: [
                {
                  subProductId: option.subProductId,
                  sizeId: option.sizeId,
                  quantity: 1,
                },
              ],
            });
        }
    }
  }
}
module.exports = { validateMenuReferences, servingForItem, recipeForItem };
