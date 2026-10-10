export default function ApiBannerReference() {
  return (
    <section
      id="banners"
      className="scroll-mt-24 space-y-4 rounded-2xl border border-muted bg-white p-5 dark:bg-gray-50 sm:p-6"
    >
      <h2 className="text-lg font-semibold">Store banners</h2>
      <p className="text-sm leading-7 text-gray-600">
        Create a banner in Banners → Create. Add a desktop image, an optional
        mobile image, a title and button link, then choose its placement,
        display order and device visibility. Tenant banners belong only to your
        store. Choose Active to publish immediately, or Scheduled with a start
        and end date; drafts and paused banners stay hidden.
      </p>
      <p className="text-sm leading-7 text-gray-600">
        GET /banners requires storefront:read. Optional filters: placement (for
        example home_hero or home_secondary), device (desktop, mobile or
        tablet), and limit (1–100, default 10). The key selects its tenant
        automatically. Banners sort by displayOrder, newest creation date, then
        ID. Only active, enabled banners within their schedule are returned; due
        scheduled banners appear without waiting for the background job. This
        guest storefront feed includes audiences all and guests.
      </p>
      <pre className="overflow-x-auto rounded-xl bg-gray-900 p-4 text-xs leading-6 text-gray-100">
        <code>{`// Run on your website server; keep the API key private.
const response = await fetch(
  process.env.DRINKSHARBOUR_API_URL + '/banners?placement=home_hero&device=desktop&limit=5',
  { headers: { Authorization: 'Bearer ' + process.env.DRINKSHARBOUR_API_KEY },
    cache: 'no-store' }
);
const result = await response.json();
if (!response.ok) throw new Error(result.message);
const banners = result.data;
// Each banner: id, title, subtitle, description, placement, displayOrder,
// image: { url, alt, width?, height? }, mobileImage (or null),
// ctaText, ctaLink (or null), ctaStyle, imageClickable, deviceTargeting,
// backgroundColor, textColor, textAlignment, contentPosition, imageFit,
// overlayOpacity, gradientIntensity, blurIntensity.
// Render image.url; prefer mobileImage.url on mobile when present.
// Treat titles/descriptions as text. Only render a link when ctaLink exists.`}</code>
      </pre>
      <p className="text-sm leading-7 text-gray-600">
        Banner links should be paths on your website (such as /shop or
        /#collection) or HTTPS URLs. Custom websites may use different product
        paths, so set the destination for your own website. Internal notes,
        staff details, analytics and other tenants’ banners are excluded. API
        keys read banners; staff create, update and publish them in the
        dashboard.
      </p>
    </section>
  );
}
