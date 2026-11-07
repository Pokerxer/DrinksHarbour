'use strict';
// Pure tests for venue menu modifier groups (Phase 3 S1 Task 4).
// run: cd server && node --test '__tests__/venueMenuModifiers.test.js'
const test = require('node:test');
const assert = require('node:assert/strict');
const m = require('../services/venue/menu-modifiers');

// requireId enforces 24-hex Mongo ids on option pricing references.
const SP_TONIC = '507f1f77bcf86cd799439011';
const SZ_TONIC = '507f1f77bcf86cd799439012';
const SP_SODA = '507f1f77bcf86cd799439013';
const SZ_SODA = '507f1f77bcf86cd799439014';
const SP_GARNISH = '507f1f77bcf86cd799439015';
const SZ_GARNISH = '507f1f77bcf86cd799439016';

const mixerGroup = (over = {}) => ({
  id: 'mixer',
  name: 'Mixer',
  required: true,
  minSelect: 1,
  maxSelect: 1,
  incompatibleWith: ['extras'],
  options: [
    { id: 'tonic', label: 'Tonic Water', subProductId: SP_TONIC, sizeId: SZ_TONIC },
    { id: 'soda', label: 'Soda Water', subProductId: SP_SODA, sizeId: SZ_SODA },
  ],
  ...over,
});
const extrasGroup = (over = {}) => ({
  id: 'extras',
  name: 'Extras',
  required: false,
  minSelect: 0,
  maxSelect: 2,
  incompatibleWith: ['mixer'],
  options: [{ id: 'garnish', label: 'Lime Garnish', subProductId: SP_GARNISH, sizeId: SZ_GARNISH }],
  ...over,
});
const item = (groups) => ({ modifierGroups: m.validateModifierGroups(groups) });

test('validateModifierGroups normalizes groups and applies defaults', () => {
  const [mixer, extras] = m.validateModifierGroups([mixerGroup(), extrasGroup()]);
  assert.equal(mixer.id, 'mixer');
  assert.equal(mixer.required, true);
  assert.equal(mixer.minSelect, 1);
  assert.equal(mixer.maxSelect, 1);
  assert.deepEqual(mixer.incompatibleWith, ['extras']);
  assert.deepEqual(mixer.options[0], { id: 'tonic', label: 'Tonic Water', subProductId: SP_TONIC, sizeId: SZ_TONIC });
  assert.equal(extras.required, false);
  assert.equal(extras.minSelect, 0);
  assert.equal(extras.maxSelect, 2);
  // Defaults: required groups default minSelect 1/maxSelect 1; optional lists trim
  // incompatibleWith to a validated array.
  const defaults = m.validateModifierGroups([{ id: 'size', name: 'Size', options: [{ id: 'large', label: 'Large', subProductId: SP_TONIC, sizeId: SZ_TONIC }] }])[0];
  assert.equal(defaults.required, true);
  assert.equal(defaults.minSelect, 1);
  assert.equal(defaults.maxSelect, 1);
  assert.deepEqual(defaults.incompatibleWith, []);
  assert.deepEqual(m.validateModifierGroups([]), []);
});

test('validateModifierGroups rejects bad shapes', () => {
  assert.throws(() => m.validateModifierGroups([mixerGroup({ options: [] })]), /options/i);
  assert.throws(() => m.validateModifierGroups([mixerGroup({ required: true, minSelect: 0 })]), /Required/);
  assert.throws(() => m.validateModifierGroups([mixerGroup({ minSelect: 2, maxSelect: 1 })]), /exceeds/i);
  assert.throws(() => m.validateModifierGroups([mixerGroup({ options: [mixerGroup().options[0], mixerGroup().options[0]] })]), /distinct/i);
  assert.throws(() => m.validateModifierGroups([mixerGroup({ extra: true })]), /Unsupported/);
  assert.throws(() => m.validateModifierGroups('mixer'), /list/i);
});

test('assertValidSelection accepts selections satisfying required and optional groups', () => {
  // Compatibility-free variants: the shared fixture makes mixer/extras mutually
  // exclusive (asserted in the incompatible-combination test below).
  const it = item([mixerGroup({ incompatibleWith: [] }), extrasGroup({ incompatibleWith: [] })]);
  assert.deepEqual(m.assertValidSelection(it, [{ groupId: 'mixer', optionId: 'tonic' }]), [{ groupId: 'mixer', optionId: 'tonic' }]);
  // Required mixer + optional extras together are fine for the priced expansion path.
  assert.deepEqual(
    m.assertValidSelection(it, [{ groupId: 'extras', optionId: 'garnish' }, { groupId: 'mixer', optionId: 'soda' }]),
    [{ groupId: 'extras', optionId: 'garnish' }, { groupId: 'mixer', optionId: 'soda' }],
  );
  assert.deepEqual(m.assertValidSelection(it, [{ groupId: 'mixer', optionId: 'tonic' }, { groupId: 'extras', optionId: 'garnish' }]),
    [{ groupId: 'mixer', optionId: 'tonic' }, { groupId: 'extras', optionId: 'garnish' }]);
});

test('assertInvalid: missing required selection', () => {
  const it = item([mixerGroup(), extrasGroup()]);
  assert.equal(m.assertInvalid(it, 'empty order', []), 'CHOICE_REQUIRED');
  assert.deepEqual(m.assertValidSelection(item([extrasGroup()]), []), []);
});

test('assertInvalid: unknown group or unknown option is not offered', () => {
  const it = item([mixerGroup(), extrasGroup()]);
  assert.equal(m.assertInvalid(it, 'unknown group', [{ groupId: 'nope', optionId: 'tonic' }]), 'CHOICE_NOT_OFFERED');
  assert.equal(m.assertInvalid(it, 'unknown option', [{ groupId: 'mixer', optionId: 'missing' }]), 'CHOICE_NOT_OFFERED');
});

test('assertInvalid: exceeding maxSelect per group', () => {
  const it = item([mixerGroup(), extrasGroup()]);
  // mixer allows 1 selection; both mixer options exceed it.
  assert.equal(m.assertInvalid(it, 'over max', [{ groupId: 'mixer', optionId: 'tonic' }, { groupId: 'mixer', optionId: 'soda' }]), 'INVALID_INPUT');
  // extras allows 2 but only has one option — duplicate selections still count per group.
  // (A valid mixer selection is included so the required check passes and the
  // over-max check on extras is what fires.)
  assert.equal(m.assertInvalid(it, 'dup extras', [{ groupId: 'mixer', optionId: 'tonic' }, { groupId: 'extras', optionId: 'garnish' }, { groupId: 'extras', optionId: 'garnish' }, { groupId: 'extras', optionId: 'garnish' }]), 'INVALID_INPUT');
});

test('assertInvalid: incompatible combination', () => {
  const it = item([mixerGroup(), extrasGroup()]);
  assert.equal(m.assertInvalid(it, 'clash', [{ groupId: 'mixer', optionId: 'tonic' }, { groupId: 'extras', optionId: 'garnish' }]), 'CHOICE_INCOMPATIBLE');
});

test('assertInvalid: item with no groups rejects any selection, accepts none', () => {
  const plain = item([]);
  assert.equal(m.assertInvalid(plain, 'stray choice', [{ groupId: 'mixer', optionId: 'tonic' }]), 'INVALID_INPUT');
  assert.equal(m.assertInvalid(plain, 'plain line', []), null);
  assert.equal(m.assertInvalid(plain, 'plain line', undefined), null);
});

test('assertInvalid returns null for a valid selection and the code for each failure', () => {
  const it = item([mixerGroup()]);
  assert.equal(m.assertInvalid(it, 'good', [{ groupId: 'mixer', optionId: 'tonic' }]), null);
});

test('choiceSignature is a sorted, stable identity', () => {
  const a = [{ groupId: 'mixer', optionId: 'tonic' }, { groupId: 'extras', optionId: 'garnish' }];
  assert.equal(m.choiceSignature(a), 'extras:garnish|mixer:tonic');
  assert.equal(m.choiceSignature([...a].reverse()), 'extras:garnish|mixer:tonic');
  assert.equal(m.choiceSignature([{ groupId: 'mixer', optionId: 'soda' }]), 'mixer:soda');
  assert.equal(m.choiceSignature([]), '');
  assert.equal(m.choiceSignature(undefined), '');
});

const v2 = (over={}) => ({modifierSchemaVersion:2,sizeId:SZ_TONIC,modifierGroups:[{id:'extras',name:'Protein',required:false,minSelect:1,maxSelect:4,options:[{id:'chicken',label:'Extra chicken',type:'addon',subProductId:SP_GARNISH,sizeId:SZ_GARNISH,allowedSizeIds:[SZ_TONIC],servingVersion:0}]}],...over});
test('v2 minimum applies to optional groups and repeated options normalize quantities',()=>{
  assert.throws(()=>m.assertValidSelection(v2(),[]),e=>e.code==='CHOICE_REQUIRED');
  const chosen=m.assertValidSelection(v2(),[{groupId:'extras',optionId:'chicken',quantity:2},{groupId:'extras',optionId:'chicken'}]);
  assert.deepEqual(chosen,[{groupId:'extras',optionId:'chicken',quantity:3}]);
  assert.equal(m.choiceSignature(chosen),m.choiceSignature([{groupId:'extras',optionId:'chicken',quantity:1},{groupId:'extras',optionId:'chicken',quantity:2}]));
  assert.throws(()=>m.assertValidSelection(v2(),[{groupId:'extras',optionId:'chicken',quantity:5}]),e=>e.code==='INVALID_INPUT');
});
test('v2 modifiers enforce portion eligibility and refuse double-counted included protein',()=>{
  assert.throws(()=>m.assertValidSelection(v2({sizeId:SZ_SODA}),[{groupId:'extras',optionId:'chicken'}]),e=>e.code==='CHOICE_NOT_OFFERED');
  const included=v2(); included.modifierGroups[0].options[0].componentRole='included';
  assert.throws(()=>m.assertValidSelection(included,[{groupId:'extras',optionId:'chicken'}]),e=>e.code==='CHOICE_INCOMPATIBLE');
});
test('v2 defaults normalize explicitly while instruction choices cannot carry stock or financial references',()=>{
  const it=v2(); it.modifierGroups[0].options[0].defaultQuantity=2;
  assert.deepEqual(m.assertValidSelection(it,undefined),[{groupId:'extras',optionId:'chicken',quantity:2}]);
  const group={id:'cooking',name:'Cooking',required:false,options:[{id:'well',label:'Well done',type:'instruction'}]};
  assert.equal(m.validateModifierGroups([group],2)[0].options[0].type,'instruction');
  assert.throws(()=>m.validateModifierGroups([{...group,options:[{...group.options[0],sizeId:SZ_TONIC}]}],2),e=>e.code==='INVALID_INPUT');
});
test('stable category routing uses category IDs instead of renamed display labels',()=>{
  const {resolveStation}=require('../services/venue/preparation');
  const stable={name:'Kitchen',categoryIds:['22222222-2222-4222-8222-222222222222']};const fallback={name:'Default',isDefault:true};
  assert.equal(resolveStation([stable,fallback],'Renamed dishes','22222222-2222-4222-8222-222222222222'),stable);
});
test('v2 recipe add-ons retain an owned recipe reference without exposing it in public groups',()=>{
  const it=v2();it.modifierGroups[0].options[0].acceptedRecipeVersionId=SP_TONIC;
  const groups=m.groupsOf(it);assert.equal(groups[0].options[0].acceptedRecipeVersionId,SP_TONIC);
  assert.equal(m.publicGroups(groups)[0].options[0].acceptedRecipeVersionId,undefined);
});
