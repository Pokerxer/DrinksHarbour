interface LoaderOptions { src: string; width: number; quality?: number }

export function canOptimizeCloudinary(src: string): boolean {
  try {
    const url = new URL(src);
    return url.protocol === 'https:' && url.hostname === 'res.cloudinary.com' &&
      !url.search && !url.hash && /\/image\/upload\//.test(url.pathname) &&
      /\/v\d+\//.test(url.pathname) && /\.(jpe?g|png|webp|avif)$/i.test(url.pathname) &&
      !/\/s--|fl_animated/.test(url.pathname);
  } catch { return false; }
}

export function cloudinaryImageLoader({ src, width, quality }: LoaderOptions): string {
  if (!canOptimizeCloudinary(src)) return src;
  const pixels = Math.max(8, Math.min(3840, Math.ceil(width)));
  const compression = quality ? `q_${Math.max(1, Math.min(100, Math.round(quality)))}` : 'q_auto';
  // Final delivery transform preserves any preceding crop/overlay and version.
  return src.replace(/\/v(\d+)\//, `/f_auto,${compression},c_limit,w_${pixels}/v$1/`);
}
