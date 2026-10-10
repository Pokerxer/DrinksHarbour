# Vercel Speed Insights — 2026-10-09

Both Next.js apps now depend on @vercel/speed-insights ^2.0.0 and render the
Next.js SpeedInsights component once in src/app/layout.tsx. Keep existing
analytics and tenant providers. Admin uses the client workspace pnpm lockfile;
platform also uses its npm package-lock.json for Vercel installation.

Package import checks and targeted diff whitespace checks passed. Full type
checks failed in other files (393 admin and 24 platform diagnostics), with no
diagnostics in either changed layout. No production build or deployment was
performed. Dashboard enablement and actual browser events are unverified.

This instrumentation measures browser performance; it does not itself make the
server faster. Upstash configuration is separate; see redis-performance.md.
For the complete handoff, see ../superpowers/specs/RESUME-speed-insights.md.
