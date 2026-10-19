const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Cycle = require('../models/AppraisalCycle');
const P = require('../models/PeerAppraisalParticipant');
const R = require('../models/PeerAppraisalRating');
const User = require('../models/User');
const life = require('../services/peerAppraisal/lifecycle');
const reviews = require('../services/peerAppraisal/reviews');
const queries = require('../services/peerAppraisal/queries');
const controller = require('../controllers/peerAppraisal.controller');
const oid = () => new mongoose.Types.ObjectId();
// Opt in only against the disposable localhost replica set; never loads .env.
test('transactional peer appraisal lifecycle', { skip: !process.env.PEER_TEST_MONGO }, async t => {
  assert.equal(process.env.PEER_TEST_MONGO, 'mongodb://127.0.0.1:27029/?replicaSet=peerTest');
  await mongoose.connect(process.env.PEER_TEST_MONGO, { dbName: `peer_appraisal_test_${process.pid}` });
  try {
    await Promise.all([Cycle.init(), P.init(), R.init(), require('../models/PeerAppraisalExam').init(), require('../models/PeerAppraisalExamAttempt').init()]);
    const tenantId = oid(), ids = [oid(), oid(), oid()];
    await User.collection.insertMany(ids.map((id, i) => ({ _id: id, tenant: tenantId, role: 'tenant_staff', status: 'active', firstName: `Employee${i}`, lastName: 'Test' })));
    const c = await Cycle.create({ tenant: tenantId, name: 'Peer test', mode: 'peer_rating' });
    const ctx = { tenantId, cycleId: c._id };
    await life.replaceRoster({ ...ctx, expectedRevision: 0, participants: ids.map(employee => ({ employee: String(employee), bonusAmount: 50000 })) });
    // Legacy persisted participants have no appraiser flag.
    await P.collection.updateMany({ cycle: c._id }, { $unset: { isAppraiser: '' } });
    await Promise.all([life.launchPeerCycle(ctx), life.launchPeerCycle(ctx)]);
    assert.equal(await P.countDocuments({ cycle: c._id }), 3);
    await assert.rejects(life.closePeerCycle(ctx), { statusCode: 409 });
    await assert.rejects(queries.ownResult(tenantId, c._id, ids[0]), { statusCode: 409 });
    await assert.rejects(queries.ownReview(tenantId, c._id, oid()), { statusCode: 404 });
    const own = await queries.ownReview(tenantId, c._id, ids[0]);
    assert.equal(own.colleagues.length, 2);
    assert.equal(own.colleagues.some(p => String(p.employee) === String(ids[0])), false);
    assert.equal(JSON.stringify(own).includes('allocationMinor'), false);
    let denied;
    await controller.participants({ params: { cycleId: String(c._id) }, user: { _id: ids[0], tenant: tenantId, role: 'tenant_staff' } }, {}, e => { denied = e; });
    assert.equal(denied.statusCode, 403);
    await assert.rejects(life.replaceRoster({ ...ctx, participants: [] }), { statusCode: 409 });

    const ratings = reviewerId => ids.filter(x => String(x) !== String(reviewerId)).map(subject => ({ subject: String(subject), rating: 4 }));
    await reviews.savePeerDraft({ ...ctx, reviewerId: ids[0], ratings: ratings(ids[0]), expectedRevision: 0 });
    await assert.rejects(reviews.savePeerDraft({ ...ctx, reviewerId: ids[0], ratings: [], expectedRevision: 0 }), { statusCode: 409 });
    await assert.rejects(reviews.submitPeerReview({ ...ctx, reviewerId: ids[0], ratings: [], expectedRevision: 1 }));
    await reviews.submitPeerReview({ ...ctx, reviewerId: ids[0], ratings: ratings(ids[0]), expectedRevision: 1 });
    await reviews.submitPeerReview({ ...ctx, reviewerId: ids[0], ratings: ratings(ids[0]), expectedRevision: 1 });
    await assert.rejects(reviews.savePeerDraft({ ...ctx, reviewerId: ids[0], ratings: [], expectedRevision: 2 }), { statusCode: 409 });
    await Promise.all(ids.slice(1).map(reviewerId => reviews.submitPeerReview({ ...ctx, reviewerId, ratings: ratings(reviewerId), expectedRevision: 0 })));
    await Promise.all([life.closePeerCycle(ctx), life.closePeerCycle(ctx)]);
    // A lost submission response may be retried after HR has already closed.
    const retry = await reviews.submitPeerReview({ ...ctx, reviewerId: ids[0], ratings: ratings(ids[0]), expectedRevision: 1 });
    assert.ok(retry.submittedAt);
    assert.equal(retry.revision, 2);
    await assert.rejects(reviews.submitPeerReview({ ...ctx, reviewerId: ids[0], ratings: ratings(ids[0]).map(r => ({ ...r, rating: 5 })), expectedRevision: 2 }), { statusCode: 409 });
    const result = await queries.ownResult(tenantId, c._id, ids[0]);
    assert.deepEqual(result, { averageScore: 4, ratingCount: 2, bonusMinor: 4000000, allocationMinor: 5000000, currency: 'NGN' });
    await assert.rejects(queries.ownResult(oid(), c._id, ids[0]), { statusCode: 404 });
    let ownResponse;
    await controller.result({ params: { cycleId: String(c._id) }, user: { _id: ids[0], tenant: tenantId }, body: { employee: ids[1], tenant: oid() } }, { json: data => { ownResponse = data; } }, e => { throw e; });
    assert.deepEqual(ownResponse.data, result);
    await assert.rejects(R.create({ tenant: tenantId, cycle: c._id, reviewer: ids[0], subject: ids[1], rating: 5 }), e => e.code === 11000);
    const rows = await P.find({ cycle: c._id }).lean();
    assert.equal(await R.countDocuments({ cycle: c._id }), 6);
    assert.ok(rows.every(p => p.result.ratingCount === 2 && p.result.averageScore === 4 && p.result.bonusMinor === 4000000));
    await assert.rejects(life.replaceRoster({ ...ctx, participants: [] }), { statusCode: 409 });
    await assert.rejects(life.launchPeerCycle({ ...ctx, tenantId: oid() }), { statusCode: 404 });
    await t.test('authenticated HTTP workflow creates, rates, closes and releases private bonuses', async t => {
      const express = require('express');
      const jwt = require('jsonwebtoken');
      const Tenant = require('../models/Tenant');
      const ownerId = oid(), foreignTenant = oid(), foreignId = oid();
      await Tenant.collection.insertMany([tenantId, foreignTenant].map(_id => ({ _id, name: 'Disposable test', slug: String(_id), status: 'approved', subscriptionStatus: 'active', plan: 'enterprise' })));
      await User.collection.insertMany([
        { _id: ownerId, tenant: tenantId, role: 'tenant_owner', status: 'active', firstName: 'Owner', lastName: 'Test' },
        { _id: foreignId, tenant: foreignTenant, role: 'tenant_staff', status: 'active', firstName: 'Foreign', lastName: 'Test' },
      ]);
      const previousSecret = process.env.JWT_SECRET;
      process.env.JWT_SECRET = 'disposable-peer-test-secret-not-for-production';
      const app = express();
      app.use(express.json());
      app.use('/api/peer-appraisals', require('../routes/peerAppraisal.routes'));
      app.use((err, req, res, next) => res.status(err.statusCode || 500).json({ success: false, message: err.message }));
      const server = await new Promise(resolve => { const listening = app.listen(0, '127.0.0.1', () => resolve(listening)); });
      const base = `http://127.0.0.1:${server.address().port}/api/peer-appraisals`;
      const call = async (user, path, method = 'GET', body, extraHeaders = {}) => {
        const token = user ? jwt.sign({ userId: String(user) }, process.env.JWT_SECRET, { expiresIn: '10m' }) : null;
        const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extraHeaders }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
        return { status: response.status, body: await response.json() };
      };
      try {
        assert.equal((await call(null, '/my')).status, 401);
        assert.equal((await call(ids[0], '', 'POST', { name: 'Forbidden' })).status, 403);
        const created = await call(ownerId, '', 'POST', { name: 'HTTP bonus cycle' });
        assert.equal(created.status, 200);
        const cycleId = created.body.data._id;
        const roster = await call(ownerId, `/${cycleId}/participants`, 'PUT', { expectedRevision: 0, participants: ids.map((employee, i) => ({ employee: String(employee), bonusAmount: [50000, 25000, 0][i] })) });
        assert.equal(roster.status, 200);
        assert.equal(roster.body.data.revision, 1);
        assert.equal((await call(ownerId, `/${cycleId}/launch`, 'POST')).body.data.status, 'collecting');
        assert.equal((await call(ids[0], `/${cycleId}/result`)).status, 409);
        assert.equal((await call(ids[0], `/${cycleId}/close`, 'POST')).status, 403);
        const matrix = [[null, 5, 1], [4, null, 3], [2, 3, null]];
        for (let i = 0; i < ids.length; i++) {
          const review = await call(ids[i], `/${cycleId}/review`);
          assert.equal(review.status, 200);
          assert.equal(review.body.data.colleagues.length, 2);
          assert.equal(JSON.stringify(review.body.data).includes('allocationMinor'), false);
          const ratings = ids.flatMap((subject, j) => j === i ? [] : [{ subject: String(subject), rating: matrix[i][j] }]);
          assert.equal((await call(ids[i], `/${cycleId}/submit`, 'POST', { ratings: ratings.slice(0, 1), expectedRevision: 0 })).status, 400);
          assert.equal((await call(ids[i], `/${cycleId}/submit`, 'POST', { ratings, expectedRevision: 0 })).status, 200);
        }
        assert.equal((await call(ownerId, `/${cycleId}/close`, 'POST')).body.data.status, 'closed');
        for (let i = 0; i < ids.length; i++) {
          const result = await call(ids[i], `/${cycleId}/result`, 'GET', undefined, { 'x-tenant-slug': String(foreignTenant) });
          assert.equal(result.status, 200);
          assert.equal(result.body.data.averageScore, [3, 4, 2][i]);
          assert.equal(result.body.data.bonusMinor, [3000000, 2000000, 0][i]);
          assert.equal(result.body.data.ratingCount, 2);
          assert.deepEqual(Object.keys(result.body.data).sort(), ['allocationMinor', 'averageScore', 'bonusMinor', 'currency', 'ratingCount']);
        }
        assert.equal((await call(foreignId, `/${cycleId}/result`)).status, 404);
        assert.equal((await call(ownerId, '/bad-id/participants')).status, 400);
        await t.test('department examination, monthly attendance and combined bonuses', async () => {
          await require('./helpers/peerExaminationWorkflow')({ call, ownerId, ids, tenantId, foreignId, foreignTenant });
        });
        await t.test('individual exam recipients restrict access and use correct bonus components', async () => {
          await require('./helpers/peerSelectedRecipientsWorkflow')({ call, ownerId, ids, tenantId, foreignId });
        });
        await t.test('private source bank, frozen ten-question papers and attendance date range', async () => {
          await require('./helpers/peerPersonalizedExamWorkflow')({ call, ownerId, ids, tenantId });
        });
        await t.test('weighted marks, explicit start, server deadline and timed-out closure', async () => {
          await require('./helpers/peerTimedExamWorkflow')({ call, ownerId, ids, tenantId, foreignId });
        });
        await t.test('expired examination grades settle on employee reads and owner progress', async () => {
          await require('./helpers/peerTimedExamWorkflow')({ call, ownerId, ids, tenantId, foreignId, settlement: 'read' });
        });
        await t.test('only selected appraisers submit, while every participant receives a bonus result', async () => {
          const created = await call(ownerId, '', 'POST', { name: 'Selected appraisers' });
          const selectedId = created.body.data._id;
          const path = `/${selectedId}`;
          const participants = ids.map((employee, i) => ({ employee: String(employee), bonusAmount: [50000, 25000, 10000][i], isAppraiser: i < 2 }));
          const saved = await call(ownerId, `${path}/participants`, 'PUT', { expectedRevision: 0, participants });
          assert.equal(saved.status, 200);
          assert.equal((await call(ownerId, `${path}/participants`, 'PUT', { expectedRevision: 0, participants })).status, 409);
          const progress = await call(ownerId, `${path}/participants`);
          assert.equal(progress.body.data.appraiserTotal, 2);
          assert.deepEqual(progress.body.data.participants.map(p => p.isAppraiser), [true, true, false]);
          assert.equal((await call(ownerId, `${path}/launch`, 'POST')).status, 200);
          assert.equal((await call(ownerId, `${path}/participants`, 'PUT', { expectedRevision: 2, participants })).status, 409);
          const nonReviewer = await call(ids[2], `${path}/review`);
          assert.equal(nonReviewer.status, 200);
          assert.equal(nonReviewer.body.data.isAppraiser, false);
          assert.deepEqual(nonReviewer.body.data.colleagues, []);
          assert.deepEqual(nonReviewer.body.data.ratings, []);
          const mine = await call(ids[2], '/my');
          assert.equal(mine.body.data.find(c => c._id === selectedId).isAppraiser, false);
          for (const endpoint of [['review', 'PATCH'], ['submit', 'POST']]) {
            assert.equal((await call(ids[2], `${path}/${endpoint[0]}`, endpoint[1], { expectedRevision: 0, ratings: [{ subject: String(ids[0]), rating: 1 }] })).status, 403);
          }
          assert.equal((await call(foreignId, `${path}/submit`, 'POST', { expectedRevision: 0, ratings: [] })).status, 404);
          assert.equal((await call(ids[0], `${path}/submit`, 'POST', { expectedRevision: 0, ratings: [{ subject: String(ids[0]), rating: 5 }] })).status, 400);
          assert.equal((await call(ownerId, `${path}/close`, 'POST')).status, 409);
          const ratingsA = [{ subject: String(ids[1]), rating: 5 }, { subject: String(ids[2]), rating: 1 }];
          const ratingsB = [{ subject: String(ids[0]), rating: 4 }, { subject: String(ids[2]), rating: 3 }];
          assert.equal((await call(ids[0], `${path}/submit`, 'POST', { expectedRevision: 0, ratings: ratingsA })).status, 200);
          assert.equal((await call(ownerId, `${path}/close`, 'POST')).status, 409);
          assert.equal((await call(ids[1], `${path}/submit`, 'POST', { expectedRevision: 0, ratings: ratingsB })).status, 200);
          const ready = (await call(ownerId, `${path}/participants`)).body.data;
          assert.equal(ready.total, 3);
          assert.equal(ready.appraiserTotal, 2);
          assert.equal(ready.submitted, 2);
          assert.equal((await call(ids[2], `${path}/result`)).status, 409);
          assert.equal((await call(ownerId, `${path}/close`, 'POST')).status, 200);
          for (let i = 0; i < ids.length; i++) {
            const result = (await call(ids[i], `${path}/result`)).body.data;
            assert.equal(result.averageScore, [4, 5, 2][i]);
            assert.equal(result.ratingCount, [1, 1, 2][i]);
            assert.equal(result.bonusMinor, [4000000, 2500000, 400000][i]);
          }
          assert.equal((await call(ids[0], `${path}/submit`, 'POST', { expectedRevision: 0, ratings: ratingsA })).status, 200);
          assert.equal(await R.countDocuments({ cycle: selectedId, reviewer: ids[2] }), 0);
        });

      } finally {
        await new Promise(resolve => server.close(resolve));
        if (previousSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previousSecret;
      }
    });
    await t.test('stale HR roster saves cannot overwrite newer bonus allocations', async () => {
      const draft = await Cycle.create({ tenant: tenantId, name: 'HR revisions', mode: 'peer_rating' });
      const cx = { tenantId, cycleId: draft._id };
      const participants = ids.slice(0, 2).map(employee => ({ employee: String(employee), bonusAmount: 100 }));
      await life.replaceRoster({ ...cx, participants, expectedRevision: 0 });
      await assert.rejects(life.replaceRoster({ ...cx, participants: participants.map(p => ({ ...p, bonusAmount: 200 })), expectedRevision: 0 }), { statusCode: 409 });
      const saved = await queries.hrParticipants(tenantId, draft._id);
      assert.ok(saved.participants.every(p => p.allocationMinor === 10000));
      assert.equal(saved.revision, 1);
    });
    await t.test('two writers with the same revision cannot overwrite each other', async () => {
      const draft = await Cycle.create({ tenant: tenantId, name: 'Concurrent', mode: 'peer_rating' });
      const cx = { tenantId, cycleId: draft._id };
      await life.replaceRoster({ ...cx, expectedRevision: 0, participants: ids.slice(0, 2).map(employee => ({ employee: String(employee), bonusAmount: 0 })) });
      await life.launchPeerCycle(cx);
      const results = await Promise.allSettled([3, 5].map(rating => reviews.savePeerDraft({ ...cx, reviewerId: ids[0], ratings: [{ subject: String(ids[1]), rating }], expectedRevision: 0 })));
      assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
      assert.equal(results.find(r => r.status === 'rejected').reason.statusCode, 409);
      await User.collection.updateOne({ _id: ids[1] }, { $set: { status: 'deleted' } });
      const progress = await queries.hrParticipants(tenantId, draft._id);
      assert.equal(progress.total, 2);
      assert.equal(progress.participants.find(p => p.employee === String(ids[1])).unavailable, true);
      await assert.rejects(life.closePeerCycle(cx), { statusCode: 409 });
      await life.cancelPeerCycle(cx);
    });
    await t.test('cancelled cycles block writes and closing', async () => {
      const other = await Cycle.create({ tenant: tenantId, name: 'Cancel', mode: 'peer_rating' });
      const cx = { tenantId, cycleId: other._id };
      await life.cancelPeerCycle(cx);
      await assert.rejects(life.launchPeerCycle(cx), { statusCode: 409 });
      await assert.rejects(life.closePeerCycle(cx), { statusCode: 409 });
    });
  } finally { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); }
});
