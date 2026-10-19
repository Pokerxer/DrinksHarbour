const Tenant = require('../../models/Tenant');
const { NotFoundError } = require('../../utils/errors');
const privateBank = require('../../data/examinations/wyn-city-drinks-30.json');
const BANK_ID = 'wyn-city-drinks-30';
function bankForTenant(tenant, id = BANK_ID) {
  if (tenant?.slug !== 'wyncity' || id !== BANK_ID) throw new NotFoundError('Question bank not found.');
  return { ...privateBank, questions: privateBank.questions.map(q => ({ ...q, options: [...q.options] })) };
}
async function availableQuestionBanks(tenantId) {
  const tenant = await Tenant.findOne({ _id: tenantId }).select('slug').lean();
  return tenant?.slug === 'wyncity' ? [{ id: BANK_ID, name: privateBank.name, questionCount: privateBank.questions.length }] : [];
}
async function loadQuestionBank(tenantId, id) {
  const tenant = await Tenant.findOne({ _id: tenantId }).select('slug').lean();
  return bankForTenant(tenant, id);
}
module.exports = { bankForTenant, availableQuestionBanks, loadQuestionBank };
