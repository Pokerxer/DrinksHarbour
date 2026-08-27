import Script from "next/script";

/**
 * Google Preferred Sources button.
 *
 * Renders an interactive, Google-styled button that lets a reader add
 * DrinksHarbour as a "preferred source" in Google Search. Selected sites
 * are eligible to appear with a "preferred" badge in Top Stories, AI Mode
 * and AI Overviews for that user.
 *
 * Docs: https://developers.google.com/search/docs/appearance/preferred-sources
 *
 * The loader script (`publisher.js`) is injected once here with
 * `strategy="afterInteractive"`; the `<div>` below is the placeholder the
 * script scans for and hydrates into the actual button. Two DOM elements is
 * the entire integration surface — no props or state.
 */
export default function PreferredSourceButton({
  theme = "dark",
  lang,
  className,
}: {
  theme?: "light" | "dark";
  lang?: string;
  className?: string;
}) {
  return (
    <>
      <Script
        id="google-preferred-sources"
        src="https://news.google.com/swg/js/v1/publisher.js"
        strategy="afterInteractive"
      />
      <div
        {...({ "google-add-preferred-source-btn": "" } as Record<string, string>)}
        data-theme={theme}
        {...(lang ? { "data-lang": lang } : {})}
        className={className}
      />
    </>
  );
}
