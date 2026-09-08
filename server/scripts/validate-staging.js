#!/usr/bin/env node
'use strict';
// Default is an offline preflight. Each external action requires an explicit
// flag and a dedicated staging environment. Never print credentials.
function preflight(env = process.env) {
  const required = ['STAGING_MONGODB_URI', 'PAYSTACK_SECRET_KEY', 'STAGING_SUBSCRIPTION_CODE',
    'PAYSTACK_PLAN_STARTER', 'PAYSTACK_PLAN_GROWTH', 'PAYSTACK_PLAN_PRO',
    'PAYSTACK_PLAN_ENTERPRISE', 'PAYSTACK_PLAN_VENUE', 'STAGING_MAIL_TO'];
  const missing = required.filter(key => !env[key]);
  const errors = [];
  if (env.PAYSTACK_SECRET_KEY && !env.PAYSTACK_SECRET_KEY.startsWith('sk_test_')) errors.push('Paystack must use a test key');
  if (!env.MAIL_PASSWORD && !env.MAILING_REFRESH_TOKEN) errors.push('Outbound mail credentials are missing');
  return { missing, errors, ready: !missing.length && !errors.length };
}
async function main() {
  const flags = new Set(process.argv.slice(2));
  const report = preflight();
  console.log(JSON.stringify({ mode: 'preflight', ...report }));
  const external = ['--provider', '--mail', '--jobs'].some(flag => flags.has(flag));
  if (!external) { process.exitCode = report.ready ? 0 : 2; return; }
  if (!report.ready || process.env.STAGING_VALIDATION !== 'true') throw new Error('External checks require complete staging config and STAGING_VALIDATION=true');
  if (flags.has('--provider')) {
    const { fetchSubscription } = require('../services/billingReconciliation.service');
    const subscription = await fetchSubscription(process.env.STAGING_SUBSCRIPTION_CODE);
    console.log(JSON.stringify({ check: 'provider-read', passed: true, status: subscription.status }));
  }
  if (flags.has('--mail')) {
    const { sendEmail } = require('../services/email.service');
    const result = await sendEmail({ to: process.env.STAGING_MAIL_TO,
      subject: 'DrinksHarbour staging delivery validation', html: '<p>Staging delivery test. Record receipt and delivery headers in the validation checklist.</p>' });
    if (!result.success || !result.messageId || ['dev-mode', 'suppressed'].includes(result.messageId)) throw new Error('Mail was not accepted by a real transport');
    console.log(JSON.stringify({ check: 'mail-transport', accepted: true, deliveryStillNeedsRecipientConfirmation: true }));
  }
  if (flags.has('--jobs')) {
    const mongoose = require('mongoose');
    await mongoose.connect(process.env.STAGING_MONGODB_URI);
    try {
      const billing = await require('../jobs/billingReconciliation.job').sweepBillingReconciliation();
      const notices = await require('../jobs/billingNotices.job').sweepBillingNotices();
      console.log(JSON.stringify({ check: 'scheduled-jobs', billing, notices }));
      if (billing.failed || notices.failed) throw new Error('One or more job checks failed');
    } finally { await mongoose.disconnect(); }
  }
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { preflight };
