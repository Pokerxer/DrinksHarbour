const test = require("node:test");
const assert = require("node:assert/strict");
const {
  parseOptions,
  createInboxService,
} = require("../services/tenantNotifications.service");
test("validates notification search and sort inputs", () => {
  assert.equal(
    parseOptions({ search: " wine ", sort: "oldest" }).search,
    "wine",
  );
  assert.equal(parseOptions({ sort: "oldest" }).sort, "oldest");
  for (const query of [
    { search: {} },
    { search: "a".repeat(201) },
    { sort: "injected" },
  ])
    assert.throws(() => parseOptions(query));
});
test("product decision filters only accept approved/rejected types in the products category", () => {
  assert.equal(
    parseOptions({ category: "products", type: "product_rejected" }).type,
    "product_rejected",
  );
  for (const q of [
    { category: "products", type: "low_stock_alert" },
    { category: "stock", type: "product_approved" },
    { type: {} },
  ])
    assert.throws(() => parseOptions(q));
});
test("matching unread counts retain product decision/search scope without changing account unread count", async () => {
  const counts = [];
  let filter;
  const cursor = {
    sort() {
      return this;
    },
    skip() {
      return this;
    },
    limit() {
      return this;
    },
    select() {
      return this;
    },
    lean: async () => [],
  };
  const model = {
    find(q) {
      filter = q;
      return cursor;
    },
    async countDocuments(q) {
      counts.push(q);
      return counts.length === 1 ? 60 : counts.length === 2 ? 100 : 55;
    },
  };
  const result = await createInboxService(
    model,
    () => new Date(),
    async () => {},
  ).list({
    user: {
      _id: "user",
      tenant: "tenant",
      role: "tenant_admin",
      status: "active",
    },
    query: {
      category: "products",
      type: "product_rejected",
      search: "wine",
      page: "2",
    },
  });
  assert.deepEqual(filter.type, { $in: ["product_rejected"] });
  assert.equal(result.unreadCount, 100);
  assert.equal(result.matchingUnreadCount, 55);
  assert.deepEqual(counts[2], { ...filter, isRead: false });
  assert.equal(counts[2].tenant, "tenant");
  assert.equal(counts[2].recipient, "user");
});
test("search is escaped and scoped before pagination and counts", async () => {
  let filter, order, countFilter;
  const cursor = {
    sort(v) {
      order = v;
      return this;
    },
    skip() {
      return this;
    },
    limit() {
      return this;
    },
    select() {
      return this;
    },
    lean: async () => [],
  };
  const model = {
    find(q) {
      filter = q;
      return cursor;
    },
    async countDocuments(q) {
      if (q.isRead !== false) countFilter = q;
      return 0;
    },
  };
  await createInboxService(
    model,
    () => new Date(),
    async () => {},
  ).list({
    user: {
      _id: "user",
      tenant: "tenant",
      role: "tenant_admin",
      status: "active",
    },
    query: { category: "products", search: "wine [2019]", sort: "oldest" },
  });
  assert.equal(filter.tenant, "tenant");
  assert.equal(filter.recipient, "user");
  assert.deepEqual(order, { createdAt: 1, _id: 1 });
  assert.equal(filter.$and.at(-1).$or[0].title.$regex, "wine \\[2019\\]");
  assert.equal(countFilter, filter);
});
