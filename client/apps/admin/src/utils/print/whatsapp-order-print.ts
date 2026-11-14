// Task 4 stub — Task 8 replaces this with the real mapping
// (buildWhatsappOrderDoc via DocumentModel + requestDocumentExport).
export type WhatsappDocVariant = 'quotation' | 'invoice';

export async function printOrderDocuments(
  orderId: string,
  token: string,
  variant: WhatsappDocVariant,
): Promise<void> {
  console.debug('print: Task 8', { orderId, variant });
}
