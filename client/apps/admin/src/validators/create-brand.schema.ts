import { z } from 'zod';

const currentYear = new Date().getFullYear();

const brandTypeValues = [
  'brewery', 'microbrewery', 'craft_brewery', 'brewpub',
  'winery', 'vineyard', 'wine_estate',
  'distillery', 'craft_distillery', 'spirits_producer',
  'beverage_company', 'drinks_manufacturer',
  'coffee_roaster', 'tea_company',
  'soft_drink_manufacturer', 'water_brand',
  'importer', 'distributor',
  'private_label', 'house_brand',
  'luxury', 'premium', 'mass_market',
  'other', 'champagne_house', 'coffee_company', 'juice_company',
] as const;

const primaryCategoryValues = [
  'beer', 'wine', 'spirits', 'liqueurs', 'cocktails',
  'coffee', 'tea', 'soft_drinks', 'water', 'juice',
  'energy_drinks', 'sports_drinks', 'mixers',
  'accessories', 'multi_category', 'other', 'champagne',
] as const;

const statusValues = ['active', 'pending', 'archived', 'inactive', 'suspended'] as const;

export const brandFormSchema = z.object({
  // Core identity
  name: z.string().min(2, 'Brand name must be at least 2 characters').max(120),
  slug: z.string().min(1, 'Slug is required')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase letters, numbers and hyphens only'),
  legalName: z.string().max(200).optional(),
  tradingAs: z.string().optional(), // comma-separated
  tagline: z.string().max(150).optional(),
  founded: z.number().min(1000).max(currentYear).optional(),
  founderName: z.string().max(200).optional(),

  // Classification
  brandType: z.preprocess((v) => (v === '' ? undefined : v), z.enum(brandTypeValues).optional()),
  primaryCategory: z.preprocess((v) => (v === '' ? undefined : v), z.enum(primaryCategoryValues).optional()),
  specializations: z.string().optional(), // comma-separated
  countryOfOrigin: z.string().max(100).optional(),
  region: z.string().max(100).optional(),
  hqCity: z.string().max(100).optional(),
  hqCountry: z.string().max(100).optional(),

  // Content
  shortDescription: z.string().max(280).optional(),
  description: z.string().max(10000).optional(),
  story: z.string().max(5000).optional(),

  // Contact
  website: z.union([z.string().url('Must be a valid URL starting with http/https'), z.literal('')]).optional(),
  email: z.union([z.string().email('Must be a valid email'), z.literal('')]).optional(),
  phone: z.string().max(30).optional(),

  // Social media
  socialFacebook: z.string().max(300).optional(),
  socialInstagram: z.string().max(300).optional(),
  socialTwitter: z.string().max(300).optional(),
  socialYoutube: z.string().max(300).optional(),
  socialLinkedin: z.string().max(300).optional(),
  socialTiktok: z.string().max(300).optional(),

  // Status & flags
  status: z.enum(statusValues).default('active'),
  isFeatured: z.boolean().default(false),
  isPopular: z.boolean().default(false),
  isTrending: z.boolean().default(false),
  isPremium: z.boolean().default(false),
  isCraft: z.boolean().default(false),
  isLocal: z.boolean().default(false),
  verified: z.boolean().default(false),
  displayOrder: z.number().min(0).max(9999).default(999),

  // Brand colours (hex or empty string)
  brandColorPrimary: z.union([
    z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Must be a valid hex colour'),
    z.literal(''),
  ]).optional().default(''),
  brandColorSecondary: z.union([
    z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Must be a valid hex colour'),
    z.literal(''),
  ]).optional().default(''),
  brandColorAccent: z.union([
    z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Must be a valid hex colour'),
    z.literal(''),
  ]).optional().default(''),

  // SEO
  metaTitle: z.string().max(100).optional(),
  metaDescription: z.string().max(320).optional(),
  metaKeywords: z.string().optional(),
  canonicalUrl: z.union([z.string().url('Must be a valid URL'), z.literal('')]).optional(),

  // Admin
  notes: z.string().max(2000).optional(),
});

export type BrandFormInput = z.infer<typeof brandFormSchema>;
