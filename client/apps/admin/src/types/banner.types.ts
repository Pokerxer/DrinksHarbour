// types/banner.types.ts

export interface BannerImage {
  url: string;
  publicId?: string;
  alt?: string;
  width?: number;
  height?: number;
}

export interface BannerTargetProduct {
  _id: string;
  name: string;
  slug: string;
  images?: BannerImage[];
  priceRange?: {
    min: number;
    max: number;
  };
}

export interface BannerTargetCategory {
  _id: string;
  name: string;
  slug: string;
  icon?: string;
  color?: string;
}

export interface BannerTargetBrand {
  _id: string;
  name: string;
  slug: string;
  logo?: BannerImage;
  countryOfOrigin?: string;
}

export interface BannerTargetCollection {
  _id: string;
  name: string;
  slug: string;
  description?: string;
}

export interface BannerDeviceTargeting {
  desktop: boolean;
  mobile: boolean;
  tablet: boolean;
}

export interface BannerTargetAudience {
  countries?: string[];
  cities?: string[];
  ageGroups?: string[];
  interests?: string[];
}

export interface BannerAnimation {
  type: 'none' | 'fade' | 'slide' | 'zoom' | 'bounce' | 'rotate';
  duration: number;
  delay: number;
}

export interface BannerAutoplay {
  enabled: boolean;
  interval: number;
}

export type BannerType = 'hero' | 'promotional' | 'category' | 'product' | 'seasonal' | 'announcement' | 'custom';

export type BannerPlacement = 'home_hero' | 'home_secondary' | 'category_top' | 'product_page' | 'checkout' | 'sidebar' | 'footer' | 'popup' | 'header';

export type BannerStatus = 'draft' | 'scheduled' | 'active' | 'paused' | 'expired' | 'archived';

export type BannerPriority = 'low' | 'medium' | 'high' | 'urgent';

export type BannerLinkType = 'internal' | 'external' | 'product' | 'category' | 'brand' | 'collection' | 'page';

export type BannerVisibleTo = 'all' | 'guests' | 'authenticated' | 'new_customers' | 'returning_customers' | 'vip';

export interface Banner {
  _id: string;
  title: string;
  subtitle?: string;
  description?: string;
  slug: string;
  image?: BannerImage;
  mobileImage?: BannerImage;
  type: BannerType;
  placement: BannerPlacement;
  displayOrder: number;
  priority: BannerPriority;
  ctaText?: string;
  ctaLink?: string;
  ctaStyle?: 'primary' | 'secondary' | 'outline' | 'text' | 'custom';
  linkType: BannerLinkType;
  targetProduct?: BannerTargetProduct;
  targetCategory?: BannerTargetCategory;
  targetBrand?: BannerTargetBrand;
  targetCollection?: BannerTargetCollection;
  backgroundColor: string;
  textColor: string;
  overlayOpacity: number;
  textAlignment: 'left' | 'center' | 'right';
  contentPosition: 'top-left' | 'top-center' | 'top-right' | 'center-left' | 'center' | 'center-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  startDate?: string;
  endDate?: string;
  isScheduled: boolean;
  isActive: boolean;
  status: BannerStatus;
  visibleTo: BannerVisibleTo;
  targetAudience?: BannerTargetAudience;
  deviceTargeting: BannerDeviceTargeting;
  tenant?: string;
  isGlobal: boolean;
  animation?: BannerAnimation;
  autoplay?: BannerAutoplay;
  impressions: number;
  clicks: number;
  clickThroughRate: number;
  conversionCount: number;
  conversionRate: number;
  tags?: string[];
  notes?: string;
  createdBy?: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatar?: string;
  };
  updatedBy?: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatar?: string;
  };
  publishedAt?: string;
  publishedBy?: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  isCurrentlyActive?: boolean;
  daysUntilExpiration?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface BannerListResponse {
  success: boolean;
  data: {
    banners: Banner[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
    stats?: {
      total: number;
      active: number;
      scheduled: number;
      paused: number;
      archived: number;
    };
  };
}

export interface BannerResponse {
  success: boolean;
  data: {
    banner: Banner;
  };
  message?: string;
}

export interface BannerFormData {
  title: string;
  subtitle?: string;
  description?: string;
  image?: BannerImage;
  mobileImage?: BannerImage;
  type: BannerType;
  placement: BannerPlacement;
  displayOrder?: number;
  priority?: BannerPriority;
  ctaText?: string;
  ctaLink?: string;
  ctaStyle?: 'primary' | 'secondary' | 'outline' | 'text' | 'custom';
  linkType?: BannerLinkType;
  targetProduct?: string;
  targetCategory?: string;
  targetBrand?: string;
  targetCollection?: string;
  backgroundColor?: string;
  textColor?: string;
  overlayOpacity?: number;
  textAlignment?: 'left' | 'center' | 'right';
  contentPosition?: 'top-left' | 'top-center' | 'top-right' | 'center-left' | 'center' | 'center-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  startDate?: string;
  endDate?: string;
  isScheduled?: boolean;
  isActive?: boolean;
  status?: BannerStatus;
  visibleTo?: BannerVisibleTo;
  deviceTargeting?: BannerDeviceTargeting;
  isGlobal?: boolean;
  tags?: string[];
  notes?: string;
}

export const BANNER_TYPE_OPTIONS: { value: BannerType; label: string }[] = [
  { value: 'hero', label: 'Hero' },
  { value: 'promotional', label: 'Promotional' },
  { value: 'category', label: 'Category' },
  { value: 'product', label: 'Product' },
  { value: 'seasonal', label: 'Seasonal' },
  { value: 'announcement', label: 'Announcement' },
  { value: 'custom', label: 'Custom' },
];

export const BANNER_PLACEMENT_OPTIONS: { value: BannerPlacement; label: string }[] = [
  { value: 'home_hero', label: 'Home Hero' },
  { value: 'home_secondary', label: 'Home Secondary' },
  { value: 'category_top', label: 'Category Top' },
  { value: 'product_page', label: 'Product Page' },
  { value: 'checkout', label: 'Checkout' },
  { value: 'sidebar', label: 'Sidebar' },
  { value: 'footer', label: 'Footer' },
  { value: 'popup', label: 'Popup' },
  { value: 'header', label: 'Header' },
];

export const BANNER_STATUS_OPTIONS: { value: BannerStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'expired', label: 'Expired' },
  { value: 'archived', label: 'Archived' },
];

export const BANNER_PRIORITY_OPTIONS: { value: BannerPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

export const BANNER_LINK_TYPE_OPTIONS: { value: BannerLinkType; label: string }[] = [
  { value: 'internal', label: 'Internal Link' },
  { value: 'external', label: 'External Link' },
  { value: 'product', label: 'Product' },
  { value: 'category', label: 'Category' },
  { value: 'brand', label: 'Brand' },
  { value: 'collection', label: 'Collection' },
  { value: 'page', label: 'Page' },
];

export const BANNER_VISIBLE_TO_OPTIONS: { value: BannerVisibleTo; label: string }[] = [
  { value: 'all', label: 'All Users' },
  { value: 'guests', label: 'Guests Only' },
  { value: 'authenticated', label: 'Authenticated Users' },
  { value: 'new_customers', label: 'New Customers' },
  { value: 'returning_customers', label: 'Returning Customers' },
  { value: 'vip', label: 'VIP Customers' },
];
