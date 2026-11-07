'use strict';
// services/venue/print-jobs.js — S4 print-job EMISSION (spec §2/§3).
//
// Emission at fire: after routing succeeds (routeFiredItems, same fire
// transaction) ONE `print` job is created per involved station, covering that
// station's items of the round as a "readable delta ticket" — the FIRST fire
// prints everything it carries, every later fire prints only its own round's
// items (per-round content). Job creation is part of the fire commit: a failed
// transaction leaves no job, and the existing firedQuantity guards mean a
// replayed fire never emits twice. Payloads are the venue-prep room payload
// shapes (roundChangedPayload) — safe ticket fields, no guest PII beyond line
// data.
//
// Amendment hook: when an advance correction links a `ref` (waste/remake),
// an `amendment` job is emitted to the owning station referencing the item;
// it supersedes the round's unacknowledged `print` job (referenced via
// duplicateOf) — acknowledged jobs are NEVER mutated, and the original keeps
// its ledger identity untouched.
//
// Delivery/ack/reprint/list live in print-delivery.js (which imports the
// shared helpers from here — one-way, no cycle). Device binding: one job per
// STATION (spec: station-routed print only); its deviceId is the station's
// first configured device — multi-device fan-out is the bridge's job, not the
// ledger's. Unrouted items (stationId absent) print nothing (surfaced on the
// kitchen board instead).
const crypto = require('node:crypto');
const PrintJob = require('../../models/PreparationPrintJob');
const Station = require('../../models/PreparationStation');
const { id } = require('./eligibility');

const newJobId = () => `pj:${crypto.randomBytes(10).toString('hex')}`;
const deviceIdOf = station => (station.deviceIds || [])[0] || undefined;

// Safe ticket payload — exactly the roundChangedPayload item shape, plus the
// round number for readable delta tickets.
function ticketPayload({ sessionId, round, items }) {
  return { sessionId: id(sessionId), roundId: id(round.roundId), roundNo: round.roundNo, firedAt: round.firedAt,
    items: items.map(item => ({ lineId: item.lineId, revision: item.revision, name: item.name, quantity: item.quantity, stationId: id(item.stationId) })) };
}

function jobDTO(job) {
  return { id: id(job), jobId: job.jobId, sessionId: id(job.session), locationId: id(job.location), stationId: id(job.stationId),
    actionType: job.actionType, ...(job.duplicateOf ? { duplicateOf: job.duplicateOf } : {}), ...(job.roundId ? { roundId: id(job.roundId) } : {}),
    lineIds: [...(job.lineIds || [])], ...(job.deviceId ? { deviceId: job.deviceId } : {}), deliveryState: job.deliveryState,
    attempts: job.attempts, ...(job.ackAt ? { ackAt: job.ackAt } : {}), ...(job.lastDeliveredAt ? { lastDeliveredAt: job.lastDeliveredAt } : {}),
    ...(job.lastError ? { lastError: job.lastError } : {}), payload: job.payload, createdAt: job.createdAt };
}

// Random jobIds cannot collide in practice and the unique index is the belt;
// unlike the prep-item/consumption paths a duplicate here is a bug (throw).
async function createJob(doc, mongoSession) {
  const [row] = await PrintJob.create([{ ...doc, jobId: newJobId() }], { session: mongoSession });
  return row;
}

// One `print` job per involved station; unrouted rounds create none.
async function emitStationJobs({ tenantId, locationId, visit, round, mongoSession }) {
  const routed = (round.items || []).filter(item => item.stationId);
  if (!routed.length) return [];
  const stationIds = [...new Set(routed.map(item => String(item.stationId)))];
  const stations = await Station.find({ tenant: tenantId, _id: { $in: stationIds } }).session(mongoSession).lean();
  const jobs = [];
  for (const stationId of stationIds) {
    const station = stations.find(row => String(row._id) === stationId);
    if (!station) continue; // station config vanished mid-fire — items stay routed, print nothing
    const items = routed.filter(item => String(item.stationId) === stationId);
    jobs.push(await createJob({ tenant: tenantId, location: locationId, session: id(visit), stationId, roundId: id(round.roundId),
      lineIds: items.map(item => item.lineId), actionType: 'print', deviceId: deviceIdOf(station),
      payload: ticketPayload({ sessionId: visit, round, items }) }, mongoSession));
  }
  return jobs;
}

// Amendment/cancel hook (spec §3): a ref-linked correction notifies the owning
// station. The job references the item (safe ticket shape) and, when the
// round's print job is still unacknowledged, points at it via duplicateOf
// ("superseded by an amendment referencing it"). Acknowledged originals are
// never mutated and never referenced as superseded. Returns null when there
// is no owning (routed) station to notify.
async function emitAmendment({ tenantId, item, reason, ref, to, mongoSession }) {
  if (!item.stationId) return null;
  const station = await Station.findOne({ _id: item.stationId, tenant: tenantId }).session(mongoSession).lean();
  if (!station) return null;
  const superseded = await PrintJob.findOne({ tenant: tenantId, session: item.session, stationId: item.stationId, roundId: item.roundId,
    actionType: 'print', deliveryState: { $in: ['queued', 'delivered'] } }).sort({ createdAt: -1, _id: -1 }).session(mongoSession).lean();
  return createJob({ tenant: tenantId, location: item.location, session: item.session, stationId: item.stationId, roundId: item.roundId,
    lineIds: [item.lineId], actionType: 'amendment', deviceId: deviceIdOf(station), ...(superseded ? { duplicateOf: superseded.jobId } : {}),
    payload: { sessionId: id(item.session), roundId: id(item.roundId), roundNo: null, ref, ...(reason !== undefined ? { reason } : {}), to,
      items: [{ lineId: item.lineId, revision: item.revision, name: item.name, quantity: item.quantity, stationId: id(item.stationId) }] } }, mongoSession);
}

module.exports = { emitStationJobs, emitAmendment, ticketPayload, jobDTO, createJob, deviceIdOf, newJobId };
