const Papa = require('papaparse');
const salesOrderService = require('./salesOrder.service');

/**
 * Parse CSV text into an array of sales order objects.
 * Expected CSV columns: customer, items (JSON string), docType, notes, terms, ...
 */
function parseSalesCsv(csvText) {
  const result = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    transform: (val) => (val || '').trim(),
  });

  if (result.errors.length) {
    console.warn('[CSV PARSE] Non-fatal errors:', result.errors);
  }

  return (result.data || []).map((row) => {
    let items = [];
    if (row.items) {
      try {
        items = JSON.parse(row.items);
      } catch {
        console.warn(`[CSV PARSE] Invalid JSON in items column for row: ${row.customer || 'unknown'}`);
        items = [];
      }
    }

    return {
      docType: (row.docType || 'order').toLowerCase(),
      customerSnapshot: row.customer ? { name: row.customer } : undefined,
      items,
      notes: row.notes || '',
      terms: row.terms || '',
    };
  });
}

/**
 * Bulk-import parsed sales orders. Each order is created via
 * salesOrderService.createSalesOrderDoc. Returns a summary.
 */
async function bulkImportSales(orders, tenantId) {
  let created = 0;
  const errors = [];

  for (let i = 0; i < orders.length; i++) {
    try {
      await salesOrderService.createSalesOrderDoc({ tenantId, body: orders[i] });
      created++;
    } catch (err) {
      errors.push({ row: i + 2, message: err.message || 'Unknown error' });
    }
  }

  return { created, errors };
}

module.exports = { parseSalesCsv, bulkImportSales };
