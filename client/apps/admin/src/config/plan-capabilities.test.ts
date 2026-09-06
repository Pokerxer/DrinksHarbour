import { describe, expect, it } from 'vitest';
import {
  checkPlanAccess,
  routeRequirementFor,
  cheapestPlanFor,
  capabilitiesForPlan,
  isUnder,
} from './plan-capabilities';

// The capability TABLE is pinned against the server and the pricing page by
// server/__tests__/planCapabilities.test.js. What is tested here is the ROUTE
// MAP and the gate built on it — the part that only exists on the client.

const allow = (path: string, plan: string, role = 'tenant_owner') =>
  checkPlanAccess({ path, role, plan }).allowed;

describe('isUnder', () => {
  it('matches whole segments only', () => {
    expect(isUnder('/sales', '/sales')).toBe(true);
    expect(isUnder('/sales/orders', '/sales')).toBe(true);
    // The bug this exists to prevent: a bare startsWith would gate an unrelated
    // route whose name merely begins with a gated one.
    expect(isUnder('/salesperson', '/sales')).toBe(false);
    expect(isUnder('/inventory-report', '/inventory')).toBe(false);
  });
});

describe('routeRequirementFor', () => {
  it('returns null for a route that is not plan-gated', () => {
    expect(routeRequirementFor('/products')).toBeNull();
    expect(routeRequirementFor('/employees')).toBeNull();
    // /settings must never be gated — it is where a tenant goes to upgrade.
    expect(routeRequirementFor('/settings')).toBeNull();
  });

  it('prefers the longest matching prefix', () => {
    // /ecommerce is ungated, /ecommerce/reviews is not.
    expect(routeRequirementFor('/ecommerce/reviews')?.prefix).toBe(
      '/ecommerce/reviews'
    );
    expect(routeRequirementFor('/ecommerce')).toBeNull();
  });

  it('covers deep routes', () => {
    expect(routeRequirementFor('/accounting/journal-entries')?.prefix).toBe(
      '/accounting'
    );
  });
});

describe('the non-monotonic rows', () => {
  // These two are the entire reason the model is a capability SET. A rank gate
  // derived mechanically from FEATURE_COMPARISON would fail both.
  it('Pro reaches the POS although its "POS (single outlet)" cell is false', () => {
    expect(capabilitiesForPlan('pro')).not.toContain('pos_single');
    expect(allow('/point-of-sale', 'pro')).toBe(true);
    expect(allow('/pos/sell', 'pro')).toBe(true);
  });

  it('Enterprise and Venue reach CRM although their "Basic CRM" cell is false', () => {
    for (const plan of ['enterprise', 'venue']) {
      expect(capabilitiesForPlan(plan)).not.toContain('crm_basic');
      expect(allow('/contacts', plan)).toBe(true);
      expect(allow('/support', plan)).toBe(true);
    }
  });

  it('still lets the cheaper plans that DO hold the basic tier through', () => {
    expect(allow('/point-of-sale', 'free_trial')).toBe(true);
    expect(allow('/contacts', 'growth')).toBe(true);
  });
});

describe('capability gates follow the pricing', () => {
  it('refuses Growth the Pro-only surfaces', () => {
    expect(allow('/accounting', 'growth')).toBe(false);
    expect(allow('/store-analytics', 'growth')).toBe(false);
  });

  it('grants Growth what Growth pays for', () => {
    expect(allow('/purchases', 'growth')).toBe(true);
    expect(allow('/sales', 'growth')).toBe(true);
  });

  it('refuses Free Trial the paid modules', () => {
    expect(allow('/sales', 'free_trial')).toBe(false);
    expect(allow('/purchases', 'free_trial')).toBe(false);
    expect(allow('/contacts', 'free_trial')).toBe(false);
  });

  it('grants Free Trial the core modules', () => {
    expect(allow('/inventory', 'free_trial')).toBe(true);
    expect(allow('/warehouses', 'free_trial')).toBe(true);
  });
});

describe('legacy thresholds', () => {
  // Gates that predate this work and that FEATURE_COMPARISON says nothing
  // about. Preserved at their existing threshold rather than given an invented
  // capability — inventing one would mean inventing pricing.
  it('keeps /analytics at starter and above', () => {
    expect(allow('/analytics', 'free_trial')).toBe(false);
    expect(allow('/analytics', 'starter')).toBe(true);
    expect(allow('/analytics', 'venue')).toBe(true);
  });

  it('keeps /logistics at enterprise and above', () => {
    expect(allow('/logistics', 'pro')).toBe(false);
    expect(allow('/logistics', 'enterprise')).toBe(true);
    expect(allow('/logistics', 'venue')).toBe(true);
  });
});

describe('custom', () => {
  // Regression: PLAN_RANK scored custom 6 (the highest) while the server's
  // PLAN_ORDER omitted it entirely, so isPlanAtLeast('custom', …) was false.
  // The menu offered a custom tenant everything and the API refused all of it.
  it('reaches capability-gated routes', () => {
    expect(allow('/accounting', 'custom')).toBe(true);
    expect(allow('/purchases', 'custom')).toBe(true);
  });

  it('satisfies the ordinal legacy thresholds too', () => {
    expect(allow('/analytics', 'custom')).toBe(true);
    expect(allow('/logistics', 'custom')).toBe(true);
  });

  it('honours an explicit override', () => {
    const narrowed = checkPlanAccess({
      path: '/accounting',
      role: 'tenant_owner',
      plan: 'custom',
      customCapabilities: ['inventory'],
    });
    expect(narrowed.allowed).toBe(false);
  });
});

describe('platform roles', () => {
  // They have no tenant and therefore no plan; an unconditional gate reads that
  // undefined plan as free_trial and locks them out of what they administer.
  it('are exempt even with no plan at all', () => {
    for (const role of ['super_admin', 'admin']) {
      expect(
        checkPlanAccess({ path: '/accounting', role, plan: undefined }).allowed
      ).toBe(true);
      expect(
        checkPlanAccess({ path: '/logistics', role, plan: undefined }).allowed
      ).toBe(true);
    }
  });

  it('are exempt even when a tenant is in context via a subdomain', () => {
    expect(
      checkPlanAccess({
        path: '/accounting',
        role: 'admin',
        plan: 'free_trial',
      }).allowed
    ).toBe(true);
  });
});

describe('unknown plans', () => {
  it('grant nothing rather than defaulting generously', () => {
    // The server resolver is the authority; a client that guessed generously
    // would render links the API then refuses.
    expect(allow('/accounting', 'not_a_plan')).toBe(false);
    expect(capabilitiesForPlan('not_a_plan')).toEqual([]);
  });
});

describe('upgrade targets', () => {
  it('name the cheapest sold plan that unlocks the route', () => {
    expect(
      checkPlanAccess({
        path: '/accounting',
        role: 'tenant_owner',
        plan: 'growth',
      }).upgradeTo
    ).toBe('pro');
    expect(
      checkPlanAccess({
        path: '/sales',
        role: 'tenant_owner',
        plan: 'free_trial',
      }).upgradeTo
    ).toBe('starter');
    expect(
      checkPlanAccess({
        path: '/contacts',
        role: 'tenant_owner',
        plan: 'starter',
      }).upgradeTo
    ).toBe('growth');
  });

  it('never suggest custom, which is not sold', () => {
    const requirement = routeRequirementFor('/accounting')!;
    expect(cheapestPlanFor(requirement)).not.toBe('custom');
  });

  it('are null when access is allowed', () => {
    expect(
      checkPlanAccess({
        path: '/accounting',
        role: 'tenant_owner',
        plan: 'pro',
      }).upgradeTo
    ).toBeNull();
  });
});
