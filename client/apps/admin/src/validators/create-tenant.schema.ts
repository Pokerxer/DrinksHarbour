import { z } from 'zod';

// Keep these in step with models/Tenant.js — a value the model allows but this
// list omits makes the whole edit form unsubmittable for that tenant.
const planValues = [
  'free_trial',
  'starter',
  'growth',
  'pro',
  'enterprise',
  'venue',
  'custom',
] as const;
const subscriptionStatusValues = [
  'trialing',
  'active',
  'past_due',
  'canceled',
  'incomplete',
  'incomplete_expired',
] as const;
const revenueModelValues = ['markup', 'commission'] as const;
const statusValues = [
  'pending',
  'approved',
  'rejected',
  'suspended',
  'archived',
] as const;
const currencyValues = ['NGN', 'USD', 'EUR', 'GBP'] as const;
const billControlPolicyValues = ['ordered', 'received'] as const;

export const businessTypeValues = [
  'Wine Merchant',
  'Spirit Importer',
  'Beverage Brand',
  'Liquor Store',
  'Bar / Lounge',
  'Restaurant',
  'Hotel',
  'Distributor',
  'Other',
] as const;

export const idTypeValues = [
  'NIN (National ID)',
  "Driver's License",
  'International Passport',
  "Voter's Card",
] as const;

/** Optional select: '' means "not set" rather than an invalid enum member. */
const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess((v) => (v === '' ? undefined : v), z.enum(values).optional());

const bankAccountSchema = z.object({
  bankName: z.string().max(80).optional(),
  accountNumber: z.string().max(20).optional(),
  accountName: z.string().max(100).optional(),
});

export const tenantFormSchema = z
  .object({
    // Core identity
    name: z
      .string()
      .min(2, 'Tenant name must be at least 2 characters')
      .max(100),
    slug: z
      .string()
      .min(1, 'Slug is required')
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        'Slug must be lowercase letters, numbers and hyphens only'
      ),

    contactEmail: z
      .union([z.string().email('Must be a valid email'), z.literal('')])
      .optional(),
    contactPhone: z.string().max(30).optional(),
    primaryColor: z
      .union([
        z
          .string()
          .regex(
            /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
            'Must be a valid hex colour'
          ),
        z.literal(''),
      ])
      .optional()
      .default('#1a202c'),

    // Owner account (create only) — without one, nobody can sign in to the tenant
    ownerName: z.string().max(80).optional(),
    ownerEmail: z
      .union([z.string().email('Must be a valid email'), z.literal('')])
      .optional(),
    ownerPhone: z.string().max(30).optional(),

    // Plan & Billing — Paystack is the platform gateway; the schema has no Stripe fields
    plan: optionalEnum(planValues),
    subscriptionStatus: optionalEnum(subscriptionStatusValues),
    paystackCustomerId: z.string().max(100).optional(),
    paystackSubscriptionCode: z.string().max(100).optional(),
    paystackPlanCode: z.string().max(100).optional(),
    trialEndsAt: z.string().optional(),
    currentPeriodStart: z.string().optional(),
    currentPeriodEnd: z.string().optional(),

    // Revenue model
    revenueModel: optionalEnum(revenueModelValues),
    markupPercentage: z.number().min(0).max(500).optional(),
    commissionPercentage: z.number().min(0).max(50).optional(),
    platformMarkupPercentage: z.number().min(0).max(100).optional(),
    // Pack rates are clearable — empty string reverts packs to the normal rates
    packMarkupPercentage: z
      .union([z.number().min(0).max(500), z.literal('')])
      .optional(),
    packCommissionPercentage: z
      .union([z.number().min(0).max(50), z.literal('')])
      .optional(),
    packRateMinUnits: z
      .union([z.number().int().min(2), z.literal('')])
      .optional(),
    customPricingNote: z.string().max(500).optional(),

    // Regional
    defaultCurrency: optionalEnum(currencyValues),
    supportedCurrencies: z.string().optional(),
    country: z.string().max(100).optional(),

    // Address
    addressStreet: z.string().max(200).optional(),
    addressCity: z.string().max(100).optional(),
    addressLga: z.string().max(100).optional(),
    addressState: z.string().max(100).optional(),
    addressZipCode: z.string().max(20).optional(),
    addressCountry: z.string().max(100).optional(),

    // Business registration & compliance
    businessType: optionalEnum(businessTypeValues),
    cacNumber: z
      .union([
        z
          .string()
          .regex(
            /^(RC|BN|IT)\d{5,8}$/i,
            'Format: RC1234567, BN1234567 or IT1234567'
          ),
        z.literal(''),
      ])
      .optional(),
    tin: z
      .union([
        z.string().regex(/^\d{10}[-\d]*$/, 'TIN must be 10-14 digits'),
        z.literal(''),
      ])
      .optional(),
    idType: optionalEnum(idTypeValues),
    idNumber: z.string().max(30).optional(),
    nafdacRequired: z.boolean().optional(),
    nafdacNumber: z.string().max(50).optional(),
    applicationDescription: z.string().max(2000).optional(),

    // Settlement bank account (BVN is deliberately not editable here)
    bankName: z.string().max(80).optional(),
    bankAccountNumber: z
      .union([
        z
          .string()
          .regex(/^\d{10}$/, 'Account number must be exactly 10 digits'),
        z.literal(''),
      ])
      .optional(),
    bankAccountName: z.string().max(100).optional(),
    bankAccounts: z.array(bankAccountSchema).optional(),

    // Settings
    enforceAgeVerification: z.boolean().default(true),
    isSystemTenant: z.boolean().default(false),

    // Status
    status: optionalEnum(statusValues),
    rejectionReason: z.string().max(1000).optional(),

    // Notes
    notes: z.string().max(5000).optional(),

    // Purchase Settings — field names mirror Tenant.purchaseSettings
    psDefaultBillControlPolicy: optionalEnum(billControlPolicyValues),
    psEnable3WayMatching: z.boolean().optional(),
    psRequirePOApproval: z.boolean().optional(),
    psApprovalThreshold: z.number().min(0).optional(),
    psDefaultPaymentTerms: z.string().max(100).optional(),
    psAutoGenerateBill: z.boolean().optional(),
    psAllowPartialReceipts: z.boolean().optional(),
    psDefaultReceivingLocation: z.string().max(200).optional(),
    psLockConfirmedOrders: z.boolean().optional(),
    psRfqValidityDays: z.number().int().min(0).max(365).optional(),
    psDefaultLeadTimeDays: z.number().int().min(0).max(365).optional(),
  })
  .superRefine((data, ctx) => {
    // The server rejects this too — catch it here so the message lands on the field
    if (data.status === 'rejected' && !data.rejectionReason?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['rejectionReason'],
        message: 'A reason is required when rejecting a tenant',
      });
    }

    if (data.ownerEmail?.trim() && !data.ownerName?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ownerName'],
        message: "Enter the owner's name so the invite can be addressed",
      });
    }

    if (data.nafdacRequired && !data.nafdacNumber?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['nafdacNumber'],
        message: 'NAFDAC number is required for regulated beverages',
      });
    }
  });

export type TenantFormInput = z.infer<typeof tenantFormSchema>;
