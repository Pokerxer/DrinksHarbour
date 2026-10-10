// Real interactive header with isolated auth/API fixtures; no backend mutations.
const path = require("path");
const root = path.resolve(__dirname, "..");
const admin = path.join(root, "client/apps/admin");
const req = require("module").createRequire(path.join(admin, "package.json"));
const viteReq = require("module").createRequire(
  req.resolve("vitest/package.json"),
);
const buildReq = require("module").createRequire(viteReq.resolve("vite"));
const esbuild = buildReq("esbuild");
const { chromium } = require("playwright");
const pos = path.join(admin, "src/app/shared/point-of-sale");
const stubs = {
  "next/link": `export default function Link({href,children,...props}) { return <a href={href} {...props}>{children}</a> }`,
  "next/image": `export default function Image(props) { return <img {...props} /> }`,
  "next/navigation": `export function usePathname(){return ${JSON.stringify(process.env.POS_HEADER_PATH || '/point-of-sale/orders')}}`,
  "next-auth/react": `export function useSession(){return {data:{user:{token:'fixture'}}}}`,
  "@/layouts/hydrogen/app-launcher": `export function LauncherButton({className}) {return <button aria-label="Apps" className={className} style={{width:32,height:32}}>Apps</button>}`,
  [path.join(pos, "store")]:
    `const shops=[{_id:'long',name:'Very long beverage shop name',mode:'retail',color:'#b20202',active:true}]; const noop=()=>{}; export function usePOSAuth(){return {token:'fixture'}}; export function usePOSShops(){return {shops,setShops:noop}}; export function usePOSActiveShop(){return {activeShopId:'long',setActiveShopId:noop}}`,
  [path.join(pos, "api")]:
    `export const posApi={listShops:async()=>({shops:[]})}`,
  [path.join(pos, "components/pos-new-shop-modal")]:
    `export default function Modal(){return null}`,
};
(async () => {
  const bundle = await esbuild.build({
    stdin: {
      contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import Header from './src/app/shared/point-of-sale/pos-nav-header'; createRoot(document.getElementById('root')).render(<Header/>);`,
      resolveDir: admin,
      loader: "tsx",
    },
    bundle: true,
    write: false,
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
    alias: { "@": path.join(admin, "src") },
    plugins: [
      {
        name: "fixture",
        setup(build) {
          build.onResolve({ filter: /.*/ }, (args) => {
            const key = args.path.startsWith(".")
              ? path.resolve(args.resolveDir, args.path)
              : args.path;
            if (stubs[key]) return { path: key, namespace: "fixture" };
          });
          build.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({
            contents: stubs[args.path],
            loader: "tsx",
            resolveDir: admin,
          }));
        },
      },
    ],
  });
  const css = await req("postcss")([
    req("tailwindcss")({
      content: [
        pos + "/pos-nav-header.tsx",
        pos + "/components/pos-shop-selector.tsx",
        admin + "/src/app/shared/warehouses/mobile-nav-menu.tsx",
        admin + "/src/app/shared/nav-dropdown-panel.tsx",
      ],
    }),
  ]).process("@tailwind base; @tailwind utilities;", { from: undefined });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(
      `<style>${css.css}</style><div id="root"></div><button id="outside" style="margin-top:350px">Outside</button>`,
    );
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    for (const width of [320, 390, 640, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 800 });
      const menu = page.getByRole("button", {
        name: "Point of Sale menu",
        exact: true,
      });
      const nav = page.locator("#root > nav");
      const box = await nav.boundingBox();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      );
      if (
        overflow ||
        (width < 768 && box.height > 50) ||
        (width >= 768 && box.height > 95)
      )
        throw Error(
          `Header overflow/wrapping at ${width}: height ${box.height}`,
        );
      if ((await menu.isVisible()) !== width < 768)
        throw Error(`Wrong menu visibility at ${width}`);
      if (width < 768) {
        await menu.click();
        const ordersToggle = page
          .locator("#pos-mobile-menu")
          .getByRole("button", { name: "Orders", exact: true });
        if ((await ordersToggle.getAttribute("aria-expanded")) !== "true")
          await ordersToggle.click();
        if (
          !(await page
            .locator("#pos-mobile-menu")
            .getByRole("link", { name: "Sessions", exact: true })
            .isVisible())
        )
          throw Error("Missing Sessions link");
        const panel = await page.locator("#pos-mobile-menu").boundingBox();
        if (panel.x < 0 || panel.x + panel.width > width)
          throw Error("Menu outside viewport");
        await page.keyboard.press("Escape");
        if (await page.locator("#pos-mobile-menu").count())
          throw Error("Escape did not dismiss");
        await menu.click();
        await page.locator("#outside").click();
        if (await page.locator("#pos-mobile-menu").count())
          throw Error("Outside click did not dismiss");
      }
      await page.getByRole("button", { name: /Select shop:/ }).click();
      const shops = await page.locator("#pos-shop-menu").boundingBox();
      if (!shops || shops.x < 0 || shops.x + shops.width > width)
        throw Error(`Shop selector outside viewport at ${width}`);
      await page.keyboard.press("Escape");
      console.log(
        JSON.stringify({ width, height: box.height, overflow, passed: true }),
      );
    }
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
