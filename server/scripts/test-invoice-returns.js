// Disposable localhost integration only; no .env or business database.
process.env.INVOICE_RETURNS_TEST_URI = 'mongodb://127.0.0.1:27192/drinks_saved_invoice_test_returns';
require('../__tests__/invoiceReturns.mongo.test');
