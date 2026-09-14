## Isomorphic Starter Template with Internationalization support

**Run the following commands from the packages root**

First install the dependencies by running the following command.

```bash
pnpm install
```

Now to start the local development server run

```bash
pnpm iso:dev
```

To learn more please follow our [Documentation](https://isomorphic-doc.vercel.app/getting-started/installation)

## Development compiler memory

The admin uses a 4 GB Node heap for `pnpm dev`. Webpack filesystem caching is
intentionally disabled in development and production: cache serialization can
allocate large buffers and exhaust that heap when compiling the full invoice/sales
editor. Development module parallelism is capped at two; production remains one.
Cold compilation can take longer. Keep these limits in `next.config.mjs` when
changing the dev/build setup; increasing the heap alone does not address caching.

If port 3000 belongs to another application, run `pnpm dev --port 3001` and use the
URL printed by Next.js. Do not terminate another project's server to free the port.
