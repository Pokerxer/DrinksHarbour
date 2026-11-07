'use strict';
const { requireId, fail } = require('./errors');
const { id } = require('./eligibility');
function normalizeMapping(raw) {
  if (raw === undefined) return undefined;
  if (
    !raw ||
    typeof raw !== 'object' ||
    Object.keys(raw).some(
      (key) =>
        ![
          'sourceSubProductId',
          'sourceSizeId',
          'sourceLocationId',
          'contentQuantity',
        ].includes(key),
    )
  )
    fail(
      'INVALID_INPUT',
      'Use stock identity and content only; reviewer is server assigned',
      400,
    );
  for (const key of ['sourceSubProductId', 'sourceSizeId', 'sourceLocationId'])
    requireId(raw[key]);
  require('./cost-math').assertQuantity(raw.contentQuantity);
  return {
    sourceSubProductId: raw.sourceSubProductId,
    sourceSizeId: raw.sourceSizeId,
    sourceLocationId: raw.sourceLocationId,
    contentQuantity: {
      amountScaled: raw.contentQuantity.amountScaled,
      scale: raw.contentQuantity.scale,
      unit: raw.contentQuantity.unit,
    },
  };
}
async function reviewMappings(args, components, mongoSession) {
  if (!components.some((component) => component.stockMapping))
    return components;
  const context = await require('./context').loadVenueContext({
    ...args,
    action: 'experience.manage',
    mongoSession,
  });
  const reviewed = [];
  for (const component of components) {
    if (!component.stockMapping) {
      reviewed.push(component);
      continue;
    }
    const mapping = component.stockMapping;
    if (mapping.sourceLocationId !== args.locationId)
      fail(
        'STOCK_MAPPING_REQUIRED',
        'Review source at the authorized preparation location',
        400,
      );
    const profile = await require('../../models/IngredientProfile')
      .findOne({
        _id: component.profile,
        tenant: args.tenantId,
        subProduct: mapping.sourceSubProductId,
      })
      .session(mongoSession)
      .lean();
    const size = await require('../../models/Size')
      .exists({
        _id: mapping.sourceSizeId,
        tenant: args.tenantId,
        subproduct: mapping.sourceSubProductId,
      })
      .session(mongoSession);
    if (!profile || !size)
      fail('NOT_FOUND', 'Ingredient stock form not found', 404);
    const profileUnit = { mass: 'g', volume: 'ml', count: 'count' }[
      profile.dimension
    ];
    if (profileUnit !== component.unit)
      fail(
        'UNIT_CONVERSION',
        'Use the ingredient’s reviewed base measurement; density conversion needs separate review',
        400,
      );
    if (mapping.contentQuantity.unit !== component.unit)
      fail(
        'UNIT_CONVERSION',
        'Component and stock content require the same reviewed base unit',
        400,
      );
    reviewed.push({
      ...component,
      stockMapping: {
        ...mapping,
        reviewedBy: context.actor.userId,
        reviewedAt: new Date(),
      },
    });
  }
  return reviewed;
}
module.exports = { normalizeMapping, reviewMappings };
