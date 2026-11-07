// Only Next's request-context cookie adapter is replaced in this compatibility pilot.
export const cookieJar = new Map();
export const writtenCookies = [];
export async function cookies() {
  return {
    get: (name) =>
      cookieJar.has(name) ? { value: cookieJar.get(name) } : undefined,
    set: (name, value, options) => {
      cookieJar.set(name, value);
      writtenCookies.push({ name, value, options });
    },
  };
}
