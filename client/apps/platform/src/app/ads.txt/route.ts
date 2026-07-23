// Dynamic /ads.txt — declares Google AdSense as an authorized seller of this
// site's inventory. Google requires this file at the domain root before it
// will serve ads. Emitted only when NEXT_PUBLIC_ADSENSE_CLIENT_ID is set, so
// we never ship a stale/placeholder publisher id.
//
// ads.txt uses the bare publisher number (pub-XXXX), i.e. the AdSense client
// id with the leading "ca-" stripped.

export const dynamic = "force-static";

const ADSENSE_CLIENT_ID = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID || "";

// Google AdSense's fixed certification authority id for ads.txt.
const GOOGLE_TAG_ID = "f08c47fec0942fa0";

export function GET() {
  if (!ADSENSE_CLIENT_ID) {
    return new Response("", { status: 404 });
  }

  const pubId = ADSENSE_CLIENT_ID.replace(/^ca-/, "");
  const body = `google.com, ${pubId}, DIRECT, ${GOOGLE_TAG_ID}\n`;

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
