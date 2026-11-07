'use strict';
// services/venue/print-delivery.js — S4 pull DELIVERY, ack, reprint and staff
// listing (spec §3). The delivery state machine
// queued→delivered→acknowledged (or failed) moves ONLY here, never from timer
// assumptions: the bridge PULLS (pendingForDevice marks returned jobs
// delivered, attempts+1, lastDeliveredAt), the bridge ACKS (acknowledge), and
// a job whose delivery attempts exceed the station-configurable cap (default
// 5) becomes failed with lastError — after which it is no longer offered.
//
// Reconnect recovery: a delivered-but-unacked job is redelivered on later
// polls flagged `recoveryDuplicate: true` with duplicateOf pointing at the
// ORIGINAL (itself) IN THE RESPONSE ONLY — a redelivery never creates a new
// job and never rewrites the ledger row (the bridge labels the re-render;
// contract 10 §5).
//
// Reprint is a STAFF ledger operation through runVenueOperation idempotency:
// a new visibly labelled `reprint` job pointing at the original — zero new
// consumption events, zero VenuePreparationItem mutations by construction.
const PrintJob = require('../../models/PreparationPrintJob');
const Station = require('../../models/PreparationStation');
const { runVenueOperation } = require('./operations');
const { fail } = require('./errors');
const { id } = require('./eligibility');
const { jobDTO } = require('./print-jobs');

// Station-configurable cap (stagePolicy is the S3 Mixed config bag; absent →
// the spec default 5). Attempts increment on EVERY poll cycle that offers the
// job, so a device/bridge that keeps polling without acking eventually fails
// the job instead of offering it forever.
const DEFAULT_ATTEMPTS_CAP = 5;
function attemptsCapOf(station) {
  const cap = Number(station && station.stagePolicy && station.stagePolicy.printJobAttemptsCap);
  return Number.isInteger(cap) && cap >= 1 ? cap : DEFAULT_ATTEMPTS_CAP;
}

function validateDeviceId(deviceId) {
  if (typeof deviceId !== 'string' || !deviceId.trim() || deviceId.length > 100) fail('INVALID_INPUT', 'deviceId query parameter is required (at most 100 characters)', 400);
  return deviceId.trim();
}

async function capsFor(tenantId, jobs) {
  const stationIds = [...new Set(jobs.filter(job => job.stationId).map(job => String(job.stationId)))];
  const stations = stationIds.length ? await Station.find({ tenant: tenantId, _id: { $in: stationIds } }).lean() : [];
  return new Map(stations.map(station => [String(station._id), attemptsCapOf(station)]));
}

// The device's outstanding jobs: queued + delivered-unacked, oldest first
// (print order). Fresh jobs → delivered; redeliveries flagged recovery.
async function pendingForDevice({ tenantId, locationId, deviceId, now = new Date() }) {
  validateDeviceId(deviceId);
  const found = await PrintJob.find({ tenant: tenantId, location: locationId, deviceId, deliveryState: { $in: ['queued', 'delivered'] } })
    .sort({ createdAt: 1, _id: 1 }).lean();
  const caps = await capsFor(tenantId, found);
  const offered = [];
  for (const job of found) {
    const attempts = job.attempts + 1;
    if (attempts > (caps.get(String(job.stationId)) ?? DEFAULT_ATTEMPTS_CAP)) {
      await PrintJob.updateOne({ _id: job._id, tenant: tenantId, deliveryState: { $in: ['queued', 'delivered'] } },
        { $set: { deliveryState: 'failed', lastError: `Delivery attempts exceeded cap (${attempts - 1})` }, $inc: { attempts: 1 } });
      continue; // failed jobs are no longer offered
    }
    const fresh = job.deliveryState === 'queued';
    if (fresh) await PrintJob.updateOne({ _id: job._id, tenant: tenantId, deliveryState: 'queued' },
      { $set: { deliveryState: 'delivered', lastDeliveredAt: now }, $inc: { attempts: 1 } });
    else await PrintJob.updateOne({ _id: job._id, tenant: tenantId, deliveryState: 'delivered' }, { $inc: { attempts: 1 } });
    offered.push({ ...jobDTO(job), deliveryState: 'delivered', attempts, lastDeliveredAt: now,
      ...(fresh ? {} : { recoveryDuplicate: true, duplicateOf: job.jobId }) });
  }
  return { deviceId, jobs: offered };
}

// Ack (bridge): unknown/foreign job → 404; double ack (and ack of a failed
// job) is a no-op returning the current row. Ack is accepted from `queued`
// too — a bridge that printed from a poll whose delivery write it never saw
// must still be able to land the ack (durable-safe choice, documented).
async function acknowledge({ tenantId, locationId, jobId, now = new Date() }) {
  if (typeof jobId !== 'string' || !/^pj:[0-9a-f]{20}$/.test(jobId)) fail('NOT_FOUND', 'Print job not found', 404);
  const job = await PrintJob.findOne({ tenant: tenantId, location: locationId, jobId }).lean();
  if (!job) fail('NOT_FOUND', 'Print job not found', 404);
  if (job.deliveryState === 'acknowledged' || job.deliveryState === 'failed') return jobDTO(job);
  await PrintJob.updateOne({ _id: job._id, tenant: tenantId, deliveryState: { $in: ['queued', 'delivered'] } },
    { $set: { deliveryState: 'acknowledged', ackAt: now } });
  return jobDTO(await PrintJob.findOne({ _id: job._id }).lean());
}

// Staff reprint: a new labelled job pointing at the original. Only touches
// the print-job ledger — no second line/fire/consumption event, no
// preparation-item mutation (asserted in tests against S2/S3 invariants).
async function reprint({ tenantId, sessionId, jobId, actor, idempotencyKey }) {
  if (typeof jobId !== 'string' || !/^pj:[0-9a-f]{20}$/.test(jobId)) fail('NOT_FOUND', 'Print job not found', 404);
  const { visit } = await require('./lines').visitContext({ tenantId, sessionId, actor, action: 'preparation.write' });
  return runVenueOperation({ tenantId, locationId: id(visit.location), actor, operation: 'print.reprint', key: idempotencyKey,
    targetType: 'PreparationPrintJob', payload: { sessionId, jobId }, execute: async ({ mongoSession }) => {
      const original = await PrintJob.findOne({ tenant: tenantId, session: visit._id, jobId }).session(mongoSession).lean();
      if (!original) fail('NOT_FOUND', 'Print job not found', 404);
      const station = await Station.findOne({ _id: original.stationId, tenant: tenantId }).session(mongoSession).lean();
      const { createJob } = require('./print-jobs');
      const row = await createJob({ tenant: tenantId, location: original.location, session: original.session, stationId: original.stationId,
        roundId: original.roundId, lineIds: [...(original.lineIds || [])], actionType: 'reprint', duplicateOf: original.jobId,
        deviceId: original.deviceId || (station ? require('./print-jobs').deviceIdOf(station) : undefined),
        payload: { ...original.payload, label: 'REPRINT', reprintOf: original.jobId } }, mongoSession);
      return jobDTO(row);
    } });
}

// Staff read surface: the session's print jobs, newest first, carrying
// duplicateOf labels and delivery states. Read eligibility 'preparation.read'
// through visitContext; no rate limiter (staff viewing, like other reads).
async function listSessionPrintJobs({ tenantId, sessionId, actor }) {
  const { visit } = await require('./lines').visitContext({ tenantId, sessionId, actor, action: 'preparation.read' });
  const rows = await PrintJob.find({ tenant: tenantId, session: visit._id }).sort({ createdAt: -1, _id: -1 }).limit(100).lean();
  return { sessionId: id(visit), locationId: id(visit.location), jobs: rows.map(jobDTO) };
}

module.exports = { pendingForDevice, acknowledge, reprint, listSessionPrintJobs, attemptsCapOf };
