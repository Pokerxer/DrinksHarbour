const fs = require("fs"),
  path = require("path");
// Isolated layout audit: actual orders markup, synthetic data and stubbed auth/nav.
// Run from the repo root: node scripts/pos-orders-layout-audit.cjs
const root = path.resolve(__dirname, "..");
const req = require("module").createRequire(
  root + "/client/apps/admin/package.json",
);
const ts = req("typescript"),
  React = req("react");
const dir = root + "/client/apps/admin/src/app/shared/point-of-sale";
const order = {
  _id: "fixture",
  receiptNumber: "POS-2026-000123",
  total: 123456789.25,
  paymentMethod: "cash",
  placedAt: "2026-09-29T12:00:00Z",
  createdAt: "2026-09-29T12:00:00Z",
  items: [],
  posStaff: {
    _id: "staff",
    firstName: "Alexandria",
    lastName: "Long Cashier Name",
  },
};
function load(file, detail = false) {
  let code = fs.readFileSync(file, "utf8");
  if (file.endsWith("/pos-orders.tsx"))
    code = code
      .replace(
        "useState<PosOrder[]>([])",
        `useState<PosOrder[]>(${JSON.stringify([order])})`,
      )
      .replace("useState(true)", "useState(false)")
      .replace(
        "useState<PosOrder | null>(null)",
        `useState<PosOrder | null>(${detail ? JSON.stringify(order) : "null"})`,
      );
  const mod = { exports: {} };
  const local = (id) => {
    if (id === "next-auth/react")
      return { useSession: () => ({ data: null, status: "authenticated" }) };
    if (id.endsWith("/store"))
      return {
        usePOSAuth: () => ({ token: null, tenant: null }),
        usePOSShopScope: () => ({ shopId: "retail" }),
      };
    if (id.endsWith("/utils"))
      return {
        formatCurrency: (n) =>
          "₦" + n.toLocaleString("en-NG", { minimumFractionDigits: 2 }),
      };
    if (id.endsWith("/pos-nav-header"))
      return {
        __esModule: true,
        default: () =>
          React.createElement(
            "nav",
            { style: { height: 48 } },
            "Point of Sale",
          ),
      };
    if (id.includes("InvoicePreview"))
      return { __esModule: true, default: () => null };
    if (id.startsWith("@/")) return new Proxy({}, { get: () => () => null });
    if (id.includes("shop-history-selector"))
      return {
        ShopHistorySelector: () =>
          React.createElement("label", null, "Shop: Retail"),
      };
    if (id.startsWith(".")) {
      const p = path.resolve(path.dirname(file), id);
      for (const ext of [".ts", ".tsx"])
        if (fs.existsSync(p + ext)) return load(p + ext);
    }
    return req(id);
  };
  new Function(
    "require",
    "module",
    "exports",
    ts.transpileModule(code, {
      compilerOptions: {
        jsx: ts.JsxEmit.React,
        module: ts.ModuleKind.CommonJS,
        esModuleInterop: true,
      },
    }).outputText,
  )(local, mod, mod.exports);
  return mod.exports;
}
(async () => {
  const browser = await require(
    root + "/node_modules/playwright",
  ).chromium.launch();
  const page = await browser.newPage();
  let failed = false;
  for (const detail of [false, true]) {
    const html = req("react-dom/server").renderToStaticMarkup(
      React.createElement(load(dir + "/pos-orders.tsx", detail).default),
    );
    const css = await req("postcss")([
      req("tailwindcss")({ content: [{ raw: html, extension: "html" }] }),
    ]).process("@tailwind base; @tailwind utilities;", { from: undefined });
    for (const width of [320, 390, 640, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 700 });
      await page.setContent(`<style>${css.css}</style>${html}`);
      const result = await page.evaluate(() => {
        const table = document.querySelector("table");
        const r = table?.parentElement.getBoundingClientRect();
        return {
          overflow: document.documentElement.scrollWidth > innerWidth,
          tableHeight: r?.height,
          bodyHeight: document.body.scrollHeight,
          clippedInputs: [
            ...document.querySelectorAll("input[type=date],input[type=time]"),
          ].some((input) => {
            const r = input.getBoundingClientRect();
            return (
              r.width < (input.type === "date" ? 120 : 90) ||
              r.right > innerWidth ||
              r.left < 0
            );
          }),
        };
      });
      const ok =
        !result.overflow && !result.clippedInputs && result.tableHeight >= 180;
      if (!ok) failed = true;
      console.log(JSON.stringify({ width, detail, ok, ...result }));
    }
  }
  await browser.close();
  process.exitCode = failed ? 1 : 0;
})();
