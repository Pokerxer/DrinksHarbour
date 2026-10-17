// Local disposable replica only. Never reads business environment configuration.
process.env.SOURCE_BATCH_TEST_URI = 'mongodb://127.0.0.1:27192/drinks_source_batches_test_local';
require('../__tests__/batchPayment.source.mongo.test');
