# SEO checks

## `gsc-canonical-check.mjs` — validate the canonical decisions against real impressions

Two near-duplicate URL pairs were consolidated in July 2026, and they were
consolidated in **opposite directions**:

| Commit | Pair | Canonical target | Decided on |
|---|---|---|---|
| `536b351c` | `/categories/<slug>` vs `/shop?category=<slug>` | `/shop?category=` | 36 internal links vs 9 |
| `4a46f18b` | `/shop?brand=<slug>` vs `/brands/<slug>` | `/brands/<slug>` | 66+436 internal links vs 0 |

Both rest entirely on internal-link counts and on which page carries the entity
content. **Neither has been checked against Search Console** — no access was
available in either session. If `/categories/<slug>` or `/shop?brand=` turn out
to already earn the impressions for their queries, that outweighs a raw link
count, and the relevant decision should be revisited. Each commit message
records its own reversal steps.

This script closes that gap once you can export the data.

### Getting the export

Search Console → **Performance** → **Search results**:

1. Set the date range to the **last 3 months** (12 months gives a slower,
   steadier read if the pages are old enough).
2. **Do not apply a filter.**
3. Open the **Pages** tab.
4. **Export → Download CSV**, and take `Pages.csv` out of the zip.

The export stops at 1000 rows. The catalog is ~680 sitemap URLs, so one export
normally covers everything — but if the script warns it hit the cap, take two
filtered exports instead (`URL contains /brands/` and `URL contains brand=`) and
pass both files; they get merged.

### Running it

```bash
node scripts/seo/gsc-canonical-check.mjs ~/Downloads/Pages.csv
# or, merging several exports:
node scripts/seo/gsc-canonical-check.mjs ~/Downloads/brands.csv ~/Downloads/shop-brand.csv
```

It reads only — no credentials, no writes, nothing sent anywhere. Put the CSVs
wherever you like; they are not expected in the repo (and shouldn't be committed,
since page-level performance data is business-sensitive).

### Reading the output

Per pair it prints URL count, clicks, impressions, impression share and
impression-weighted average position for both forms, then one of:

- **SUPPORTED** (target holds ≥60% of impressions) — consolidation reinforces
  the URL Google already surfaces. No action.
- **MIXED** (35–60%) — either direction is defensible; the internal-link
  evidence stays the tiebreaker. Re-run in 4–8 weeks; the canonical should pull
  the split toward the target.
- **CONTRADICTED** (<35%) — the decision moved rankings onto the weaker URL.
  Weigh against the link evidence and consider reversing.
- **UNEVIDENCED** — no impressions on either form. Says nothing either way;
  usually a date range predating launch, or a truncated export.

A verdict is about *one* pair. The brands and categories decisions are
independent and can legitimately land differently.
