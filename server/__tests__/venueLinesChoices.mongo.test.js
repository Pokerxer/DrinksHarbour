'use strict';
// Task 7 of docs/superpowers/plans/2026-10-27-venue-phase-3-s1.md: accepted lines
// freeze a normalized `choices[]` + optional staff `note`, each selected priced
// modifier option expands into its own ordinary bill line, and line merge
// identity becomes sub/size + choice signature (parents never collapse into
// plain lines of the same product; identical parents merge).
const test = require('node:test'); const assert = require('node:assert/strict');
const { uri, connectVenueMongo, fixture, beverage } = require('./helpers/venueMongo');

test('accepted_lines_freeze_choices_note_and_expand_priced_option_lines', { skip: !uri }, async t => {
  await connectVenueMongo(t, 'lines_choices');
  const sessions = require('../services/venue/service-sessions'); await sessions.ensureIndexes();
  await require('../models/VenueLocationProfile').createIndexes();
  const args = await fixture();
  const parent = await beverage(args);
  const tonic = await beverage(args, { currentQuantity: 40 });
  const garnish = await beverage(args);
  const plain = await beverage(args); // menu item WITHOUT modifier groups
  const lime = await beverage(args, { currentQuantity: 15 });
  const groups = [
    { id: 'mixer', name: 'Mixer', required: true, minSelect: 1, maxSelect: 1, incompatibleWith: ['extras'], options: [{ id: 'tonic', label: 'Tonic', subProductId: tonic.subProductId, sizeId: tonic.sizeId }, { id: 'lime', label: 'Lime', subProductId: lime.subProductId, sizeId: lime.sizeId }] },
    { id: 'extras', name: 'Extras', required: false, minSelect: 0, maxSelect: 2, incompatibleWith: ['mixer'], options: [{ id: 'garnish', label: 'Garnish', subProductId: garnish.subProductId, sizeId: garnish.sizeId }] },
  ];
  await require('../models/VenueLocationProfile').create({ tenant: args.tenantId, location: args.locationId, menu: require('../services/venue/experience').validateMenu({ sections: [
    { id: 'cocktails', name: 'Cocktails', items: [{ subProductId: parent.subProductId, sizeId: parent.sizeId, published: true, display: 'Signature Cocktail', category: 'mains', modifierGroups: groups }] },
    { id: 'drinks', name: 'Drinks', items: [{ subProductId: plain.subProductId, sizeId: plain.sizeId, published: true }] },
  ] }) });
  const service = require('../services/venue/lines');
  const visit = await sessions.ensureServiceSession({ ...args, idempotencyKey: 'visit' });
  const command = { tenantId: args.tenantId, sessionId: visit.id, actor: args.actor };
  const parentChoices = [{ groupId: 'mixer', optionId: 'tonic' }];

  // ===== Case 1: required group enforced; a valid selection is accepted, the
  // mixer option is its own ordinary priced line (own SubProduct/Size), the
  // parent freezes normalized choices and a stable lineId.
  await assert.rejects(service.setSessionLines({ ...command, expectedVersion: visit.version, lines: [{ subProductId: parent.subProductId, sizeId: parent.sizeId, quantity: 2 }], idempotencyKey: 'required' }), err => err.code === 'CHOICE_REQUIRED', 'missing required choices must fail with CHOICE_REQUIRED');
  let accepted = await service.setSessionLines({ ...command, expectedVersion: visit.version, lines: [{ subProductId: parent.subProductId, sizeId: parent.sizeId, quantity: 2, choices: parentChoices }], idempotencyKey: 'case1' });
  const frozen = accepted.lines.find(l => l.subProductId === parent.subProductId);
  assert.ok(frozen && frozen.lineId, 'parent line accepted with a stable lineId');
  assert.deepEqual(frozen.choices, [{ groupId: 'mixer', optionId: 'tonic' }]);
  assert.equal(frozen.quantity, 2);
  assert.equal(frozen.unitPriceMinor, 100000);
  const optionLine = accepted.lines.find(l => l.subProductId === tonic.subProductId);
  assert.ok(optionLine, 'mixer option expands into its own line');
  assert.equal(optionLine.quantity, 2, 'option line quantity matches parent quantity');
  assert.equal(optionLine.unitPriceMinor, 100000, 'option priced through the existing rules');
  assert.equal(optionLine.choices, undefined, 'option lines are ordinary lines without choices');

  // ===== Case 3 (before 2, state grows monotonically): identical choices merge —
  // quantity increments with the existing revision-row merge behaviour.
  accepted = await service.setSessionLines({ ...command, expectedVersion: accepted.version, lines: [{ subProductId: parent.subProductId, sizeId: parent.sizeId, quantity: 4, choices: parentChoices }], idempotencyKey: 'case3' });
  const mixerRows = accepted.lines.filter(l => l.subProductId === parent.subProductId);
  assert.equal(mixerRows.reduce((sum, l) => sum + l.quantity, 0), 4, 'identical parent choices merge to quantity 4');
  assert.equal(accepted.lines.filter(l => l.subProductId === tonic.subProductId).reduce((sum, l) => sum + l.quantity, 0), 4, 'identical extra selections merge as ordinary lines');
  assert.ok(mixerRows.every(l => l.lineId), 'each merge row keeps its lineId');

  // ===== Case 2: same parent sub/size with a DIFFERENT choice signature does
  // not collapse — both signatures submitted together stay distinct lines
  // (setSessionLines is a whole-cart set; the batch duplicate check must allow
  // differing choice signatures on the same sub/size).
  accepted = await service.setSessionLines({ ...command, expectedVersion: accepted.version, lines: [
    { subProductId: parent.subProductId, sizeId: parent.sizeId, quantity: 4, choices: parentChoices },
    { subProductId: parent.subProductId, sizeId: parent.sizeId, quantity: 1, choices: [{ groupId: 'mixer', optionId: 'lime' }] },
  ], idempotencyKey: 'case2' });
  const limeParent = accepted.lines.filter(l => l.subProductId === parent.subProductId && l.choices?.length && l.choices[0].optionId === 'lime');
  assert.equal(limeParent.length, 1, 'lime signature is a distinct parent identity');
  assert.deepEqual(limeParent[0].choices, [{ groupId: 'mixer', optionId: 'lime' }]);
  const stillMixer = accepted.lines.filter(l => l.subProductId === parent.subProductId && l.choices?.length && l.choices[0].optionId === 'tonic');
  assert.equal(stillMixer.reduce((sum, l) => sum + l.quantity, 0), 4, 'mixer identity untouched by the lime identity');
  assert.ok(limeParent[0].lineId !== stillMixer[0].lineId, 'distinct signatures cannot share a lineId');
  const limeOption = accepted.lines.find(l => l.subProductId === lime.subProductId);
  assert.equal(limeOption.quantity, 1, 'lime option line created for the lime-signature parent');
  assert.equal(accepted.lines.filter(l => l.subProductId === tonic.subProductId).reduce((sum, l) => sum + l.quantity, 0), 4, 'tonic option rows survive the lime identity');

  // ===== Case 4: non-offered selections / incompatible groups / choices on an
  // item without groups surface the stable codes.
  await assert.rejects(service.setSessionLines({ ...command, expectedVersion: accepted.version, lines: [{ subProductId: parent.subProductId, sizeId: parent.sizeId, quantity: 1, choices: [{ groupId: 'mixer', optionId: 'soda' }] }], idempotencyKey: 'not-offered' }), err => err.code === 'CHOICE_NOT_OFFERED');
  await assert.rejects(service.setSessionLines({ ...command, expectedVersion: accepted.version, lines: [{ subProductId: parent.subProductId, sizeId: parent.sizeId, quantity: 1, choices: [{ groupId: 'mixer', optionId: 'tonic' }, { groupId: 'extras', optionId: 'garnish' }] }], idempotencyKey: 'incompatible' }), err => err.code === 'CHOICE_INCOMPATIBLE');
  await assert.rejects(service.setSessionLines({ ...command, expectedVersion: accepted.version, lines: [{ subProductId: plain.subProductId, sizeId: plain.sizeId, quantity: 1, choices: [{ groupId: 'mixer', optionId: 'tonic' }] }], idempotencyKey: 'no-groups' }), err => err.code === 'INVALID_INPUT');

  // ===== Case 5: staff note is frozen on the parent line and echoed by
  // linesDTO, and never changes the price. (Fresh second visit so the
  // whole-cart set semantics keep earlier histories intact.)
  await assert.rejects(service.setSessionLines({ ...command, expectedVersion: accepted.version, lines: [{ subProductId: plain.subProductId, sizeId: plain.sizeId, quantity: 1, note: 'x'.repeat(201) }], idempotencyKey: 'note-too-long' }), err => err.code === 'INVALID_INPUT', 'note over 200 characters is a shape violation');
  const table2 = await require('../models/POSTable').create({ tenant: args.tenantId, location: args.locationId, name: 'Table 2' });
  const visit2 = await sessions.ensureServiceSession({ ...args, tableIds: [String(table2._id)], expectedTableVersions: [0], idempotencyKey: 'visit2' });
  const command2 = { tenantId: args.tenantId, sessionId: visit2.id, actor: args.actor };
  accepted = await service.setSessionLines({ ...command2, expectedVersion: visit2.version, lines: [
    { subProductId: parent.subProductId, sizeId: parent.sizeId, quantity: 2, choices: parentChoices },
    { subProductId: plain.subProductId, sizeId: plain.sizeId, quantity: 1, note: 'no nuts please' },
  ], idempotencyKey: 'case5' });
  const noted = accepted.lines.find(l => l.subProductId === plain.subProductId);
  const parentRow = accepted.lines.find(l => l.subProductId === parent.subProductId);
  assert.equal(noted.note, 'no nuts please', 'note is stored on the parent line and echoed by linesDTO');
  assert.equal(noted.unitPriceMinor, parentRow.unitPriceMinor, 'note never changes the price');
  assert.equal(noted.choices, undefined, 'plain line keeps no choices');
  assert.deepEqual(parentRow.choices, parentChoices, 'choices parent row still freezes its selections');

  // ===== Case 6: held Order holdMetadata.cartItems carry choices/note/choiceKey
  // so POS surfaces and the allergen handoff see them.
  accepted = await service.setSessionLines({ ...command2, expectedVersion: accepted.version, lines: [
    { subProductId: parent.subProductId, sizeId: parent.sizeId, quantity: 2, choices: parentChoices },
    { subProductId: parent.subProductId, sizeId: parent.sizeId, quantity: 1, choices: [{ groupId: 'mixer', optionId: 'lime' }], note: 'gin only, light ice' },
    { subProductId: plain.subProductId, sizeId: plain.sizeId, quantity: 1, note: 'no nuts please' },
  ], idempotencyKey: 'case6' });
  const hold = (await require('../models/Order').findOne({ _id: accepted.heldOrderId, tenant: args.tenantId, status: 'hold' }).lean());
  const carts = hold.holdMetadata.cartItems;
  const withNote = carts.find(c => c.note === 'gin only, light ice');
  assert.ok(withNote, 'note reaches the held order metadata');
  assert.deepEqual(withNote.choices, [{ groupId: 'mixer', optionId: 'lime' }]);
  assert.equal(withNote.choiceKey, 'c:mixer:lime', 'choiceKey is the stable merge identity of the parent');
  const plainNote = carts.find(c => c.note === 'no nuts please');
  assert.ok(plainNote && plainNote.choices === undefined && plainNote.choiceKey === undefined, 'plain noted line carries note without choice metadata');
  assert.ok(carts.some(c => c.choices?.length && c.choices[0].optionId === 'tonic'), 'mixer parent rows carry frozen choices');
  assert.ok(carts.every(c => c.subProductId !== tonic.subProductId || c.choices === undefined), 'ordinary tonic rows stay without choices');
  assert.ok(carts.every(c => c.subProductId !== lime.subProductId || c.choices === undefined), 'ordinary lime rows stay without choices');
});
