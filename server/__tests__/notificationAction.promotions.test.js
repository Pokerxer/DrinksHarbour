const test = require("node:test");
const assert = require("node:assert/strict");
const { safeNotificationAction } = require("../utils/notificationAction");
test("promotion inbox actions retain the same strict internal query allowlist", () => {
  assert.equal(safeNotificationAction("/notifications/promotions"), true);
  assert.equal(
    safeNotificationAction(
      "/notifications/promotions?warehouseId=0123456789abcdef01234567",
    ),
    true,
  );
  for (const url of [
    "/notifications/promotions?tenantId=foreign",
    "/notifications/promotions?next=https://evil.test",
    "//evil.test/notifications/promotions",
  ])
    assert.equal(safeNotificationAction(url), false);
});
