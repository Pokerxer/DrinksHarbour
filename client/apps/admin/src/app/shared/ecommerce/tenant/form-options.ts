import { businessTypeValues, idTypeValues } from '@/validators/create-tenant.schema';

export const PLAN_OPTIONS = [
  { value: 'free_trial', label: 'Free Trial' },
  { value: 'starter', label: 'Starter' },
  { value: 'growth', label: 'Growth' },
  { value: 'pro', label: 'Pro' },
  { value: 'enterprise', label: 'Enterprise' },
  { value: 'venue', label: 'Venue' },
  { value: 'custom', label: 'Custom' },
];

export const SUBSCRIPTION_STATUS_OPTIONS = [
  { value: 'trialing', label: 'Trialing' },
  { value: 'active', label: 'Active' },
  { value: 'past_due', label: 'Past Due' },
  { value: 'canceled', label: 'Canceled' },
  { value: 'incomplete', label: 'Incomplete' },
  { value: 'incomplete_expired', label: 'Incomplete Expired' },
];

export const REVENUE_MODEL_OPTIONS = [
  { value: 'markup', label: 'Markup' },
  { value: 'commission', label: 'Commission' },
];

export const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'archived', label: 'Archived' },
];

export const CURRENCY_OPTIONS = [
  { value: 'NGN', label: 'NGN — Nigerian Naira' },
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'GBP', label: 'GBP — British Pound' },
];

export const BILL_CONTROL_OPTIONS = [
  { value: 'ordered', label: 'Ordered Quantities' },
  { value: 'received', label: 'Received Quantities' },
];

export const BUSINESS_TYPE_OPTIONS = businessTypeValues.map((v) => ({
  value: v,
  label: v,
}));
export const ID_TYPE_OPTIONS = idTypeValues.map((v) => ({ value: v, label: v }));
