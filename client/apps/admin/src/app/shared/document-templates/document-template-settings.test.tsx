// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { documentPreferences } from '@/services/document-template.service';
import type { DocumentModel } from '@/utils/print/doc-model';
import type { TemplatePreferences } from '@/utils/print/templates/registry';
import DocumentTemplateSettings from './document-template-settings';
import DocumentExportDialog from './document-export-dialog';
import { templateSample } from './template-sample';

vi.mock('./use-document-identity', () => ({
  useDocumentIdentity: () => ({
    token: 'owner-token',
    tenant: { slug: 'my-shop', name: 'My Shop' },
    hasTenant: true,
    scope: 'my-shop',
    status: 'authenticated',
    isPOS: false,
  }),
}));
vi.mock('@/hooks/use-authorization', () => ({
  useAuthorization: () => ({ checkPermission: () => true }),
}));
vi.mock('@/services/document-template.service', () => ({
  documentPreferences: vi.fn(),
}));
vi.mock('./pdf-preview', () => ({
  default: ({ model }: { model: DocumentModel }) => (
    <output>{model.templateId}</output>
  ),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it('saves an invoice default and loads it in a new invoice export', async () => {
  let saved: TemplatePreferences = {
    version: 1,
    defaultTemplate: 'classic',
    families: { sales: 'modern', stock: 'ledger' },
  };
  vi.mocked(documentPreferences).mockImplementation(
    async (_token, _slug, changes) => {
      if (changes) saved = changes;
      return saved;
    }
  );

  const settings = render(<DocumentTemplateSettings />);
  const invoices = await screen.findByRole('combobox', { name: 'Invoices' });
  expect((invoices as HTMLSelectElement).value).toBe('');
  expect(screen.getByRole('status').textContent).toBe('modern');

  fireEvent.change(invoices, { target: { value: 'balance-first' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save defaults' }));
  await screen.findByText('Document defaults saved.');
  expect(documentPreferences).toHaveBeenCalledWith('owner-token', 'my-shop', {
    version: 1,
    defaultTemplate: 'classic',
    families: { sales: 'modern', stock: 'ledger', invoice: 'balance-first' },
  });
  settings.unmount();

  const reopened = render(<DocumentTemplateSettings />);
  expect(
    (
      await screen.findByRole<HTMLSelectElement>('combobox', {
        name: 'Invoices',
      })
    ).value
  ).toBe('balance-first');
  reopened.unmount();

  const dialog = HTMLDialogElement.prototype;
  const showModal = dialog.showModal;
  dialog.showModal = function () {
    this.open = true;
  };
  try {
    render(
      <DocumentExportDialog
        request={{ models: [templateSample()] }}
        onClose={() => {}}
      />
    );
    const picker = await screen.findByRole<HTMLSelectElement>('combobox', {
      name: 'Template',
    });
    expect(picker.value).toBe('balance-first');
    fireEvent.change(picker, { target: { value: 'folio' } });
    expect(picker.value).toBe('folio');
    expect(saved.families?.invoice).toBe('balance-first');
  } finally {
    dialog.showModal = showModal;
  }
});
