import type { Banner, BannerFormData } from '@/types/banner.types';
export const EMPTY_BANNER_FORM: BannerFormData = {
  title: '',
  subtitle: '',
  description: '',
  image: { url: '' },
  mobileImage: { url: '' },
  type: 'promotional',
  placement: 'home_hero',
  displayOrder: 0,
  priority: 'medium',
  ctaText: '',
  ctaLink: '',
  ctaStyle: 'primary',
  linkType: 'internal',
  imageClickable: true,
  backgroundColor: '#FFFFFF',
  textColor: '#000000',
  overlayOpacity: 0,
  imageFit: 'contain',
  gradientIntensity: 100,
  blurIntensity: 100,
  textAlignment: 'center',
  contentPosition: 'center',
  startDate: '',
  endDate: '',
  isScheduled: false,
  isActive: true,
  status: 'active',
  visibleTo: 'all',
  isGlobal: false,
  tags: [],
  notes: '',
};

export function bannerFormValues(data: Banner): BannerFormData {
  return {
    title: data.title || '',
    subtitle: data.subtitle || '',
    description: data.description || '',
    image: data.image || { url: '' },
    mobileImage: data.mobileImage || { url: '' },
    type: data.type || 'promotional',
    placement: data.placement || 'home_hero',
    displayOrder: data.displayOrder || 0,
    priority: data.priority || 'medium',
    ctaText: data.ctaText || '',
    ctaLink: data.ctaLink || '',
    ctaStyle: data.ctaStyle || 'primary',
    linkType: data.linkType || 'internal',
    imageClickable: data.imageClickable ?? true,
    backgroundColor: data.backgroundColor || '#FFFFFF',
    textColor: data.textColor || '#000000',
    overlayOpacity: data.overlayOpacity || 0,
    imageFit: data.imageFit || 'contain',
    // `?? 100` not `|| 100` — a deliberate 0 must survive the round-trip.
    gradientIntensity: data.gradientIntensity ?? 100,
    blurIntensity: data.blurIntensity ?? 100,
    textAlignment: data.textAlignment || 'center',
    contentPosition: data.contentPosition || 'center',
    startDate: data.startDate
      ? new Date(data.startDate).toISOString().split('T')[0]
      : '',
    endDate: data.endDate
      ? new Date(data.endDate).toISOString().split('T')[0]
      : '',
    isScheduled: data.isScheduled || false,
    isActive: data.isActive ?? true,
    status: data.status || 'draft',
    visibleTo: data.visibleTo || 'all',
    isGlobal: data.isGlobal ?? false,
    tags: data.tags || [],
    notes: data.notes || '',
  };
}

type LinkedTarget = { _id: string; name: string };
export function bannerLinkedTarget(
  target: unknown,
  linkType: string,
  expectedType: string,
  cta: string
): LinkedTarget | null {
  if (target && typeof target === 'object') {
    const value = target as Record<string, unknown>;
    return {
      _id: String(value.slug || value._id || value.id || ''),
      name: String(value.name || ''),
    };
  }
  if (typeof target === 'string' && target) return { _id: target, name: '' };
  if (linkType !== expectedType) return null;
  const slug = cta.replace(/^\//, '').split('/')[1] || '';
  return slug ? { _id: slug, name: slug.replace(/-/g, ' ') } : null;
}
