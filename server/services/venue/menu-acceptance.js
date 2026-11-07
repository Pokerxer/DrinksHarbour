'use strict';
const { fail } = require('./errors');
const { id } = require('./eligibility');
const modifiers = require('./menu-modifiers');
const refs = require('./menu-references');
function acceptedChoiceKey(line) {
  return line.choices?.length ? `c:${modifiers.choiceSignature(line.choices)}` : line.choiceKey || 'p';
}
function sameAcceptedMetadata(left, right) {
  const plain = row => row.toObject ? row.toObject() : row;
  return require('node:util').isDeepStrictEqual(acceptedMetadata(plain(left)), acceptedMetadata(plain(right)));
}
function normalizeQuantities(choices) {
  const result = new Map();
  for (const choice of choices || []) {
    const k = modifiers.choiceIdentity(choice.groupId, choice.optionId);
    const existing = result.get(k);
    if (existing) existing.quantity += choice.quantity ?? 1;
    else result.set(k, { ...choice, quantity: choice.quantity ?? 1 });
  }
  return [...result.values()];
}
async function acceptMenuItem({
  item,
  unit,
  context,
  menuConfigVersion,
  mongoSession,
}) {
  if (!item || item.modifierSchemaVersion !== 2)
    fail('STATE_CHANGED', 'The accepted portion is no longer offered');
  if (unit.servingVersion !== item.servingVersion)
    fail('STATE_CHANGED', 'Portion changed; reload before adding units');
  const tenantId = id(context.tenant);
  const servingSnapshot = await refs.servingForItem({
    tenantId,
    item,
    mongoSession,
  });
  const acceptedRecipeVersionId = await refs.recipeForItem({
    tenantId,
    item,
    snapshot: servingSnapshot,
    mongoSession,
  });
  const choices = modifiers.assertValidSelection(item, unit.choices);
  const groups = modifiers.groupsOf(item);
  const choiceSnapshots = [];
  for (const choice of choices) {
    const group = groups.find((g) => g.id === choice.groupId);
    const option = group.options.find((o) => o.id === choice.optionId);
    const snapshot = {
      ...choice,
      label: option.label,
      groupName: group.name,
      groupVersion: group.version,
      type: option.type,
    };
    if (option.type === 'instruction') snapshot.unitPriceMinor = 0;
    else {
      const servingSnapshot = await refs.servingForItem({
        tenantId,
        item: option,
        mongoSession,
      });
      const recipe = await refs.recipeForItem({
        tenantId,
        item: option,
        snapshot: servingSnapshot,
        mongoSession,
      });
      if (recipe) snapshot.acceptedRecipeVersionId = recipe;
      const [line] = await require('./pricing').priceVenueLines({
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
      Object.assign(snapshot, {
        subProductId: option.subProductId,
        sizeId: option.sizeId,
        servingSnapshot,
        unitPriceMinor: line.unitPriceMinor,
        componentRole: 'extra',
      });
    }
    choiceSnapshots.push(snapshot);
  }
  return {
    choices: choices.length ? choices : undefined,
    choiceSnapshots,
    servingSnapshot,
    menuConfigVersion,
    menuItemId: item.menuItemId,
    categoryId: item.categoryId,
    ...(acceptedRecipeVersionId ? { acceptedRecipeVersionId } : {}),
  };
}
function addonUnits(snapshots, quantity) {
  return (snapshots || [])
    .filter((s) => s.type === 'addon')
    .map((s) => ({
      subProductId: s.subProductId,
      sizeId: s.sizeId,
      quantity: quantity * s.quantity,
      choiceKey: 'p',
      servingSnapshot: s.servingSnapshot,
      ...(s.acceptedRecipeVersionId
        ? { acceptedRecipeVersionId: s.acceptedRecipeVersionId }
        : {}),
    }));
}
function acceptedMetadata(unit) {
  const out = {};
  for (const k of [
    'servingSnapshot',
    'menuConfigVersion',
    'menuItemId',
    'categoryId',
    'acceptedRecipeVersionId',
    'choiceSnapshots',
  ])
    if (unit[k] !== undefined) out[k] = unit[k];
  return out;
}
module.exports = {
  normalizeQuantities,
  acceptMenuItem,
  addonUnits,
  acceptedMetadata,
  acceptedChoiceKey,
  sameAcceptedMetadata,
};
