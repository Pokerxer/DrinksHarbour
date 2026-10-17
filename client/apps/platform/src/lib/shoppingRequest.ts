export interface ShoppingCoordinates { lat: number; lon: number }
export function shoppingHeaders(location: ShoppingCoordinates | null, existing?: HeadersInit): Headers {
  const headers = new Headers(existing);
  if (location) headers.set('x-shopping-location', JSON.stringify({ lat: location.lat, lon: location.lon }));
  else headers.delete('x-shopping-location');
  return headers;
}
export function createShoppingRequestGate() {
  let revision = 0;
  return { begin: () => ++revision, isCurrent: (id: number) => id === revision, cancel: () => { revision++; } };
}
export async function fetchShoppingJson<T>(url: string, options: {
  location: ShoppingCoordinates | null; signal?: AbortSignal; headers?: HeadersInit;
}): Promise<T> {
  const response = await fetch(url, {
    signal: options.signal, headers: shoppingHeaders(options.location, options.headers), cache: 'no-store',
  });
  if (!response.ok) throw new Error('Unable to load drinks');
  return response.json() as Promise<T>;
}
