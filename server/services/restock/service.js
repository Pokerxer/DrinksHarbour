const { readEvidence } = require("./reader");
const { buildPlan } = require("./plan");
function createPlanningService(
  reader = readEvidence,
  clock = () => new Date(),
  persist = async () => {},
) {
  const cache = new Map(),
    running = new Map();
  return async function getPlan(tenantId, options = {}) {
    const identity = [
      tenantId,
      options.warehouseId || "",
      options.startDate || "",
      options.endDate || "",
      options.coverDays || 14,
      !!options.purchasing,
      options.includeSales !== false,
      options.updateMinimum === true,
    ].join(":");
    const now = clock(),
      cached = cache.get(identity);
    if (!options.refresh && cached && now.getTime() - cached.at < 300000)
      return cached.value;
    if (running.has(identity)) return running.get(identity);
    const work = (async () => {
      const evidence = await reader(tenantId, { ...options, now });
      const result = buildPlan(evidence, { ...options, now });
      if (options.updateMinimum === true && options.includeSales !== false)
        await persist(tenantId, result);
      if (cache.size >= 20) cache.delete(cache.keys().next().value);
      cache.set(identity, { at: now.getTime(), value: result });
      return result;
    })();
    running.set(identity, work);
    try {
      return await work;
    } finally {
      running.delete(identity);
    }
  };
}
module.exports = {
  createPlanningService,
  getPlan: createPlanningService(
    readEvidence,
    () => new Date(),
    require("./minimum-storage").persistMinimums,
  ),
};
