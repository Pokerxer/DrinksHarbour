'use strict';
const { fail } = require('./errors');
const modifiers = require('./menu-modifiers');
async function publicMenuV2({ context, config, mongoSession = null }) {
  const { priceVenueLines } = require('./pricing');
  const sections = [];
  const { id } = require('./eligibility');
  for (const section of config.sections || []) {
    const items = [];
    const presetIds = section.servicePresetIds || [];
    const presets = await require('../../models/VenueServicePreset')
      .find({
        _id: { $in: presetIds },
        tenant: id(context.tenant),
        location: id(context.location),
      })
      .session(mongoSession)
      .lean();
    const hoursOpen =
      presets.length === presetIds.length &&
      require('./menu-hours').sectionHoursOpen({
        profile: context.profile,
        presets,
        at: new Date(),
        timezone: context.location.venueServices?.timezone || 'Africa/Lagos',
      });
    for (const item of section.items || []) {
      if (!item.published) continue;
      try {
        const snapshot = await require('./servings').servingSnapshot({
          tenantId: id(context.tenant),
          subProductId: item.subProductId,
          sizeId: item.sizeId,
          mongoSession,
        });
        if (!snapshot || snapshot.servingVersion !== item.servingVersion)
          continue;
        const [line] = await priceVenueLines({
          ...context,
          mongoSession,
          lines: [
            {
              subProductId: item.subProductId,
              sizeId: item.sizeId,
              quantity: 1,
            },
          ],
        });
        const product = await require('../../models/Product')
          .findOne({ _id: line.product })
          .select('status isPublished submittingTenant isAlcoholic abv')
          .session(mongoSession)
          .lean();
        if (
          !product ||
          !(
            (product.status === 'approved' && product.isPublished === true) ||
            (product.status === 'pending' &&
              id(product.submittingTenant) === id(context.tenant))
          )
        )
          continue;
        const groups = modifiers.publicGroups(modifiers.groupsOf(item));
        for (const group of groups)
          for (const option of group.options) {
            if (option.type === 'instruction') {
              option.unitPriceMinor = 0;
              continue;
            }
            const optSnapshot = await require('./servings').servingSnapshot({
              tenantId: id(context.tenant),
              subProductId: option.subProductId,
              sizeId: option.sizeId,
              mongoSession,
            });
            if (
              !optSnapshot ||
              optSnapshot.servingVersion !== option.servingVersion
            )
              fail('STATE_CHANGED', 'Modifier serving changed');
            const [extra] = await priceVenueLines({
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
            option.unitPriceMinor = extra.unitPriceMinor;
          }
        const availability =
          await require('./serving-availability').getServingAvailability({
            tenantId: id(context.tenant),
            locationId: id(context.location),
            servingSnapshot: snapshot,
            mongoSession,
          });
        items.push({
          menuItemId: item.menuItemId,
          categoryId: item.categoryId,
          subProductId: item.subProductId,
          sizeId: item.sizeId,
          name: line.name,
          display: item.display,
          sizeLabel: snapshot.displayName,
          servingSnapshot: snapshot,
          modifierSchemaVersion: 2,
          modifierGroups: groups,
          unitPriceMinor: line.unitPriceMinor,
          taxMinor: line.taxMinor,
          currency: 'NGN',
          alcoholic: !!product.isAlcoholic,
          abv: product.abv || 0,
          available: hoursOpen && availability.available,
          availabilityReason: hoursOpen ? availability.reason : 'unavailable',
        });
      } catch (error) {
        if (
          ![
            'NOT_FOUND',
            'VENUE_UNSUPPORTED_CART',
            'INVALID_MONEY',
            'STATE_CHANGED',
          ].includes(error.code)
        )
          throw error;
      }
    }
    sections.push({ id: section.id, name: section.name, items });
  }
  return {
    schemaVersion: 2,
    categories: (config.categories || []).map((c) => ({
      id: c.id,
      sectionId: c.sectionId,
      parentId: c.parentId,
      name: c.name,
      sortOrder: c.sortOrder,
    })),
    sections,
  };
}

module.exports = { publicMenuV2 };
