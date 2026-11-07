// Test-only bridge: applications remain independent. No Next startup or .env loading.
import path from "node:path";
const root = process.cwd();
const website =
  process.env.WYN_STOREFRONT_PATH ||
  path.resolve(root, "../wyn-city-storefront");
const source = process.env.WYN_PILOT_PATCH_ROOT || website;
export default {
  test: {
    include: ["scripts/pilots/wyn-customer-compatibility.test.ts"],
    environment: "node",
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.join(source, "src"),
      "@wyn": path.join(source, "src"),
      [path.join(website, "src")]: path.join(source, "src"),
      zod: path.join(website, "node_modules/zod/index.js"),
      react: path.join(website, "node_modules/react/index.js"),
      "server-only": path.join(root, "scripts/pilots/server-only-fixture.mjs"),
      "next/headers": path.join(root, "scripts/pilots/next-cookie-fixture.mjs"),
      "next/navigation": path.join(website, "node_modules/next/navigation.js"),
      "next/server": path.join(website, "node_modules/next/server.js"),
    },
  },
};
