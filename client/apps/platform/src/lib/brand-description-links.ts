/** Preserve simple catalog anchors while keeping arbitrary markup out of the DOM. */
export function brandDescriptionSegments(paragraph: string, decode: (text: string) => string) {
  const plain = (text: string) => decode(text.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ');
  const segments: { text: string; href?: string }[] = [];
  const anchors = /<a\b[^>]*\bhref\s*=\s*(["'])([^"']+)\1[^>]*>([\s\S]*?)<\/a>/gi;
  let offset = 0;
  for (const match of paragraph.matchAll(anchors)) {
    segments.push({ text: plain(paragraph.slice(offset, match.index)) });
    const href = match[2];
    const text = plain(match[3]);
    segments.push(/^\/product\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(href) ? { text, href } : { text });
    offset = match.index + match[0].length;
  }
  segments.push({ text: plain(paragraph.slice(offset)) });
  return segments.filter(segment => segment.text);
}
