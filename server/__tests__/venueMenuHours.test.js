'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
test('menu section availability intersects the venue and every attached preset',()=>{
 const {sectionHoursOpen}=require('../services/venue/menu-hours');const at=new Date('2026-10-30T18:00:00Z');const hours=[{day:5,opens:'18:00',closes:'23:00'}];
 assert.equal(sectionHoursOpen({profile:{hours,exceptions:[]},presets:[{hours,exceptions:[]}],at,timezone:'Africa/Lagos'}),true);
 assert.equal(sectionHoursOpen({profile:{hours,exceptions:[]},presets:[{hours,exceptions:[]},{hours:[{day:5,opens:'20:00',closes:'23:00'}],exceptions:[]}],at,timezone:'Africa/Lagos'}),false);
});
