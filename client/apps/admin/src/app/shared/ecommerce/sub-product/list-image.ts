/** Only transform unsigned, versioned originals; existing derivatives stay intact. */
export function subProductListImage(url: string, width: number): string {
  if (!Number.isInteger(width) || width < 1 || width > 1280) return url;
  const original = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(v\d+\/[^?]+)(\?.*)?$/;
  return url.replace(original, `$1f_auto,q_auto,c_limit,w_${width}/$2$3`);
}
