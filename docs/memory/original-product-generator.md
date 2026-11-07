# Original Generate Product — business support (2026-11-04)

User correction: extend the ORIGINAL full-product tool, not a new content-only
panel. The added central Product detail panel has been removed. Listing-specific
content/SEO remains unchanged. Do not reintroduce a second Product generator UI.

Existing entry points:
- Identification Fill All → /api/gemini/generate-product.
- Edit-header Generate with AI → /api/gemini/generate-from-subproduct; now loads
  the saved identity and delegates to the same full-product flow. Platform roles
  only. No private tenant listing copy/prices are sent as canonical product facts.

Research uses existing Anthropic Haiku integration and web search. Business type
is passed through the original client request. Selected type is preserved; names
without a selected type use general research and the existing classification.
Actual search result URLs are required for researched specifications. The final
specification values come from research, never from the copy-generation pass.
Brand/category handling and beverage factual grounding remain existing behavior.
The saved-product header preserves saved name, slug and brand identity.

New bounded Product.specifications subdocument uses server/constants/
businessSpecifications.json. Client mirror utils/business-specifications.json is
parity-tested. Values are strings (max 1000) with units, appropriate for variant
configuration text; they are not saleable Size records or stock. Model validation
and Product create/update filter fields by Product.type, including type switches.
No migration is required for existing products (empty default).

Existing form Description section now contains editable specifications. Fill All,
header generation, defaults/load, form validation and save serialization include
them. Detail BusinessDetails renders recorded business-appropriate specs.
Unknown specs remain blank; fields vary by business:
- Beauty: formulation, skin/hair type, shade, finish, net content, packs, intended
  use, usage, warnings, shelf life, period after opening.
- Home: material, dimensions, weight, finish, colour, capacity, room use, assembly,
  care, pack size.
- Electronics: model, processor, memory, storage, display, connectivity, power,
  voltage, battery, compatibility, dimensions, weight, accessories, warranty.
- Fashion: material, composition, fit, size chart, measurements, colour, pattern,
  care, intended use.
- Food service: packs, net content, yield, storage/temperature, shelf life,
  preparation, material, dimensions, capacity, power/voltage, care, sourced dietary
  certifications and allergen statement.
- Hospitality: material, dimensions, capacity, packs, replenishment unit, use,
  care, power/voltage, compatibility, accessories, warranty. Existing tobacco/
  shisha types also have blend, wrapper, binder, filler, ring gauge, length,
  strength, charcoal type, burn time and warnings when explicitly sourced.
- Beverages: original full set of beverage fields, not the new spec subdocument.

Review limitation: source extraction proves a page was returned by search, not
field-by-field human verification of its claims. Admin review remains required.
No live AI call, database content write, commit or deployment in this session.
See RESUME-general-saas-evolution-audit.md for final validation counts.

Product and listing editors scope type, taxonomy and brand choices to the
current business. A saved type establishes the initial business. A single
tenant business can supply the default. Changing business clears dependent
selections. Brand management supports explicit industry assignment, and legacy
brands with recognizable beverage metadata appear in Beverages. General catalog
is available for unclassified types. Full AI generation classifies the entered
name first when no type is selected, then matches taxonomy within that business.

The central product editor now puts registered non-beverage fields in a
dedicated Specifications tab. Beverages keep Beverage Info and tasting controls.
General catalog products use shared tabs. Non-beverage origin generation stops
after country, region, and manufacturer. The description and SEO prompts use
the specification registry for business context. The separate SEO action
returns the H1 as well as title, meta description and keywords.

SubProduct size setup uses the selected linked product or draft product type
for both quick add and the row picker. Until matching guidance is available,
only custom/variable options are offered and quick add is hidden. Neutral labels
prevent shared size codes from appearing as unrelated products in non-beverage
forms. Quick type chips follow the tenant industry profile.

Beauty tenant size fallback now offers Beauty volumes and sets before product
selection. After selecting a type, local Beauty guidance covers slow or missing
API responses and matches the server guidance for all seven Beauty types.
The tenant branding lookup supplies the resolved industry profile on first load.

Size coverage was extended across the full product-type registry. Server
constants/businessSizePresets.js adds business and product-family presets and
extends the saved Size model. Regenerate the admin offline registry with
node server/scripts/sync-admin-size-guidance.js when guidance changes.
The tests compare every type's offline choices to server guidance and check
that offered size codes and pack metadata are accepted by the model.
The dropdown keeps all matching presets; quick add shows a short list.
Each listing can use multiple custom sizes within the existing 20-variant
form limit. Numbered internal custom codes preserve the existing unique size
index. Each row displays a single Custom Size option and has its own display
name and editable measurements.

Fashion variants can use the same size with different colours and separate
prices, cost, and stock. Retail uniqueness is a size/normalized-colour pair.
The storefront detail selects a persisted variant ID when quoting and adding to
cart. Deploy with size writers paused, preview and apply
server/scripts/migrate-retail-variant-colors.js, and resume only after the new
index is verified and all writers run the updated code. The script refuses
unversioned legacy sizes and installs the new unique index before removing the
old guard. No live index change was run in this session.

Variant photos are selected from Product Images in the tenant listing editor.
A photo applies to its exact size/colour row by default. Enable sharing on a
row to use its photo for other sizes of the same colour in that seller's listing.
The storefront puts the exact variant photo first, then a shared colour photo
when applicable, with listing and catalog gallery fallbacks. No tenant data or
index migration was applied while implementing photos.

Retail variants now also accept a business-labelled option name. Size, colour
or shade, and the named option form the variant identity. Beauty uses scent
or finish; Home uses finish or material; Electronics uses configuration; Food
Service uses pack format or grade; Hospitality uses format or finish; Beverages
use bottle, pack or serving format. The single option name can describe a
combination such as memory and storage, and photos can be shared by option
name within a seller listing. Prepared venue servings remain versioned
separately. Apply the pending compound-index migration before enabling
duplicate sizes with distinct options in a deployed environment.
