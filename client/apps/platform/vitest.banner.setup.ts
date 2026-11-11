// jsdom 30 doesn't expose localStorage/sessionStorage as globals in this
// vitest setup — install a tiny in-memory shim (same API) for popup pacing.
const makeStore = () => {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  };
};
const g = globalThis as any;
if (typeof g.localStorage === 'undefined') g.localStorage = makeStore();
if (typeof g.sessionStorage === 'undefined') g.sessionStorage = makeStore();
