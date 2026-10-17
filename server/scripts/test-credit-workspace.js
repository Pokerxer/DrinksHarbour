// Disposable local database only. Does not load .env or connect to business data.
process.env.CREDIT_WORKSPACE_TEST_URI = 'mongodb://127.0.0.1:27192/drinks_credit_workspace_test_local';
require('../__tests__/creditNote.workspace.mongo.test');
