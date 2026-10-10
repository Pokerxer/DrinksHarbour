const Notification = require('../models/Notification');
const ready = new WeakMap();
function ensureNotificationDedupIndex(model = Notification) {
  if (ready.has(model)) return ready.get(model);
  const attempt = Promise.resolve()
    .then(() => {
      const definition = model.schema
        .indexes()
        .find(([fields]) => fields.dedupKey === 1);
      if (!definition)
        throw Error('Notification dedup index missing from schema');
      // Do not rebuild unrelated legacy indexes (e.g. the non-TTL expiresAt index).
      return model.collection.createIndex(...definition);
    })
    .catch((error) => {
      ready.delete(model);
      throw error;
    });
  ready.set(model, attempt);
  return attempt;
}
module.exports = { ensureNotificationDedupIndex };
