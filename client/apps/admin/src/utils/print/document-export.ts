import type { DocumentModel } from './doc-model';
export const DOCUMENT_EXPORT_EVENT = 'drinksharbour:document-export';
export interface DocumentExportRequest {
  models: DocumentModel[];
}
/** Bridge legacy non-React print helpers to the shared tenant-aware dialog. */
export function requestDocumentExport(model: DocumentModel | DocumentModel[]): void {
  if (typeof window === 'undefined') return;
  const models = Array.isArray(model) ? model : [model];
  if (models.length)
    window.dispatchEvent(
      new CustomEvent<DocumentExportRequest>(DOCUMENT_EXPORT_EVENT, { detail: { models } })
    );
}
