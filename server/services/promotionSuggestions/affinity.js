function affinity(rows) {
  const baskets = new Map();
  for (const row of rows) {
    const keys = baskets.get(row.id) || new Set();
    row.keys.forEach((key) => keys.add(key));
    baskets.set(row.id, keys);
  }
  for (const [key, items] of baskets) if (items.size > 50) baskets.delete(key);
  const counts = new Map(),
    pairs = new Map();
  for (const keys of baskets.values()) {
    const list = [...keys].sort();
    if (list.length > 50) continue;
    for (const key of list) counts.set(key, (counts.get(key) || 0) + 1);
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        const key = JSON.stringify([list[i], list[j]]);
        pairs.set(key, (pairs.get(key) || 0) + 1);
      }
  }
  const total = baskets.size;
  return [...pairs]
    .flatMap(([key, joint]) => {
      const keys = JSON.parse(key),
        a = counts.get(keys[0]),
        b = counts.get(keys[1]);
      const lift = (joint * total) / (a * b);
      return total >= 10 && joint >= 3 && joint / total >= 0.02 && lift > 1.05
        ? [
            {
              keys,
              jointBaskets: joint,
              basketCount: total,
              support: joint / total,
              lift,
              confidence: joint >= 10 && total >= 50 ? "strong" : "emerging",
              purchaseRate: joint / Math.max(a, b),
            },
          ]
        : [];
    })
    .sort((a, b) => b.jointBaskets - a.jointBaskets || b.lift - a.lift)
    .slice(0, 200);
}
module.exports = { affinity };
