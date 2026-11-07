'use strict';
const { fail, requireId } = require('./errors');
function keys(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !allowed.includes(k))) fail('INVALID_INPUT', 'Unsupported input field', 400);
}
function text(value, name, max, required = true) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) fail('INVALID_INPUT', `Invalid ${name}`, 400);
  return value.trim();
}
function list(value, max) { if (!Array.isArray(value) || value.length > max) fail('INVALID_INPUT', 'Invalid list', 400); return value; }
function time(value) { if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) fail('INVALID_INPUT', 'Invalid hours', 400); return value; }
function interval(row) {
  time(row.opens); time(row.closes);
  if (row.overnight !== undefined && typeof row.overnight !== 'boolean') fail('INVALID_INPUT', 'Invalid overnight flag', 400);
  if (row.opens >= row.closes && row.overnight !== true) fail('INVALID_INPUT', 'Closing hours require explicit overnight service', 400);
}
function validateHours(hours, exceptions) {
  const rows = list(hours, 21).map(row => { keys(row, ['day','opens','closes','overnight']); if (!Number.isInteger(row.day) || row.day < 0 || row.day > 6) fail('INVALID_INPUT', 'Invalid weekday', 400); interval(row); return { ...row }; });
  const excs = list(exceptions, 100).map(row => {
    keys(row, ['date','closed','opens','closes','overnight']);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date || '') || !Number.isFinite(new Date(`${row.date}T00:00:00Z`).getTime()) || new Date(`${row.date}T00:00:00Z`).toISOString().slice(0,10) !== row.date || typeof row.closed !== 'boolean') fail('INVALID_INPUT', 'Invalid opening exception', 400);
    if (!row.closed) interval(row);
    return { ...row };
  });
  return { hours: rows, exceptions: excs };
}
function validateProfile(input) {
  keys(input, ['slug', 'name', 'types', 'timezone', 'description', 'address', 'hours', 'exceptions', 'policies', 'publicPhone', 'photos']);
  const slug = text(input.slug, 'slug', 80);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) fail('INVALID_INPUT', 'Invalid slug', 400);
  const timezone = text(input.timezone, 'timezone', 80);
  try { new Intl.DateTimeFormat('en', { timeZone: timezone }).format(); } catch { fail('INVALID_INPUT', 'Invalid timezone', 400); }
  const types = list(input.types, 4);
  if (!types.length || new Set(types).size !== types.length || types.some(t => !['restaurant','bar','lounge','club'].includes(t))) fail('INVALID_INPUT', 'Invalid venue types', 400);
  const { hours, exceptions } = validateHours(input.hours, input.exceptions);
  const publicPhone=text(input.publicPhone||'','public phone',40,false);
  if(publicPhone&&!/^[+()0-9 .-]+$/.test(publicPhone))fail('INVALID_INPUT','Invalid public phone',400);
  const photos=list(input.photos||[],8).map(photo=>{
    keys(photo,['url','alt']);let url;try{url=new URL(photo.url);}catch{fail('INVALID_INPUT','Invalid photo URL',400);}
    if(url.protocol!=='https:'||url.hostname!=='res.cloudinary.com'||url.username||url.password)fail('INVALID_INPUT','Use an uploaded Cloudinary photo',400);
    return {url:url.href,alt:text(photo.alt,'photo description',200)};
  });
  return { publicPhone, photos, slug, name: text(input.name,'name',120), types, timezone, description: text(input.description,'description',2000,false), address: text(input.address,'address',500), hours, exceptions, policies: text(input.policies,'policies',3000) };
}
function validateFloor(input) {
  keys(input,['zones','tables']); const zones = list(input.zones,30).map(zone => { keys(zone,['id','name']); return { id: text(zone.id,'zone',50), name: text(zone.name,'zone name',100) }; });
  if (new Set(zones.map(z => z.id)).size !== zones.length) fail('INVALID_INPUT', 'Zones must be distinct', 400);
  const tables = list(input.tables,300).map(table => {
    keys(table,['tableId','zone','x','y','shape']); requireId(table.tableId);
    if (!zones.some(z => z.id === table.zone) || !['round','square','rectangle'].includes(table.shape) || ![table.x,table.y].every(n => Number.isFinite(n) && n >= 0 && n <= 100)) fail('INVALID_INPUT','Invalid table layout',400);
    return { ...table };
  });
  if (new Set(tables.map(t => t.tableId)).size !== tables.length) fail('INVALID_INPUT','Tables must be distinct',400);
  return { zones, tables };
}
function validateRequest(input, now = new Date()) {
  keys(input,['guest','partySize','bookingAt']); keys(input.guest,['name','phone']);
  if (typeof input.bookingAt !== 'string' || !/(Z|[+-]\d\d:\d\d)$/.test(input.bookingAt)) fail('INVALID_INPUT','bookingAt needs an explicit UTC offset',400);
  const at = new Date(input.bookingAt);
  if (!Number.isFinite(at.getTime()) || at <= now || at > new Date(now.getTime() + 180*86400000)) fail('INVALID_INPUT','Choose a future time within 180 days',400);
  if (!Number.isInteger(input.partySize) || input.partySize < 1 || input.partySize > 100) fail('INVALID_INPUT','Invalid party size',400);
  return {guest:{name:text(input.guest.name,'guest name',120),phone:text(input.guest.phone,'phone',40)},partySize:input.partySize,bookingAt:at.toISOString()};
}
module.exports = { keys, text, list, validateHours, validateProfile, validateFloor, validateRequest };
