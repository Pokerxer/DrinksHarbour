import { z } from 'zod';

const planValues = ['free_trial', 'starter', 'pro', 'enterprise', 'custom'] as const;
const subscriptionStatusValues = ['trialing', 'active', 'past_due', 'canceled', 'incomplete', 'incomplete_expired'] as const;
const revenueModelValues = ['markup', 'commission'] as const;
const statusValues = ['pending', 'approved', 'rejected', 'suspended', 'archived'] as const;
const currencyValues = ['NGN', 'USD', 'EUR', 'GBP'] as const;
const billControlPolicyValues = ['ordered', 'received'] as const;

export const tenantFormSchema = z.object({
  // Core identity
  name: z.string().min(2, 'Tenant name must be at least 2 characters').max(100),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase letters, numbers and hyphens only'),

  contactEmail: z.union([z.string().email('Must be a valid email'), z.literal('')]).optional(),
  contactPhone: z.string().max(30).optional(),
  primaryColor: z
    .union([
      z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Must be a valid hex colour'),
      z.literal(''),
    ])
    .optional()
    .default('#1a202c'),

  // Plan & Billing
  plan: z.preprocess((v) => (v === '' ? undefined : v), z.enum(planValues).optional()),
  subscriptionStatus: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.enum(subscriptionStatusValues).optional()
  ),
  stripeCustomerId: z.string().optional(),
  stripeSubscriptionId: z.string().optional(),
  trialEndsAt: z.string().optional(),
  currentPeriodStart: z.string().optional(),
  currentPeriodEnd: z.string().optional(),

  // Revenue model
  revenueModel: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.enum(revenueModelValues).optional()
  ),
  markupPercentage: z.number().min(0).max(500).optional(),
  commissionPercentage: z.number().min(0).max(50).optional(),
  platformMarkupPercentage: z.number().min(0).max(100).optional(),
  customPricingNote: z.string().max(500).optional(),

  // Regional
  defaultCurrency: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.enum(currencyValues).optional()
  ),
  supportedCurrencies: z.string().optional(),
  country: z.string().max(100).optional(),

  // Address
  addressStreet: z.string().max(200).optional(),
  addressCity: z.string().max(100).optional(),
  addressLga: z.string().max(100).optional(),
  addressState: z.string().max(100).optional(),
  addressZipCode: z.string().max(20).optional(),
  addressCountry: z.string().max(100).optional(),

  // Settings
  enforceAgeVerification: z.boolean().default(true),
  isSystemTenant: z.boolean().default(false),

  // Status
  status: z.preprocess((v) => (v === '' ? undefined : v), z.enum(statusValues).optional()),
  rejectionReason: z.string().max(1000).optional(),

  // Notes
  notes: z.string().max(5000).optional(),

  // Purchase Settings
  psBillControlPolicy: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.enum(billControlPolicyValues).optional()
  ),
  psEnable3WayMatching: z.boolean().optional(),
  psRequirePOApproval: z.boolean().optional(),
  psApprovalThreshold: z.number().min(0).optional(),
  psDefaultPaymentTerms: z.string().max(100).optional(),
  psAutoGenerateBill: z.boolean().optional(),
  psAllowPartialReceipts: z.boolean().optional(),
  psDefaultReceivingLocation: z.string().max(200).optional(),
});

export type TenantFormInput = z.infer<typeof tenantFormSchema>;
