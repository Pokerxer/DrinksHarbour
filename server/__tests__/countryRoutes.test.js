"use strict";
const test = require("node:test"),
  assert = require("node:assert/strict");
let router;
try {
  router = require("../routes/country.routes");
} catch (e) {
  if (e.code !== "MODULE_NOT_FOUND") throw e;
}
test("country router exposes public browse and explicit privileged configuration review activation commands", () => {
  assert.ok(router, "country route must exist");
  const routes = router.stack
    .filter((layer) => layer.route)
    .map(
      (layer) => `${Object.keys(layer.route.methods)[0]} ${layer.route.path}`,
    );
  for (const route of [
    "get /",
    "get /:code",
    "get /admin",
    "post /admin",
    "put /admin/:code",
    "post /admin/:code/review",
    "post /admin/:code/activation",
  ])
    assert.ok(routes.includes(route), route);
});
