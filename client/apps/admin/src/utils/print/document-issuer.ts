import type { DocumentModel } from './doc-model';
interface TenantIssuer {
  name: string;
  email?: string;
  phone?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: {
    formatted?: string;
    street?: string;
    city?: string;
    state?: string;
    country?: string;
  };
}
/** Enrich tenant letterheads without replacing an explicitly selected warehouse. */
export function withDocumentIssuer(
  model: DocumentModel,
  tenant?: TenantIssuer | null
): DocumentModel {
  if (!tenant) return model;
  const platformFallback = ['drinks harbour', 'drinksharbour'].includes(
    model.companyName.toLowerCase()
  );
  const sameIssuer =
    platformFallback || model.companyName.toLowerCase() === tenant.name.toLowerCase();
  if (!sameIssuer) return model;
  const head = {
    address: tenant.address?.formatted || tenant.address?.street,
    city: tenant.address?.formatted
      ? undefined
      : [tenant.address?.city, tenant.address?.state, tenant.address?.country]
          .filter(Boolean)
          .join(', '),
    email: tenant.contactEmail || tenant.email,
    phone: tenant.contactPhone || tenant.phone,
  };
  return {
    ...model,
    companyName: platformFallback ? tenant.name : model.companyName,
    // Generic legacy stores can contain the platform's address; never relabel it
    // as the tenant's address. Missing tenant contact details remain absent.
    head: platformFallback ? head : (model.head ?? head),
  };
}
