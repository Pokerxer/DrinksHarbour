// server/__tests__/helpers/appraisalHarness.js
//
// Phase 2 Task 10: an in-memory stand-in for the five appraisal models
// (Appraisal, AppraisalFeedback, AppraisalCycle, AppraisalTemplate,
// AppraisalNudge) plus User, backed by REAL plain-array storage — not
// per-call canned fixtures.
// What one endpoint writes (a `.save()`, an `insertMany`, a `create`)
// another endpoint's next call reads, exactly the property a lifecycle test
// needs to actually exercise.
//
// Follows the repo's stub idiom (see appraisalApprovePeers.test.js /
// appraisalNominate.test.js): monkey-patch the model statics with
// hand-written fakes, return a `restore()` that puts the originals back.
// No supertest, no in-memory Mongo.
//
// Query-chain coverage (read the controllers under __tests__ for the
// exhaustive list before touching this file — this is what they actually
// call):
//   Appraisal:         findOne, find, create([...], {session}), aggregate,
//                      countDocuments
//   AppraisalFeedback: findOne, find, insertMany, countDocuments, updateMany
//   AppraisalCycle:    findOne, find, create, exists, updateMany
//   AppraisalTemplate: findOne, find, create, findOneAndUpdate (upsert +
//                      $setOnInsert, simulates the {tenant} partial unique
//                      index's E11000 on a genuine check-then-act race — see
//                      installModelStubs), updateOne, updateMany, exists,
//                      countDocuments
//   AppraisalNudge:    findOne, find, create, countDocuments
//   User:              find, findOne
//   Query chain:       .populate() (string or {path,select,populate}),
//                       .select(), .sort(), .skip(), .limit(), .session(),
//                       .lean() (terminal, matching the repo's existing stub
//                       idiom) or bare `await` (thenable, matching real
//                       mongoose Query).
//   Filter operators:  equality (stringified), $in, $nin, $ne. Anything else
//                       is NOT supported and silently matches nothing — add it
//                       here rather than working around it in a controller.
//   mongoose.startSession(): { withTransaction(fn), endSession() }.
const mongoose = require('mongoose');

const Appraisal = require('../../models/Appraisal');
const AppraisalFeedback = require('../../models/AppraisalFeedback');
const AppraisalCycle = require('../../models/AppraisalCycle');
const AppraisalTemplate = require('../../models/AppraisalTemplate');
const AppraisalNudge = require('../../models/AppraisalNudge');
const User = require('../../models/User');

// ---------------------------------------------------------------------------
// Schema-shaped field lists, used only to give hydrated (non-.lean()) fakes a
// full set of getter/setter accessors up front — including fields a fixture
// never set — so a controller assigning e.g. `appraisal.releasedAt = ...` for
// the first time still writes through to the backing store instead of
// silently creating a plain own-property that would defeat the hydration
// hazard below.
const FIELD_LISTS = {
  appraisals: [
    'tenant', 'cycle', 'employee', 'manager', 'state', 'reviewerIds',
    'peerNominations', 'summary', 'finalRating', 'releasedAt', 'releasedBy',
    'acknowledgedAt', 'employeeResponse', 'cancelledAt', 'cancelReason',
    'createdAt', 'updatedAt',
  ],
  feedback: [
    'tenant', 'appraisal', 'cycle', 'reviewer', 'kind', 'answers', 'status',
    'submittedAt', 'declinedAt', 'declineReason', 'createdAt', 'updatedAt',
  ],
  cycles: [
    'tenant', 'name', 'template', 'templateFamily', 'status', 'nominationDeadline',
    'feedbackDeadline', 'peerReviewEnabled', 'createdBy', 'launchedAt',
    'closedAt', 'createdAt', 'updatedAt',
  ],
  templates: [
    'tenant', 'name', 'description', 'isArchived', 'createdBy', 'sections',
    'family', 'version', 'isLatest', 'isDefault', 'createdAt', 'updatedAt',
  ],
  nudges: [
    'tenant', 'appraisal', 'cycle', 'target', 'reason', 'channel', 'sentBy',
    'sentAt', 'emailError', 'createdAt', 'updatedAt',
  ],
};

// Which collection a ref field on a document resolves against, for populate.
const REF_MAP = {
  appraisals: { employee: 'users', manager: 'users', releasedBy: 'users', cycle: 'cycles' },
  feedback: { reviewer: 'users', appraisal: 'appraisals', cycle: 'cycles' },
  cycles: { template: 'templates', templateFamily: 'templates', createdBy: 'users' },
  nudges: { target: 'users', sentBy: 'users', appraisal: 'appraisals', cycle: 'cycles' },
};

// Subdocument-array populate paths (`.populate('peerNominations.user', ...)`)
// are keyed by `${collection}.${path}` since the array item's own field name
// ('user') isn't unique enough on its own.
const SUBDOC_REF_MAP = {
  'appraisals.peerNominations.user': 'users',
};

const DEFAULTS = {
  feedback: { status: 'pending', answers: [] },
  appraisals: { state: 'draft', reviewerIds: [], peerNominations: [] },
  cycles: { status: 'draft' },
  templates: { isArchived: false, sections: [] },
  nudges: { channel: 'app' },
  users: { status: 'active' },
};

// ---------------------------------------------------------------------------
function deepClone(v) {
  if (v == null) return v;
  if (v instanceof mongoose.Types.ObjectId) return v;
  if (v instanceof Date) return new Date(v.getTime());
  if (Array.isArray(v)) return v.map(deepClone);
  if (typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v)) out[k] = deepClone(v[k]);
    return out;
  }
  return v;
}

function getDeep(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function setDeep(obj, path, value) {
  const keys = path.split('.');
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i += 1) {
    cur[keys[i]] = cur[keys[i]] || {};
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = value;
}

/** Mirrors mongoose's `.select('a b c.d')`: whitespace-separated inclusion
 * paths, `_id` always included. Operates on an already-deep-cloned plain
 * object (never the live stored document). */
function pick(obj, selectSpec) {
  if (!obj) return obj;
  if (!selectSpec) return obj;
  const fields = selectSpec.trim().split(/\s+/).filter(Boolean);
  const out = { _id: obj._id };
  for (const f of fields) {
    if (f === '_id') continue;
    if (f.includes('.')) setDeep(out, f, getDeep(obj, f));
    else out[f] = obj[f];
  }
  return out;
}

function matchesFilter(doc, filter) {
  for (const [key, val] of Object.entries(filter || {})) {
    if (val === undefined) continue;
    if (val && typeof val === 'object' && !(val instanceof Date) && !(val instanceof mongoose.Types.ObjectId)) {
      if (Object.prototype.hasOwnProperty.call(val, '$in')) {
        const set = new Set(val.$in.map(String));
        if (!set.has(String(doc[key]))) return false;
        continue;
      }
      if (Object.prototype.hasOwnProperty.call(val, '$nin')) {
        const set = new Set(val.$nin.map(String));
        if (set.has(String(doc[key]))) return false;
        continue;
      }
      // Before this branch existed `{x: {$ne: null}}` fell through to the
      // stringified equality below, compared 'null' against '[object Object]'
      // and so matched NOTHING — every test using it stayed green while the
      // branch it was meant to exercise was unreachable. A missing field
      // fails `$ne: null` exactly as it does on real Mongo.
      if (Object.prototype.hasOwnProperty.call(val, '$ne')) {
        const actual = doc[key];
        if (val.$ne === null || val.$ne === undefined) {
          if (actual === null || actual === undefined) return false;
        } else if (String(actual) === String(val.$ne)) {
          return false;
        }
        continue;
      }
    }
    if (String(doc[key]) !== String(val)) return false;
  }
  return true;
}

function sortDocs(docs, spec) {
  const entries = Object.entries(spec || {});
  if (!entries.length) return docs;
  return [...docs].sort((a, b) => {
    for (const [key, dir] of entries) {
      const av = a[key];
      const bv = b[key];
      let cmp;
      if (av instanceof Date || bv instanceof Date) {
        cmp = (av ? av.getTime() : 0) - (bv ? bv.getTime() : 0);
      } else if (typeof av === 'string' || typeof bv === 'string') {
        cmp = String(av ?? '').localeCompare(String(bv ?? ''));
      } else {
        cmp = (av ?? 0) - (bv ?? 0);
      }
      if (cmp !== 0) return dir < 0 ? -cmp : cmp;
    }
    return 0;
  });
}

/** Values a caller can mutate in place (`doc.reviewerIds.push(...)`) and so
 * must be handed a staged copy of rather than the stored object itself. */
function isMutableValue(v) {
  return (
    v != null &&
    typeof v === 'object' &&
    !(v instanceof Date) &&
    !(v instanceof mongoose.Types.ObjectId)
  );
}

/**
 * Mimics a REAL hydrated Mongoose document's shape closely enough to
 * exercise the hazard `omit()` / `projectFeedbackForViewer()` are written to
 * route around: a hydrated document's own enumerable properties are internal
 * bookkeeping ($__, _doc), not the schema paths, so `{ ...doc }` copies none
 * of the actual fields. Schema paths are exposed only via non-enumerable
 * accessor properties.
 *
 * Writes are STAGED, not written through. The wrapper buffers every set into
 * `pending` and only merges it into `storedDoc` — the object living in the
 * harness's backing array, which is what every subsequent query reads — when
 * `.save()` is called. The earlier write-through version made a missing
 * `.save()` completely undetectable: deleting the save from `nominatePeers`
 * left the entire suite green, because the mutation had already landed in the
 * store the moment the assignment ran. Reading a mutable value stages a clone
 * for the same reason, so an in-place `doc.reviewerIds.push(...)` mutates the
 * staged copy rather than reaching the store behind save's back.
 */
function makeHydrated(storedDoc, fieldList) {
  const wrapper = {};
  const pending = {};
  const current = () => ({ ...storedDoc, ...pending });

  Object.defineProperty(wrapper, '$__', { value: {}, enumerable: true, configurable: true });
  Object.defineProperty(wrapper, '_doc', { value: storedDoc, enumerable: true, configurable: true });
  Object.defineProperty(wrapper, 'toObject', {
    value() { return current(); },
    enumerable: false, configurable: true, writable: true,
  });
  Object.defineProperty(wrapper, 'save', {
    async value(opts) { // eslint-disable-line no-unused-vars
      Object.assign(storedDoc, pending);
      for (const k of Object.keys(pending)) delete pending[k];
      storedDoc.updatedAt = new Date();
      return wrapper;
    },
    enumerable: false, configurable: true, writable: true,
  });
  Object.defineProperty(wrapper, 'session', {
    value() { return wrapper; },
    enumerable: false, configurable: true, writable: true,
  });
  const keys = new Set(['_id', ...(fieldList || []), ...Object.keys(storedDoc)]);
  for (const key of keys) {
    Object.defineProperty(wrapper, key, {
      enumerable: false,
      configurable: true,
      get() {
        if (Object.prototype.hasOwnProperty.call(pending, key)) return pending[key];
        const v = storedDoc[key];
        if (!isMutableValue(v)) return v;
        pending[key] = deepClone(v);
        return pending[key];
      },
      set(v) { pending[key] = v; },
    });
  }
  return wrapper;
}

/** Deep copy of every collection, for transaction rollback. */
function snapshotDb(db) {
  const snap = {};
  for (const key of Object.keys(db)) snap[key] = db[key].map(deepClone);
  return snap;
}

/** Restore in place, so the arrays the stubs closed over stay the same objects. */
function restoreDb(db, snap) {
  for (const key of Object.keys(db)) {
    db[key].splice(0, db[key].length, ...snap[key].map(deepClone));
  }
}

function applyPopulate(harness, collectionName, plainDoc, populates) {
  for (const raw of populates || []) {
    const spec = typeof raw === 'string' ? { path: raw } : raw;
    const { path, select } = spec;
    const dotIndex = path.indexOf('.');
    if (dotIndex !== -1) {
      const arrKey = path.slice(0, dotIndex);
      const subKey = path.slice(dotIndex + 1);
      const arr = plainDoc[arrKey];
      const refCollection = SUBDOC_REF_MAP[`${collectionName}.${path}`];
      if (Array.isArray(arr) && refCollection) {
        for (const item of arr) {
          const resolved = harness.findPlainById(refCollection, item[subKey]);
          item[subKey] = resolved ? pick(resolved, select) : null;
        }
      }
      continue;
    }
    const refCollection = (REF_MAP[collectionName] || {})[path];
    if (!refCollection) continue;
    const id = plainDoc[path];
    const resolved = id == null ? null : harness.findPlainById(refCollection, id);
    const value = resolved ? pick(resolved, select) : null;
    if (value && spec.populate) {
      const nested = Array.isArray(spec.populate) ? spec.populate : [spec.populate];
      applyPopulate(harness, refCollection, value, nested);
    }
    plainDoc[path] = value;
  }
}

// ---------------------------------------------------------------------------
class FakeQuery {
  constructor(harness, collectionName, filter, { multi }) {
    this.harness = harness;
    this.collectionName = collectionName;
    this.filter = filter || {};
    this.multi = multi;
    this._populates = [];
    this._select = null;
    this._sort = null;
    this._skip = 0;
    this._limit = null;
  }

  populate(pathOrSpec, select) {
    this._populates.push(typeof pathOrSpec === 'string' ? { path: pathOrSpec, select } : pathOrSpec);
    return this;
  }

  select(spec) { this._select = spec; return this; }

  sort(spec) { this._sort = spec; return this; }

  // Previously unstubbed, so calling either threw a bare TypeError and Task 8
  // paginated in memory instead. Applied after the sort and in mongo's order
  // (skip, then limit); the defaults are a no-op, so nothing that never calls
  // them changes behaviour.
  skip(n) { this._skip = Number(n) || 0; return this; }

  limit(n) { this._limit = n == null ? null : Number(n); return this; }

  // No real session semantics (see the repo's existing stubs) — just a
  // chainable no-op so `Appraisal.findOne(...).session(session)` parses.
  session() { return this; }

  // Terminal, matching the repo's existing `lean: async () => resolveFn()`
  // idiom rather than real mongoose's chainable-but-thenable `.lean()`.
  lean() { return this._resolve(true); }

  then(resolve, reject) { this._resolve(false).then(resolve, reject); }

  catch(reject) { return this._resolve(false).catch(reject); }

  async _resolve(leanFlag) {
    const all = this.harness.db[this.collectionName];
    let matched = all.filter((doc) => matchesFilter(doc, this.filter));
    if (this._sort) matched = sortDocs(matched, this._sort);
    if (this._skip) matched = matched.slice(this._skip);
    if (this._limit != null) matched = matched.slice(0, this._limit);
    if (!this.multi) {
      const doc = matched[0];
      if (!doc) return null;
      return this.harness.shapeDoc(this.collectionName, doc, {
        lean: leanFlag, populates: this._populates, select: this._select,
      });
    }
    return matched.map((doc) => this.harness.shapeDoc(this.collectionName, doc, {
      lean: leanFlag, populates: this._populates, select: this._select,
    }));
  }
}

class Harness {
  constructor(db) { this.db = db; }

  query(collectionName, filter, opts) {
    return new FakeQuery(this, collectionName, filter, opts);
  }

  findPlainById(collectionName, id) {
    if (id == null) return null;
    const doc = this.db[collectionName].find((d) => String(d._id) === String(id));
    return doc ? deepClone(doc) : null;
  }

  shapeDoc(collectionName, storedDoc, { lean, populates, select }) {
    if (lean) {
      const plain = deepClone(storedDoc);
      applyPopulate(this, collectionName, plain, populates);
      return select ? pick(plain, select) : plain;
    }
    // Hydrated + mutable, backed live by storedDoc. No controller in this
    // module combines `.populate()` with a non-.lean() single-doc read (every
    // mutable findOne is a bare `.save()`-bound read), so populate on this
    // path is intentionally unsupported rather than half-implemented.
    return makeHydrated(storedDoc, FIELD_LISTS[collectionName]);
  }

  insertOne(collectionName, data) {
    const now = new Date();
    const stored = {
      _id: data._id || new mongoose.Types.ObjectId(),
      createdAt: now,
      updatedAt: now,
      ...DEFAULTS[collectionName],
      ...data,
    };
    this.db[collectionName].push(stored);
    return stored;
  }

  count(collectionName, filter) {
    return Promise.resolve(this.db[collectionName].filter((d) => matchesFilter(d, filter)).length);
  }

  exists(collectionName, filter) {
    const doc = this.db[collectionName].find((d) => matchesFilter(d, filter));
    return Promise.resolve(doc ? { _id: doc._id } : null);
  }

  updateOne(collectionName, filter, update) {
    const doc = this.db[collectionName].find((d) => matchesFilter(d, filter));
    if (!doc) return Promise.resolve({ matchedCount: 0, modifiedCount: 0 });
    if (update.$set) Object.assign(doc, update.$set);
    doc.updatedAt = new Date();
    return Promise.resolve({ matchedCount: 1, modifiedCount: 1 });
  }

  updateMany(collectionName, filter, update) {
    const matched = this.db[collectionName].filter((d) => matchesFilter(d, filter));
    for (const d of matched) {
      if (update.$set) Object.assign(d, update.$set);
      d.updatedAt = new Date();
    }
    return Promise.resolve({ modifiedCount: matched.length });
  }

  // Minimal support for the one pipeline shape appraisalCycle.controller.js
  // actually issues: `[{ $match }, { $group: { _id: '$field', x: {$sum:1} } }]`.
  aggregate(collectionName, pipeline) {
    let rows = this.db[collectionName].map(deepClone);
    for (const stage of pipeline || []) {
      if (stage.$match) {
        rows = rows.filter((d) => matchesFilter(d, stage.$match));
      } else if (stage.$group) {
        const groupSpec = stage.$group;
        const idExpr = groupSpec._id;
        const groups = new Map();
        for (const row of rows) {
          const key = typeof idExpr === 'string' && idExpr.startsWith('$') ? row[idExpr.slice(1)] : idExpr;
          const k = String(key);
          if (!groups.has(k)) groups.set(k, { _id: key });
          const g = groups.get(k);
          for (const [outField, accSpec] of Object.entries(groupSpec)) {
            if (outField === '_id') continue;
            if (accSpec && accSpec.$sum === 1) g[outField] = (g[outField] || 0) + 1;
          }
        }
        rows = [...groups.values()];
      }
    }
    return Promise.resolve(rows);
  }
}

// ---------------------------------------------------------------------------
function makeCreateStatic(harness, collectionName) {
  return async function create(dataOrArray) {
    const isArray = Array.isArray(dataOrArray);
    const items = isArray ? dataOrArray : [dataOrArray];
    const stored = items.map((d) => harness.insertOne(collectionName, d));
    const hydrated = stored.map((s) => makeHydrated(s, FIELD_LISTS[collectionName]));
    return isArray ? hydrated : hydrated[0];
  };
}

function installModelStubs(harness, { transientFailures = 0 } = {}) {
  // How many attempts still have to be aborted-and-retried, counted down by
  // the next transaction(s) to run ANYWHERE. `transientFailures` seeds it at
  // construction; `failNextTransaction()` (returned from makeHarness) adds to
  // it mid-test, which is how a test targets one specific handler's
  // transaction rather than whichever one happens to run first.
  const state = { failuresLeft: transientFailures };

  const originals = {
    AppraisalFindOne: Appraisal.findOne,
    AppraisalFind: Appraisal.find,
    AppraisalCreate: Appraisal.create,
    AppraisalAggregate: Appraisal.aggregate,
    AppraisalCountDocuments: Appraisal.countDocuments,
    FeedbackFindOne: AppraisalFeedback.findOne,
    FeedbackFind: AppraisalFeedback.find,
    FeedbackInsertMany: AppraisalFeedback.insertMany,
    FeedbackCountDocuments: AppraisalFeedback.countDocuments,
    FeedbackUpdateMany: AppraisalFeedback.updateMany,
    CycleFindOne: AppraisalCycle.findOne,
    CycleFind: AppraisalCycle.find,
    CycleCreate: AppraisalCycle.create,
    CycleExists: AppraisalCycle.exists,
    CycleUpdateMany: AppraisalCycle.updateMany,
    TemplateFindOne: AppraisalTemplate.findOne,
    TemplateFind: AppraisalTemplate.find,
    TemplateCreate: AppraisalTemplate.create,
    TemplateFindOneAndUpdate: AppraisalTemplate.findOneAndUpdate,
    TemplateUpdateOne: AppraisalTemplate.updateOne,
    TemplateUpdateMany: AppraisalTemplate.updateMany,
    TemplateExists: AppraisalTemplate.exists,
    TemplateCountDocuments: AppraisalTemplate.countDocuments,
    NudgeFindOne: AppraisalNudge.findOne,
    NudgeFind: AppraisalNudge.find,
    NudgeCreate: AppraisalNudge.create,
    NudgeCountDocuments: AppraisalNudge.countDocuments,
    UserFind: User.find,
    UserFindOne: User.findOne,
    startSession: mongoose.startSession,
  };

  Appraisal.findOne = (filter) => harness.query('appraisals', filter, { multi: false });
  Appraisal.find = (filter) => harness.query('appraisals', filter, { multi: true });
  Appraisal.create = makeCreateStatic(harness, 'appraisals');
  Appraisal.aggregate = async (pipeline) => harness.aggregate('appraisals', pipeline);
  Appraisal.countDocuments = async (filter) => harness.count('appraisals', filter);

  AppraisalFeedback.findOne = (filter) => harness.query('feedback', filter, { multi: false });
  AppraisalFeedback.find = (filter) => harness.query('feedback', filter, { multi: true });
  AppraisalFeedback.insertMany = async (docs) => docs.map((d) => harness.insertOne('feedback', d));
  AppraisalFeedback.countDocuments = async (filter) => harness.count('feedback', filter);
  AppraisalFeedback.updateMany = async (filter, update) => harness.updateMany('feedback', filter, update);

  AppraisalCycle.findOne = (filter) => harness.query('cycles', filter, { multi: false });
  AppraisalCycle.find = (filter) => harness.query('cycles', filter, { multi: true });
  AppraisalCycle.create = makeCreateStatic(harness, 'cycles');
  AppraisalCycle.exists = async (filter) => harness.exists('cycles', filter);
  AppraisalCycle.updateMany = async (filter, update) => harness.updateMany('cycles', filter, update);

  AppraisalTemplate.findOne = (filter) => harness.query('templates', filter, { multi: false });
  AppraisalTemplate.find = (filter) => harness.query('templates', filter, { multi: true });
  AppraisalTemplate.create = makeCreateStatic(harness, 'templates');
  AppraisalTemplate.updateOne = async (filter, update) => harness.updateOne('templates', filter, update);
  AppraisalTemplate.updateMany = async (filter, update) => harness.updateMany('templates', filter, update);
  AppraisalTemplate.exists = async (filter) => harness.exists('templates', filter);
  AppraisalTemplate.countDocuments = async (filter) => harness.count('templates', filter);

  // Simulates a real atomic upsert against the {tenant} partial unique index
  // (isDefault:true, isLatest:true) from Task 1. Two `await Promise.resolve()`
  // yield points are deliberate, not decorative: they split the operation into
  // "check for a match" and "insert" phases separated by a real microtask
  // boundary, so two concurrent callers (Promise.all) can both cross the
  // check before either writes — reproducing a genuine check-then-act race
  // instead of relying on Node's single-threaded scheduling to serialize two
  // Promise.all'd calls, which would make the concurrency test pass without
  // ever exercising the duplicate-key path. Whichever caller's insert lands
  // second re-checks the index predicate immediately before writing and
  // throws `{code: 11000}` — exactly what a real unique index rejects the
  // second writer with — so the controller's catch-and-reread path is
  // exercised for real, not just in the test that mocks this function.
  AppraisalTemplate.findOneAndUpdate = async (filter, update, opts = {}) => {
    const { upsert = false, new: returnNew = false } = opts || {};
    const all = harness.db.templates;

    await Promise.resolve();
    const existing = all.find((doc) => matchesFilter(doc, filter));
    if (existing) {
      if (update && update.$set) Object.assign(existing, update.$set);
      existing.updatedAt = new Date();
      return returnNew ? harness.shapeDoc('templates', existing, { lean: false }) : null;
    }
    if (!upsert) return null;

    await Promise.resolve();
    const stillMissing = !all.some((doc) => matchesFilter(doc, filter));
    if (!stillMissing) {
      const err = new Error(
        'E11000 duplicate key error collection: templates index: tenant_1_isDefault_1_isLatest_1 dup key'
      );
      err.code = 11000;
      throw err;
    }

    // Real upsert semantics: the inserted document is seeded from the
    // query's own equality predicates, then $setOnInsert is layered on top.
    // Naming a filter field in $setOnInsert too is a path conflict on real
    // Mongo, not a merge — callers must destructure it out (see
    // ensureDefaultTemplate).
    const seed = { ...(filter || {}), ...(update?.$setOnInsert || {}) };
    const stored = harness.insertOne('templates', seed);
    return returnNew ? harness.shapeDoc('templates', stored, { lean: false }) : null;
  };

  // Nudges are read newest-first (the roster's "nudged 2d ago" and the
  // 12-hour throttle both want the latest row), which is a plain
  // `.sort({sentAt:-1})` the FakeQuery already handles.
  AppraisalNudge.findOne = (filter) => harness.query('nudges', filter, { multi: false });
  AppraisalNudge.find = (filter) => harness.query('nudges', filter, { multi: true });
  AppraisalNudge.create = makeCreateStatic(harness, 'nudges');
  AppraisalNudge.countDocuments = async (filter) => harness.count('nudges', filter);

  User.find = (filter) => harness.query('users', filter, { multi: true });
  User.findOne = (filter) => harness.query('users', filter, { multi: false });

  // A real `withTransaction` re-runs its ENTIRE callback on a transient
  // error, having first rolled the aborted attempt's writes back. That is the
  // exact shape that cost this module two bugs — launchCycle's `created.push`
  // double-count and applyPeerDecisions' silently-dropped feedback rows — and
  // the previous pass-through stub (`await fn()`) exercised neither half of
  // it. Rollback is a real deep restore of the backing arrays, so a handler
  // that mutates a document loaded OUTSIDE the callback is left holding an
  // orphan, precisely as it would be against MongoDB.
  mongoose.startSession = async () => ({
    withTransaction: async (fn) => {
      for (;;) {
        const snapshot = snapshotDb(harness.db);
        let out;
        try {
          out = await fn();
        } catch (err) {
          restoreDb(harness.db, snapshot);
          throw err;
        }
        if (state.failuresLeft > 0) {
          state.failuresLeft -= 1;
          restoreDb(harness.db, snapshot);
          continue;
        }
        return out;
      }
    },
    endSession() {},
  });

  function failNextTransaction(times = 1) {
    state.failuresLeft += times;
  }

  function restore() {
    Appraisal.findOne = originals.AppraisalFindOne;
    Appraisal.find = originals.AppraisalFind;
    Appraisal.create = originals.AppraisalCreate;
    Appraisal.aggregate = originals.AppraisalAggregate;
    Appraisal.countDocuments = originals.AppraisalCountDocuments;
    AppraisalFeedback.findOne = originals.FeedbackFindOne;
    AppraisalFeedback.find = originals.FeedbackFind;
    AppraisalFeedback.insertMany = originals.FeedbackInsertMany;
    AppraisalFeedback.countDocuments = originals.FeedbackCountDocuments;
    AppraisalFeedback.updateMany = originals.FeedbackUpdateMany;
    AppraisalCycle.findOne = originals.CycleFindOne;
    AppraisalCycle.find = originals.CycleFind;
    AppraisalCycle.create = originals.CycleCreate;
    AppraisalCycle.exists = originals.CycleExists;
    AppraisalCycle.updateMany = originals.CycleUpdateMany;
    AppraisalTemplate.findOne = originals.TemplateFindOne;
    AppraisalTemplate.find = originals.TemplateFind;
    AppraisalTemplate.create = originals.TemplateCreate;
    AppraisalTemplate.findOneAndUpdate = originals.TemplateFindOneAndUpdate;
    AppraisalTemplate.updateOne = originals.TemplateUpdateOne;
    AppraisalTemplate.updateMany = originals.TemplateUpdateMany;
    AppraisalTemplate.exists = originals.TemplateExists;
    AppraisalTemplate.countDocuments = originals.TemplateCountDocuments;
    AppraisalNudge.findOne = originals.NudgeFindOne;
    AppraisalNudge.find = originals.NudgeFind;
    AppraisalNudge.create = originals.NudgeCreate;
    AppraisalNudge.countDocuments = originals.NudgeCountDocuments;
    User.find = originals.UserFind;
    User.findOne = originals.UserFindOne;
    mongoose.startSession = originals.startSession;
  }

  return { restore, failNextTransaction };
}

// ---------------------------------------------------------------------------
/**
 * Seed a fresh in-memory tenant and install the model stubs. `users` seeds
 * db.users (each needs at least `_id`, `tenant`, `role`, and — for anyone who
 * might be nominated — `employeeProfile.work.manager` if launchCycle's
 * manager-resolution needs to see it). `cycle`/`template` are optional
 * starting fixtures; omit them and drive `createCycle`/`launchCycle`
 * end-to-end instead if a test wants that path exercised too.
 *
 * `transientFailures` makes the first N transactions abort-and-replay (see
 * the withTransaction stub). Prefer the returned `failNextTransaction()` when
 * the transaction under test is not the first one the scenario runs — e.g.
 * launching a cycle opens one transaction per employee before approvePeers
 * ever opens its own.
 */
function makeHarness({ users = [], cycle, template, transientFailures = 0 } = {}) {
  const db = { users: [], appraisals: [], feedback: [], cycles: [], templates: [], nudges: [] };

  for (const u of users) {
    db.users.push({ status: 'active', role: 'tenant_staff', ...u, _id: u._id || new mongoose.Types.ObjectId() });
  }

  let templateId = template && template._id;
  if (template) {
    templateId = template._id || new mongoose.Types.ObjectId();
    db.templates.push({ isArchived: false, sections: [], ...template, _id: templateId });
  }

  if (cycle) {
    db.cycles.push({
      status: 'draft',
      peerReviewEnabled: true,
      nominationDeadline: null,
      feedbackDeadline: null,
      template: templateId,
      ...cycle,
      _id: cycle._id || new mongoose.Types.ObjectId(),
    });
  }

  const harness = new Harness(db);
  const { restore, failNextTransaction } = installModelStubs(harness, { transientFailures });
  return { db, restore, failNextTransaction };
}

/** A fake `req` carrying `{ user, tenant: {_id}, params, body }`. */
function asUser(user, { params = {}, body = {} } = {}) {
  return { user, tenant: { _id: user.tenant }, params, body };
}

/**
 * A fake `res`. `res.status` starts as the callable Express-style method;
 * calling `res.status(code)` immediately collapses the property to the
 * numeric `code` itself (every handler in this module calls it at most
 * once), and `res.json(...)` collapses it to 200 if nothing called
 * `.status()` first — so `res.status` reads as a plain number for
 * `assert.strictEqual(res.status, 200)` once a response has actually gone
 * out, exactly like the brief's checklist expects.
 */
function capture() {
  const res = {};
  res.status = function status(code) {
    res.status = code;
    return res;
  };
  res.json = function json(payload) {
    res.body = payload;
    if (typeof res.status === 'function') res.status = 200;
    return res;
  };
  return res;
}

module.exports = { makeHarness, asUser, capture };
