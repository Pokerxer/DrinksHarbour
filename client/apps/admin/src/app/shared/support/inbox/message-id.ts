/**
 * Encodes a (folder, uid) pair into one URL path segment, and back.
 *
 * The mobile layout deep-links a message at /support/inbox/[id], and a message
 * is only addressable by BOTH its folder and its uid — a uid is unique within a
 * mailbox, not across one. Folder paths are unsafe in a path segment on their
 * own: this server separates with "." (INBOX.Sent) and others use "/"
 * (INBOX/Sent), and a literal or even percent-encoded "/" does not survive a
 * single dynamic segment. base64url sidesteps every one of those characters.
 *
 * Deliberately NOT Buffer: this runs in a client component, and Next.js does
 * not polyfill Node's Buffer into the browser bundle in the App Router — the
 * plan's `Buffer.from(...).toString('base64url')` would throw a ReferenceError
 * at the first click on mobile. btoa/atob exist in every browser and in Node,
 * so the same helper serves the client component and the server-rendered page,
 * and TextEncoder/TextDecoder carry the UTF-8 round trip that btoa alone cannot
 * (btoa throws on any character above U+00FF, which a non-ASCII folder name
 * would contain).
 */

const toBase64Url = (base64: string) =>
  base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const fromBase64Url = (value: string) => {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  // atob rejects an unpadded string in some engines; restore the padding.
  return base64 + '='.repeat((4 - (base64.length % 4)) % 4);
};

export function encodeMessageId(folder: string, uid: number): string {
  const bytes = new TextEncoder().encode(`${folder}|${uid}`);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return toBase64Url(btoa(binary));
}

export function decodeMessageId(
  id: string
): { folder: string; uid: number } | null {
  try {
    const binary = atob(fromBase64Url(id));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const decoded = new TextDecoder().decode(bytes);

    // The folder itself may contain "|" on an exotic server, so split at the
    // LAST separator: everything before it is the folder, the tail is the uid.
    const at = decoded.lastIndexOf('|');
    if (at <= 0) return null;

    const folder = decoded.slice(0, at);
    const raw = decoded.slice(at + 1);
    // Not parseInt: it reads "12abc" as 12, so a malformed id would silently
    // open some other message rather than being refused.
    if (!/^\d{1,10}$/.test(raw)) return null;
    const uid = Number(raw);
    if (!folder || uid < 1) return null;

    return { folder, uid };
  } catch {
    return null;
  }
}
