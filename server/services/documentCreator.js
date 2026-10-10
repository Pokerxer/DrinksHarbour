const CREATOR_FIELDS = 'firstName lastName displayName email';

function withDocumentCreatorName(document) {
  const data = typeof document.toObject === 'function' ? document.toObject() : document;
  const creator = data.createdBy;
  // Keep unavailable/unpopulated references intact, including ObjectIds.
  if (!creator || typeof creator !== 'object' || !Object.hasOwn(creator, '_id')) return data;
  const clean = (value) => (typeof value === 'string' ? value.trim() : '');
  const name =
    clean(creator.displayName) ||
    [clean(creator.firstName), clean(creator.lastName)].filter(Boolean).join(' ') ||
    clean(creator.name) ||
    clean(creator.email) ||
    'Unknown user';
  return { ...data, createdBy: { ...creator, name } };
}
module.exports = { CREATOR_FIELDS, withDocumentCreatorName };
