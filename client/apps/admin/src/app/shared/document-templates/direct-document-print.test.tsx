// @vitest-environment jsdom
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { purchaseOrderService } from '@/services/purchaseOrder.service';
import { requestDocumentExport } from '@/utils/print/document-export';
import DirectDocumentPrint from './direct-document-print';

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { token: 'test-token' } } }),
}));
vi.mock('@/context/TenantContext', () => ({
  useTenant: () => ({ tenant: null }),
}));
vi.mock('@/utils/print/document-export', () => ({
  requestDocumentExport: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.mocked(requestDocumentExport).mockClear();
});

it.each([
  ['rfq', 'confirmed', 'rfq', 'Request for Quotation'],
  ['po', 'draft', 'po', 'Purchase Order'],
] as const)('direct print uses a saved %s type at %s status', async (type, status, kind, docTitle) => {
  vi.spyOn(purchaseOrderService, 'getPurchaseOrder').mockResolvedValue({
    success: true,
    data: { _id: 'doc-1', poNumber: 'PUR-001', currency: 'NGN', type, status, items: [] },
  });

  render(<DirectDocumentPrint id="doc-1" kind="purchases" />);

  await waitFor(() => expect(requestDocumentExport).toHaveBeenCalledWith(
    expect.objectContaining({ kind, docTitle, number: 'PUR-001' })
  ));
});
