'use strict';
const { randomUUID } = require('node:crypto');
const { keys, text, list } = require('./experience-validation');
const { fail, requireId } = require('./errors');
const modifiers = require('./menu-modifiers');
function uuid(value) {
  if (value === undefined) return randomUUID();
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    fail('INVALID_INPUT', 'Menu identity must be a UUID', 400);
  return value.toLowerCase();
}
function label(value, name) {
  const out = text(value, name, 100);
  if (out.length < 2) fail('INVALID_INPUT', `Invalid ${name}`, 400);
  return out;
}
function sort(value = 0) {
  if (!Number.isInteger(value) || value < 0 || value > 100000)
    fail('INVALID_INPUT', 'Invalid sort order', 400);
  return value;
}
function version(value) {
  if (!Number.isSafeInteger(value) || value < 0)
    fail('INVALID_INPUT', 'Serving version required', 400);
  return value;
}
function validateMenuV2(input) {
  keys(input, ['schemaVersion', 'sections', 'categories']);
  if (input.schemaVersion !== 2)
    fail('INVALID_INPUT', 'Menu schema version 2 required', 400);
  const used = new Set();
  const distinct = (value) => {
    if (used.has(value))
      fail('INVALID_INPUT', 'Menu IDs must be distinct', 400);
    used.add(value);
    return value;
  };
  const sections = list(input.sections, 30).map((section) => {
    keys(section, ['id', 'name', 'items', 'servicePresetIds']);
    const out = {
      id: distinct(uuid(section.id)),
      name: label(section.name, 'section name'),
      items: list(section.items, 100),
    };
    if (section.servicePresetIds !== undefined)
      out.servicePresetIds = [
        ...new Set(list(section.servicePresetIds, 10).map(requireId)),
      ];
    return out;
  });
  const sectionIds = new Set(sections.map((s) => s.id));
  const categoryCounts = new Map();
  const categories = list(input.categories, 900).map((category) => {
    keys(category, ['id', 'sectionId', 'parentId', 'name', 'sortOrder']);
    const out = {
      id: distinct(uuid(category.id)),
      sectionId: uuid(category.sectionId),
      parentId: category.parentId == null ? null : uuid(category.parentId),
      name: label(category.name, 'category name'),
      sortOrder: sort(category.sortOrder),
    };
    if (!sectionIds.has(out.sectionId))
      fail('INVALID_INPUT', 'Category section not found', 400);
    categoryCounts.set(
      out.sectionId,
      (categoryCounts.get(out.sectionId) || 0) + 1,
    );
    if (categoryCounts.get(out.sectionId) > 30)
      fail('INVALID_INPUT', 'At most 30 categories per section', 400);
    return out;
  });
  const byId = new Map(categories.map((c) => [c.id, c]));
  for (const category of categories) {
    const visited = new Set([category.id]);
    let current = category;
    let depth = 1;
    while (current.parentId) {
      const parent = byId.get(current.parentId);
      if (
        !parent ||
        parent.sectionId !== category.sectionId ||
        visited.has(parent.id)
      )
        fail(
          'INVALID_INPUT',
          'Category parent missing, cyclic or in another section',
          400,
        );
      visited.add(parent.id);
      if (++depth > 2)
        fail('INVALID_INPUT', 'At most two category levels', 400);
      current = parent;
    }
  }
  const publishedPairs = new Set();
  for (const section of sections) {
    const pairs = new Set();
    section.items = section.items.map((item) => {
      keys(item, [
        'menuItemId',
        'categoryId',
        'subProductId',
        'sizeId',
        'published',
        'display',
        'category',
        'modifierSchemaVersion',
        'modifierGroups',
        'servingVersion',
        'acceptedRecipeVersionId',
      ]);
      const category = byId.get(item.categoryId);
      if (!category || category.sectionId !== section.id)
        fail('INVALID_INPUT', 'Item category not found in section', 400);
      requireId(item.subProductId);
      requireId(item.sizeId);
      if (typeof item.published !== 'boolean')
        fail('INVALID_INPUT', 'Choose menu publication state', 400);
      const pair = `${item.subProductId}:${item.sizeId}`.toLowerCase();
      if (pairs.has(pair))
        fail('INVALID_INPUT', 'Menu items must be distinct', 400);
      pairs.add(pair);
      // Ordering resolves by SubProduct/Size until its input carries menuItemId.
      // Two published contexts would silently choose the last one's choices.
      if (item.published) {
        if (publishedPairs.has(pair))
          fail('INVALID_INPUT', 'A published serving needs one menu placement', 400);
        publishedPairs.add(pair);
      }
      const out = {
        menuItemId: distinct(uuid(item.menuItemId)),
        categoryId: category.id,
        subProductId: item.subProductId,
        sizeId: item.sizeId,
        published: item.published,
        servingVersion: version(item.servingVersion),
        modifierSchemaVersion: 2,
      };
      if (
        item.modifierSchemaVersion !== undefined &&
        item.modifierSchemaVersion !== 2
      )
        fail('INVALID_INPUT', 'Menu v2 requires modifier v2', 400);
      if (item.display !== undefined)
        out.display = text(item.display, 'item display name', 120);
      if (item.category !== undefined)
        out.category = text(item.category, 'legacy item category', 100);
      if (item.modifierGroups !== undefined)
        out.modifierGroups = modifiers.validateModifierGroups(
          item.modifierGroups,
          2,
        );
      if (item.acceptedRecipeVersionId !== undefined)
        out.acceptedRecipeVersionId = requireId(item.acceptedRecipeVersionId);
      return out;
    });
  }
  return { schemaVersion: 2, sections, categories };
}
// This projection is deliberately fail-closed until physical serving availability
// is wired by Tasks 3/9. Price remains the existing venue server's responsibility.
module.exports = {
  validateMenuV2,
  publicMenuV2: require('./menu-projection-v2').publicMenuV2,
  uuid,
};
