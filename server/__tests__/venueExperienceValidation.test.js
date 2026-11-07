'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
test('profile validates venue-local hours and never accepts publication authority', () => {
  const { validateProfile } = require('../services/venue/experience-validation');
  const input = { slug: 'main-lounge', name: 'Main lounge', types: ['lounge'], timezone: 'Africa/Lagos', description: 'Drinks and conversation', address: 'Abuja', hours: [{ day: 5, opens: '18:00', closes: '02:00', overnight: true }], exceptions: [], policies: 'Requests do not guarantee seating' };
  assert.equal(validateProfile(input).timezone, 'Africa/Lagos');
  assert.throws(() => validateProfile({ ...input, approved: true }), /Unsupported/);
  assert.throws(() => validateProfile({ ...input, timezone: 'Invalid/City' }), /timezone/);
  assert.throws(() => validateProfile({ ...input, hours: [{day: 5, opens: '18:00', closes: '02:00'}] }), /overnight/);
  assert.throws(() => validateProfile({ ...input, exceptions: [{date:'2026-99-99',closed:true}] }), error => error.statusCode===400);
});
test('layout accepts configuration only and keeps each physical table unique', () => {
  const { validateFloor } = require('../services/venue/experience-validation');
  const tableId = '123456789012345678901234';
  const floor = { zones: [{ id: 'main', name: 'Main room' }], tables: [{tableId, zone: 'main', x: 10, y: 20, shape: 'round'}] };
  assert.deepEqual(validateFloor(floor), floor);
  assert.throws(() => validateFloor({ ...floor, tables: [{...floor.tables[0], currentTabId: tableId}] }), /Unsupported/);
  assert.throws(() => validateFloor({ ...floor, tables: [...floor.tables, ...floor.tables] }), /distinct/);
});
test('reservation requires an unambiguous instant and minimal guest input', () => {
  const { validateRequest } = require('../services/venue/experience-validation');
  const input = { guest: {name: 'Guest', phone: '+234123456789'}, partySize: 2, bookingAt: '2026-11-01T20:00:00+01:00' };
  assert.equal(validateRequest(input, new Date('2026-10-19')).bookingAt, '2026-11-01T19:00:00.000Z');
  assert.throws(() => validateRequest({...input, bookingAt: '2026-11-01T20:00'}, new Date('2026-10-19')), /offset/);
  assert.throws(() => validateRequest({...input, partySize: 0}, new Date('2026-10-19')), /party/);
});
test('public photos and contact are explicit and exclude unsafe URLs',()=>{
 const {validateProfile}=require('../services/venue/experience-validation');
 const input={slug:'main',name:'Lounge',types:['lounge'],timezone:'Africa/Lagos',description:'Beverages',address:'Abuja',hours:[],exceptions:[],policies:'Request only',publicPhone:'+234 123456789',photos:[{url:'https://res.cloudinary.com/drinks/image/upload/lounge.jpg',alt:'Main seating area'}]};
 assert.deepEqual(validateProfile(input).photos,input.photos);
 assert.throws(()=>validateProfile({...input,photos:[{url:'javascript:alert(1)',alt:'Room'}]}),/photo/i);
 assert.throws(()=>validateProfile({...input,publicPhone:'<script>'}),/phone/i);
});
