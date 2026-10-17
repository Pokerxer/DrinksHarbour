export interface BannerData {
  _id: string;
  title?: string;
  subtitle?: string;
  description?: string;
  type: string;
  placement: string;
  ctaText?: string;
  ctaLink?: string;
  ctaStyle?: string;
  linkType?: string;
  imageClickable?: boolean;
  backgroundColor?: string;
  textColor?: string;
  overlayOpacity?: number;
  textAlignment?: string;
  contentPosition?: string;
  imageFit?: 'cover' | 'contain';
  gradientIntensity?: number;
  blurIntensity?: number;
  image: { url: string; alt?: string };
  animation?: { type: string; duration?: number; delay?: number };
  autoplay?: { enabled: boolean; interval?: number };
}
