const test = require("node:test");
const assert = require("node:assert/strict");
const Product = require("../models/Product");
const notifications = require("../services/notification.service");
const service = require("../services/product.service");
const id = "aaaaaaaaaaaaaaaaaaaaaaaa";
const actor = { _id: "admin", role: "super_admin" };

async function withDecision(action, fail = false) {
  const original = Product.findById;
  const method =
    action === "approved"
      ? "sendProductApprovedNotification"
      : "sendProductRejectedNotification";
  const originalNotice = notifications[method];
  const saved = [];
  const calls = [];
  const product = {
    _id: id,
    name: "Wine",
    submittingTenant: "tenant",
    status: "pending",
    save: async function () {
      saved.push(this.status);
    },
  };
  let reads = 0;
  Product.findById = () => {
    if (++reads === 1) return Promise.resolve(product);
    const cursor = {
      populate() {
        return this;
      },
      lean: async () => product,
    };
    return cursor;
  };
  notifications[method] = async (...args) => {
    calls.push({ args, saved: [...saved] });
    if (fail) throw Error("delivery unavailable");
    return { success: true };
  };
  try {
    const result =
      action === "approved"
        ? await service.approveProduct(id, actor)
        : await service.rejectProduct(id, "  Correct the volume  ", actor);
    assert.equal(result.status, action);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].saved, [action]);
    assert.equal(calls[0].args[0], id);
    assert.equal(calls[0].args[1], actor._id);
    assert.equal(calls[0].args.at(-1).name, "Wine");
    if (action === "rejected")
      assert.equal(calls[0].args[2], "Correct the volume");
  } finally {
    Product.findById = original;
    notifications[method] = originalNotice;
  }
}
test("saved approval dispatches its tenant notification", () =>
  withDecision("approved"));
test("saved rejection dispatches its reason and decision snapshot", () =>
  withDecision("rejected"));
test("notification delivery failure does not undo a saved approval", () =>
  withDecision("approved", true));

test("notice producers use saved decision evidence rather than re-reading a changed catalogue record", async () => {
  const User = require("../models/User");
  const N = require("../models/Notification");
  const original = {
    product: Product.findById,
    users: User.find,
    insert: N.insertMany,
  };
  const rows = [];
  Product.findById = () => {
    throw Error("snapshot must be used");
  };
  User.find = () => ({
    select: () => ({
      lean: async () => [{ _id: "u", tenant: "tenant", role: "tenant_owner" }],
    }),
  });
  N.insertMany = async (docs) => {
    rows.push(...docs);
    return docs;
  };
  const snapshot = {
    _id: id,
    name: "Decision Wine",
    submittingTenant: "tenant",
  };
  try {
    assert.equal(
      (
        await notifications.sendProductApprovedNotification(
          id,
          actor._id,
          snapshot,
        )
      ).success,
      true,
    );
    assert.equal(
      (
        await notifications.sendProductRejectedNotification(
          id,
          actor._id,
          "Correct volume",
          snapshot,
        )
      ).success,
      true,
    );
    assert.equal(rows[0].metadata.productName, "Decision Wine");
    assert.equal(rows[1].metadata.rejectionReason, "Correct volume");
    assert.equal(rows[1].metadata.productName, "Decision Wine");
    assert.equal(rows[1].tenant, "tenant");
  } finally {
    Product.findById = original.product;
    User.find = original.users;
    N.insertMany = original.insert;
  }
});
