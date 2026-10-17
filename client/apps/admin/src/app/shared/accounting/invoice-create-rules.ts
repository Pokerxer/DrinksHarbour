export interface InvoiceProductLine {
  lineType: string;
  subProductId?: string;
  name?: string;
  quantity: number;
  unitPrice: number;
}
export function invoiceReadiness(
  lines: InvoiceProductLine[],
  total: number,
  dueDate: string,
  currency = 'NGN'
) {
  const products = lines.filter(
    (line) => line.lineType === 'product' && line.subProductId
  );
  let saveError = !products.length
    ? 'Add at least one product to the invoice.'
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
  if (!saveError && dueDate) {
    const date = new Date(`${dueDate}T00:00:00Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(dueDate) ||
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== dueDate
    )
      saveError = 'Choose a valid payment due date.';
  }
  const issueError =
    saveError ||
    (currency !== 'NGN'
      ? 'Invoices can only be issued in NGN.'
      : !Number.isFinite(total) || total <= 0
        ? 'The invoice must have a positive total before it can be issued.'
        : '');
  return { productCount: products.length, saveError, issueError };
}
