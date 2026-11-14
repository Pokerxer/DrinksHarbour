import { inflateSync } from 'node:zlib';

/** Honor byte lengths because compressed data can contain PDF delimiter text. */
export function pdfPageStreams(raw: string): string[] {
  return [...raw.matchAll(/<<([^>]*\/Length\s+(\d+)[^>]*)>>\s*stream\r?\n/g)].map(
    (match) => {
      const start = match.index! + match[0].length;
      const bytes = raw.slice(start, start + Number(match[2]));
      return /\/FlateDecode/.test(match[1])
        ? inflateSync(Buffer.from(bytes, 'latin1')).toString('latin1')
        : bytes;
    }
  );
}
