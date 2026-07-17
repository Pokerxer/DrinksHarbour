import { z } from 'zod';

const validStyles = [
  'traditional', 'modern', 'craft', 'artisanal', 'premium', 'luxury', 'budget', 'mid_range',
  'classic', 'innovative', 'experimental', 'organic', 'natural', 'biodynamic',
] as const;

export const subCategoryFormSchema = z.object({
  // Identity
  name: z.string().min(2, { message: 'SubCategory name must be at least 2 characters' }),
  displayName: z.string().max(120).optional(),
  slug: z.string().min(1, { message: 'Slug is required' })
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase letters, numbers and hyphens only'),
  tagline: z.string().max(150).optional(),
  // Hierarchy — parent is required
  parent: z.string().min(1, { message: 'Parent category is required' }),
  // Classification
  type: z.string().max(100).optional(),
  subType: z.string().max(100).optional(),
  style: z.enum(validStyles).optional(),
  // Content
  description: z.string().max(20000).optional(),
  shortDescription: z.string().max(280).optional(),
  // Flavors & Pairings (comma-separated in form)
  typicalFlavors: z.string().optional(),
  commonPairings: z.string().optional(),
  // Display
  displayOrder: z.number().min(0).max(9999).optional().default(999),
  // Status & Visibility
  status: z.enum(['draft', 'published', 'archived', 'hidden', 'coming_soon']).optional().default('draft'),
  isFeatured: z.boolean().optional().default(false),
  isTrending: z.boolean().optional().default(false),
  isPopular: z.boolean().optional().default(false),
  showInMenu: z.boolean().optional().default(true),
  // Seasonal
  seasonalSpring: z.boolean().optional().default(false),
  seasonalSummer: z.boolean().optional().default(false),
  seasonalFall: z.boolean().optional().default(false),
  seasonalWinter: z.boolean().optional().default(false),
  // Appearance
  color: z.union([
    z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Must be a valid hex colour e.g. #6B7280'),
    z.literal(''),
  ]).optional().default('#6B7280'),
  icon: z.string().max(20).optional(),
  // Admin
  notes: z.string().max(1000).optional(),
  // SEO
  metaTitle: z.string().max(100).optional(),
  metaDescription: z.string().max(320).optional(),
  metaKeywords: z.string().optional(),
  canonicalUrl: z.union([z.string().url('Must be a valid URL'), z.literal('')]).optional(),
});

export type SubCategoryFormInput = z.infer<typeof subCategoryFormSchema>;
