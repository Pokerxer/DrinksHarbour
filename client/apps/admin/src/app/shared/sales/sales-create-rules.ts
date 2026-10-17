import type { InvoiceProductLine } from '@/app/shared/accounting/invoice-create-rules';

export function salesCreateReadiness(
  lines: InvoiceProductLine[],
  total: number,
  validUntil: string
) {
  const products = lines.filter(
    (line) => line.lineType === 'product' && line.subProductId
  );
  let saveError = !products.length
    ? 'Add at least one product to the quotation.'
    : '';
  if (
    !saveError &&
    products.some(
      (line) => !Number.isFinite(line.quantity) || line.quantity <= 0
    )
  )
    saveError = 'Enter a finite, positive quantity for each product.';
  if (
    !saveError &&
    products.some(
      (line) => !Number.isFinite(line.unitPrice) || line.unitPrice < 0
    )
  )
    saveError = 'Enter a valid, non-negative price for each product.';
  if (!saveError && validUntil) {
    const date = new Date(`${validUntil}T00:00:00Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(validUntil) ||
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== validUntil
    )
      saveError = 'Choose a valid quotation expiration date.';
  }
  return {
    productCount: products.length,
    saveError,
    confirmError:
      saveError ||
      (!Number.isFinite(total) || total <= 0
        ? 'The order must have a positive total before confirmation.'
        : ''),
  };
}
