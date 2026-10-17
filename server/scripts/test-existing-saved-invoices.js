// Existing invoice integration against a disposable local replica database.
process.env.DRINKSHARBOUR_SAVED_INVOICE_TEST_MONGO_URI = 'mongodb://127.0.0.1:27192/drinks_saved_invoice_test_regression';
require('../__tests__/customerInvoice.mongo.test');
