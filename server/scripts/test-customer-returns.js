// Disposable local integration runner; never loads .env or business data.
process.env.CUSTOMER_RETURNS_TEST_URI = 'mongodb://127.0.0.1:27193/drinks_customer_returns_test_projection';
require('../__tests__/customerReturns.test');
