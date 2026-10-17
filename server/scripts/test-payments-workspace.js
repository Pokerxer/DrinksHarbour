// Disposable localhost replica only. Never reads .env or business database URIs.
process.env.PAYMENT_WORKSPACE_TEST_URI = 'mongodb://127.0.0.1:27192/drinks_payments_workspace_test_local';
require('../__tests__/payments.workspace.mongo.test');
