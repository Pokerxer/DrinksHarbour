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

## Report loading and Redis

Dashboard and reporting reads use a bounded backend Redis cache when configured.
Website analytics uses one combined report request. Authentication and tenant
checks still run on every request; successful authenticated JSON writes invalidate
affected reports. See [admin Redis operating notes](../../../docs/performance/admin-redis.md)
for covered endpoints, freshness, configuration and local measurements.

Sub-product lists load independent statistics in parallel; detail/edit reads reuse
the authorized base document. List images use bounded Cloudinary derivatives with
original-image fallback, and edit history panels load on demand. Operational stock
and prices remain live. See `docs/superpowers/specs/RESUME-sub-product-speed.md`
at the repository root for checks and the current full-catalog filtering limit.

Redis also reuses sub-product summary counts and central catalog labels while
operational records stay live. List refresh/detail reload can bypass those caches.
See [SubProduct Redis notes](../../../docs/performance/sub-product-redis.md)
for independent configuration, invalidation and local measurements.
