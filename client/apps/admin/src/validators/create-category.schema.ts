import { z } from 'zod';
import { messages } from '@/config/messages';

const validTypes = [
  'beer',
  'cider',
  'wine',
  'red_wine',
  'white_wine',
  'rose_wine',
  'sparkling_wine',
  'champagne',
  'fortified_wine',
  'dessert_wine',
  'whiskey',
  'scotch',
  'bourbon',
  'rye_whiskey',
  'vodka',
  'gin',
  'rum',
  'tequila',
  'brandy',
  'cognac',
  'soju',
  'baijiu',
  'shochu',
  'mezcal',
  'liqueur',
  'aperitif',
  'digestif',
  'cocktail',
  'coffee',
  'tea',
  'juice',
  'soda',
  'water',
  'milk',
  'yogurt_drink',
  'soft_drink',
  'dairy_alternatives',
  'functional_drink',
  'syrup',
  'bitters',
  'glassware',
  'bar_tools',
  'accessories',
  'gift_set',
  'subscription',
  'other',
] as const;

export const categoryFormSchema = z.object({
  // Identity
  name: z.string().min(2, { message: messages.catNameIsRequired }),
  displayName: z.string().max(120).optional(),
  slug: z
    .string()
    .min(1, { message: messages.slugIsRequired })
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      'Slug must be lowercase letters, numbers and hyphens only'
    ),
  tagline: z.string().max(150).optional(),
  // Classification
  type: z.enum(validTypes, {
    errorMap: () => ({ message: 'Please select a valid type' }),
  }),
  subType: z.string().max(80).optional(),
  alcoholCategory: z
    .enum([
      'alcoholic',
      'non_alcoholic',
      'low_alcohol',
      'alcohol_free',
      'mixed',
    ])
    .optional()
    .default('alcoholic'),
  // Content
  description: z.string().max(20000).optional(),
  shortDescription: z.string().max(280).optional(),
  // Hierarchy
  parentCategory: z.string().optional(),
  displayOrder: z.number().min(0).max(9999).optional().default(999),
  // Status & Visibility
  status: z
    .enum(['draft', 'published', 'archived', 'hidden', 'coming_soon'])
    .optional()
    .default('draft'),
  isFeatured: z.boolean().optional().default(false),
  isTrending: z.boolean().optional().default(false),
  isPopular: z.boolean().optional().default(false),
  isNewArrival: z.boolean().optional().default(false),
  showInMenu: z.boolean().optional().default(true),
  showOnHomepage: z.boolean().optional().default(false),
  // Appearance
  color: z
    .union([
      z
        .string()
        .regex(
          /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
          'Must be a valid hex colour e.g. #6B7280'
        ),
      z.literal(''),
    ])
    .optional()
    .default('#6B7280'),
  icon: z.string().max(20).optional(),
  // Display
  defaultSort: z
    .enum([
      'relevance',
      'price_asc',
      'price_desc',
      'popularity',
      'newest',
      'name',
    ])
    .optional()
    .default('relevance'),
  notes: z.string().max(1000).optional(),
  // SEO
  metaTitle: z.string().max(100).optional(),
  metaDescription: z.string().max(320).optional(),
  metaKeywords: z.string().optional(),
  canonicalUrl: z
    .union([z.string().url('Must be a valid URL'), z.literal('')])
    .optional(),
});

export type CategoryFormInput = z.infer<typeof categoryFormSchema>;
