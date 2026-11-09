import { describe, expect, it } from 'vitest';
import type { CompareSummary } from './session-summary';
import { buildShareLinks, shareMessage } from './share';

const summary: CompareSummary = {
  count: 4,
  bestName: 'Glen Grant 12',
  bestPrice: 38000,
  from: 38000,
  to: 71000,
  saved: 33000,
};

describe('share comparison', () => {
  it('composes a store-stamped message', () => {
    const english = shareMessage(summary, 'Counter');
    expect(english).toContain('Glen Grant 12');
    expect(english).toContain('₦38,000');
    expect(english).toContain('₦71,000');
    expect(english).toContain('Counter');
    
  });
  it('builds URL-encoded WhatsApp / SMS transports', () => {
    const links = buildShareLinks('best value Glen Grant 12');
    expect(links.whatsapp).toBe(
      `https://wa.me/?text=${encodeURIComponent('best value Glen Grant 12')}`
    );
    expect(links.sms).toBe(
      `sms:?&body=${encodeURIComponent('best value Glen Grant 12')}`
    );
  });
});
