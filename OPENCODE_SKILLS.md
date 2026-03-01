# DrinksHarbour - OpenCode Skills

## Skill: Create-Product-Form
Creates a new Product form with proper structure matching the existing Product/SubProduct patterns.

### Parameters
- `entity`: Product|SubProduct
- `features`: string[] (optional)

### Implementation Pattern
1. Create form page at `/src/app/(hydrogen)/ecommerce/{entity}/create/page.tsx`
2. Use existing shared component at `/src/app/shared/ecommerce/{entity}/create-edit/index.tsx`
3. Follow the simple transformation pattern used in Product create-edit
4. Use Zod schema from `/src/validators/{entity}.schema.ts`

### Key Rules
- NEVER use nested paths for form fields (use direct paths like `data.name`, not `data.subProductData.name`)
- ALWAYS use simple direct transformation: `transformFormData(data)`
- Keep form components under 200-300 lines
- Extract UI sections into separate components

---

## Skill: Fix-Form-Data-Submission
Fixes form data not being sent properly to the backend.

### Common Issues
1. Nested vs Flat structure mismatch
2. Zod validation stripping fields
3. Complex merge logic losing data
4. Wrong field paths in transformer

### Solution Pattern
1. Check form uses direct paths (not nested like `subProductData.field`)
2. Simplify transformer to: `transformFormData(data)` with direct property access
3. Match Product create-edit pattern: direct `data.fieldName` access
4. If Zod is stripping data, either remove resolver or fix schema

### Example Fix
```typescript
// WRONG - Complex nested merging:
const formData = { ...data, ...data.subProductData };
const transformedData = transformFormData(formData);

// RIGHT - Simple direct (like Product):
const transformedData = transformFormData(data);

// Transformer should use direct access:
const subProductData = data.subProductData || {};
return {
  product: subProductData.product || '',
  costPrice: toNumber(subProductData.costPrice),
  // ...
};
```

---

## Skill: Add-Form-Step
Adds a new step to an existing wizard form (Product/SubProduct).

### Steps
1. Add step to STEPS array in form index.tsx
2. Create new component in form's component folder
3. Add component to COMPONENTS map
4. Import and add to form-utils formParts

### Example
```typescript
// 1. Add to STEPS array:
{ key: formParts.newStep, label: 'New Step', icon: PiIcon, color: 'blue' as const, description: 'Description' }

// 2. Add to formParts in form-utils.ts:
newStep: 'new-step',

// 3. Add to COMPONENTS:
[formParts.newStep]: NewStepComponent,

// 4. Create component at /new-step.tsx
```

---

## Skill: Extract-Component
Extracts a large component into smaller focused components.

### Guidelines
- Keep files under 200-300 lines
- Extract: headers, forms, cards, lists, modals, tables
- Use composition patterns
- Create reusable primitives in `/components/ui` or `/components/beverage`

### Common Extractions for This Project
- `ProductCard` - Display product in lists
- `PriceDisplay` - Format and show prices
- `StockStatus` - Show stock levels
- `TenantSwitcher` - Switch between tenants
- `SizeVariantSelector` - Select sizes
- `ABVBadge` - Show alcohol content
- `AgeGate` - Age verification

---

## Skill: Create-API-Service
Creates a new API service client for frontend.

### Pattern
```typescript
// /src/services/{entity}.service.ts
import axios from 'axios';
import { apiWrapper } from './axios';

export const entityService = {
  getAll: async (token: string) => 
    apiWrapper(axios.get('/api/{entities}', { headers: { Authorization: token } })),
  
  getById: async (id: string, token: string) =>
    apiWrapper(axios.get(`/api/{entities}/${id}`, { headers: { Authorization: token } })),
  
  create: async (data: any, token: string) =>
    apiWrapper(axios.post('/api/{entities}', data, { headers: { Authorization: token } })),
  
  update: async (id: string, data: any, token: string) =>
    apiWrapper(axios.put(`/api/{entities}/${id}`, data, { headers: { Authorization: token } })),
  
  delete: async (id: string, token: string) =>
    apiWrapper(axios.delete(`/api/{entities}/${id}`, { headers: { Authorization: token } })),
};
```

---

## Skill: Create-Zod-Schema
Creates a Zod validation schema for forms.

### Pattern
```typescript
import { z } from 'zod';

export const entitySchema = z.object({
  // Core fields
  name: z.string().min(1, 'Name is required'),
  
  // Optional with defaults
  status: z.string().default('draft'),
  
  // Nested objects
  pricing: z.object({
    costPrice: z.number().min(0).nullable(),
    sellingPrice: z.number().min(0).nullable(),
  }),
  
  // Arrays
  tags: z.array(z.string()).default([]),
  
  // Enums
  type: z.enum(['type1', 'type2']),
  
  // Boolean with default
  isActive: z.boolean().default(false),
});

// Infer TypeScript type
export type EntityInput = z.infer<typeof entitySchema>;
```

---

## Skill: Multi-Tenant-Pattern
Implements multi-tenant aware features.

### Key Points
- Tenant data stored in SubProduct (NOT Product)
- Product = central catalog (shared across tenants)
- SubProduct = tenant-specific (pricing, stock, variants)
- Always scope queries by tenant ID
- Use tenant from session/token

### Common Patterns
```typescript
// Get tenant from session
const tenantId = session.user.tenantId;

// Scope query by tenant
const subProducts = await SubProduct.find({ tenant: tenantId });

// Product is central - no tenant field
const products = await Product.find({ status: 'approved' });
```

---

## Skill: Beverage-Specific-Fields
Adds beverage-specific fields to Product/SubProduct.

### Required Fields
```typescript
{
  alcoholic: boolean,
  abv: number,           // alcohol by volume %
  volume: number,          // in ml
  origin: string,          // country/region
  flavorNotes: string[],
  shelfLife: string,
  barcode: string,
  beverageType: 'wine' | 'beer' | 'spirit' | 'soft-drink' | 'non-alcoholic'
}
```

### Optional Fields
- vintage: number
- age: number (for spirits)
- style: string (wine style, beer style)
- producer/distillery/brewery
- appellation
- packaging (bottle, can, keg)

---

## Skill: Tenant-Revenue-Model
Implements tenant revenue calculation.

### Tenant Schema
```typescript
{
  revenueModel: 'markup' | 'commission',
  markupPercentage: number,    // used if markup model
  commissionPercentage: number, // used if commission model
}
```

### SubProduct Pricing
```typescript
{
  costPrice: number,      // tenant's purchase cost
  sellingPrice: number,     // tenant's retail price
  // Calculate margin:
  margin = sellingPrice - costPrice
  // Or apply percentage:
  sellingPrice = costPrice * (1 + markupPercentage/100)
}
```

---

## Skill: Product-SubProduct-Workflow
Implements the Product + SubProduct creation workflow.

### Workflow
1. User searches central Product catalog
2. If found → Link to existing Product → Create SubProduct
3. If not found → Create new Product (pending) + SubProduct in one call

### Backend Expected Data
```typescript
{
  createNewProduct: boolean,
  newProductData: { name, type, brand, ... },  // for new Product
  product: string,  // Product ID if linking to existing
  // SubProduct fields
  costPrice, sellingPrice, sizes, stock, ...
}
```

### Frontend Form
- Search input to find existing products
- "Create Product" button when no match found
- Form submits both Product + SubProduct when creating new
