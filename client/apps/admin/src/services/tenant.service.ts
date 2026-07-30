// @ts-nocheck
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export interface AdminTenant {
  _id: string;
  name: string;
  slug: string;
  plan: string;
  subscriptionStatus: string;
  status: string;
  revenueModel: string;
  markupPercentage?: number;
  commissionPercentage?: number;
  platformMarkupPercentage?: number;
  packMarkupPercentage?: number | null;
  packCommissionPercentage?: number | null;
  packRateMinUnits?: number;
  logo?: { url: string; alt?: string };
  primaryColor?: string;
  contactEmail?: string;
  contactPhone?: string;
  country?: string;
  isSystemTenant?: boolean;
  createdAt: string;
  // full detail fields (from getAdminTenantById)
  customPricingNote?: string;
  defaultCurrency?: string;
  supportedCurrencies?: string[];
  address?: {
    street?: string;
    city?: string;
    lga?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  enforceAgeVerification?: boolean;
  rejectionReason?: string;
  notes?: string;
  paystackCustomerId?: string;
  paystackSubscriptionCode?: string;
  paystackPlanCode?: string;
  trialEndsAt?: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  approvedAt?: string;
  onboardedAt?: string;
  approvedBy?: TenantOwner | string;
  /** Populated tenant_owner User — absent means nobody can sign in to this tenant */
  admin?: TenantOwner | string;
  location?: {
    lat?: number;
    lon?: number;
    geocodedAt?: string;
    source?: string;
  };
  normalizedState?: string;
  // Business registration & compliance
  businessType?: string;
  cacNumber?: string;
  tin?: string;
  idType?: string;
  idNumber?: string;
  nafdacNumber?: string;
  nafdacRequired?: boolean;
  applicationDescription?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;
  bankAccounts?: BankAccount[];
  // KYC results (read-only — produced by the Paystack KYC service at apply time)
  kycVerified?: boolean;
  kycChecks?: {
    check: string;
    passed?: boolean;
    skipped?: boolean;
    detail?: string;
  }[];
  kycWarnings?: string[];
  kycNameCrossCheck?: {
    performed?: boolean;
    allPassed?: boolean;
    hasWarnings?: boolean;
  };
  // Soft stats
  productCount?: number;
  activeSubProductCount?: number;
  totalOrders?: number;
  totalRevenue?: number;
  /** Note the `default` prefix — the schema field is defaultBillControlPolicy */
  purchaseSettings?: {
    defaultBillControlPolicy?: string;
    enable3WayMatching?: boolean;
    requirePOApproval?: boolean;
    approvalThreshold?: number;
    defaultPaymentTerms?: string;
    autoGenerateBill?: boolean;
    allowPartialReceipts?: boolean;
    defaultReceivingLocation?: string;
    lockConfirmedOrders?: boolean;
    rfqValidityDays?: number;
    defaultLeadTimeDays?: number;
    defaultCurrency?: string;
  };
}

export interface TenantOwner {
  _id: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  email?: string;
  phone?: string;
  role?: string;
  status?: string;
}

export interface BankAccount {
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
}

export interface TenantFormData {
  name: string;
  slug: string;
  contactEmail?: string;
  contactPhone?: string;
  primaryColor?: string;
  // Owner provisioning — create only
  ownerName?: string;
  ownerEmail?: string;
  ownerPhone?: string;
  plan?: string;
  subscriptionStatus?: string;
  paystackCustomerId?: string;
  paystackSubscriptionCode?: string;
  paystackPlanCode?: string;
  trialEndsAt?: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  revenueModel?: string;
  markupPercentage?: number;
  commissionPercentage?: number;
  platformMarkupPercentage?: number;
  packMarkupPercentage?: number | '';
  packCommissionPercentage?: number | '';
  packRateMinUnits?: number | '';
  customPricingNote?: string;
  defaultCurrency?: string;
  supportedCurrencies?: string;
  country?: string;
  addressStreet?: string;
  addressCity?: string;
  addressLga?: string;
  addressState?: string;
  addressZipCode?: string;
  addressCountry?: string;
  enforceAgeVerification?: boolean;
  isSystemTenant?: boolean;
  status?: string;
  rejectionReason?: string;
  notes?: string;
  // Business registration & compliance
  businessType?: string;
  cacNumber?: string;
  tin?: string;
  idType?: string;
  idNumber?: string;
  nafdacRequired?: boolean;
  nafdacNumber?: string;
  applicationDescription?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;
  bankAccounts?: BankAccount[];
  // Purchase Settings
  psDefaultBillControlPolicy?: string;
  psEnable3WayMatching?: boolean;
  psRequirePOApproval?: boolean;
  psApprovalThreshold?: number;
  psDefaultPaymentTerms?: string;
  psAutoGenerateBill?: boolean;
  psAllowPartialReceipts?: boolean;
  psDefaultReceivingLocation?: string;
  psLockConfirmedOrders?: boolean;
  psRfqValidityDays?: number;
  psDefaultLeadTimeDays?: number;
  // image
  logoFile?: File | null;
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export function buildTenantFormData(data: TenantFormData): FormData {
  const form = new FormData();
  Object.entries(data).forEach(([k, v]) => {
    if (k === 'logoFile') {
      if (v instanceof File) form.append('logo', v);
    } else if (v === undefined || v === null) {
      // omitted entirely — the server only writes the fields it receives
    } else if (
      Array.isArray(v) ||
      (typeof v === 'object' && !(v instanceof File))
    ) {
      // String(array) would post "[object Object]"; the server JSON.parses these
      form.append(k, JSON.stringify(v));
    } else {
      form.append(k, String(v));
    }
  });
  return form;
}

async function apiFetch<T>(url: string, options: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Request failed');
  return json.data;
}

export async function getAdminTenants(
  token: string
): Promise<{ tenants: AdminTenant[]; total: number }> {
  return apiFetch(`${API_URL}/api/tenants/admin`, {
    headers: authHeaders(token),
  });
}

export async function getAdminTenantById(
  token: string,
  id: string
): Promise<{ tenant: AdminTenant }> {
  return apiFetch(`${API_URL}/api/tenants/admin/${id}`, {
    headers: authHeaders(token),
  });
}

export interface OwnerInvite {
  email: string;
  /** false when the account was created but the invite email failed to send */
  emailSent: boolean;
}

export async function createAdminTenant(
  token: string,
  data: TenantFormData
): Promise<{ tenant: AdminTenant; ownerInvite: OwnerInvite | null }> {
  return apiFetch(`${API_URL}/api/tenants/admin`, {
    method: 'POST',
    headers: authHeaders(token),
    body: buildTenantFormData(data),
  });
}

export async function updateAdminTenant(
  token: string,
  id: string,
  data: TenantFormData
): Promise<{ tenant: AdminTenant }> {
  return apiFetch(`${API_URL}/api/tenants/admin/${id}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: buildTenantFormData(data),
  });
}

export async function deleteAdminTenant(
  token: string,
  id: string
): Promise<void> {
  const res = await fetch(`${API_URL}/api/tenants/admin/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Delete failed');
}
