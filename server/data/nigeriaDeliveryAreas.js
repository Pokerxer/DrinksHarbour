'use strict';

const naija = require('naija-state-local-government');

function resolvePackageState(state) {
  if (!state) return null;
  const s = state.trim().toLowerCase();
  if (['fct - abuja', 'fct', 'abuja', 'federal capital territory'].includes(s))
    return 'Federal Capital Territory';
  const all = naija.all();
  return (
    all.find(r => r.state.toLowerCase() === s) ||
    all.find(r => r.state.toLowerCase() === s.replace(/\s+state$/i, '').trim())
  )?.state || null;
}

function listDeliveryLgas(state) {
  const pkgState = resolvePackageState(state);
  if (!pkgState) return [];
  try {
    return (naija.lgas(pkgState)?.lgas || []).slice().sort();
  } catch {
    return [];
  }
}

module.exports = { resolvePackageState, listDeliveryLgas };
