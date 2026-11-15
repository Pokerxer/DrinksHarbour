# Catalogue AI uses Claude Haiku 5.5

The default Anthropic model in `server/config/catalogueAi.js` is
`claude-haiku-5-5`. Product and subproduct generation, import enrichment,
brand/category/subcategory autofill, category/subcategory generation from a
topic, and the corresponding SEO/taxonomy backfills use that default with
low effort. Classifier and import enrichment requests reserve extra output
tokens because the limit includes thinking.

Product research uses adaptive thinking with low effort by default. Its
Haiku 4.5 override still sends budgeted thinking. Research retains the
existing web search tool, source validation and timeout.

Deploy the server code and check existing environment overrides.
`ANTHROPIC_FAST_MODEL` can override the product and subproduct text calls
and the taxonomy backfill, `ANTHROPIC_SMART_MODEL` can override topic-based
category and subcategory generation, and `ANTHROPIC_RESEARCH_MODEL` can
override product research. A value left over from an earlier deployment
takes precedence over the new default. `ANTHROPIC_RESEARCH_EFFORT` still
controls the research effort for models that support it.

Local research/import tests verify the new request and source parsing with
a stub Anthropic client. The live research probe could not connect to
Anthropic from the workspace.

Verification: 48 focused tests passed. The full suite reported 4,657 passed,
282 failed and 286 skipped. Failures included the sandbox's loopback listener
restriction, the required local MongoDB replica-set fixture, and the existing
WhatsApp pay-verify route-guard assertion. Production was not deployed.

## Scan & Match

The shared scanner used by Sales and Purchases also uses the catalogue
Haiku 5.5 options for photo and text extraction. The Anthropic requests
omit temperature. The output cap is 4,096 tokens for adaptive thinking
and the existing maximum of 30 rows. Catalogue matching and result
projection are unchanged.

All seven focused scan tests passed. The live text probe failed to
connect to Anthropic from the workspace.

The post-scan server suite reported 4,659 passed, 282 failed and 286 skipped.
The failure names matched the pre-scan run exactly.
