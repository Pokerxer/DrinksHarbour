import { validShoppingLocation } from '../../context/shopping-location.ts';
import type { ShoppingLocation } from '../../context/shopping-location';

export function previewCurrentLocation(signal: AbortSignal, geolocation?: Pick<Geolocation, 'getCurrentPosition'>): Promise<ShoppingLocation> {
  const service = geolocation ?? (typeof navigator === 'undefined' ? undefined : navigator.geolocation);
  return new Promise((resolve, reject) => {
    if (!service) { reject(new Error('Current location is unavailable. Please enter an address.')); return; }
    let settled = false;
    const finish = () => { settled = true; signal.removeEventListener('abort', cancel); };
    const cancel = () => { finish(); reject(new DOMException('Location lookup cancelled', 'AbortError')); };
    if (signal.aborted) { cancel(); return; }
    signal.addEventListener('abort', cancel, { once: true });
    const attempt = (fresh: boolean) => {
      let completed = false;
      const inactive = () => settled || signal.aborted || completed;
      service.getCurrentPosition(position => {
        if (inactive()) return;
        completed = true; finish();
        const location: ShoppingLocation = { lat: position.coords.latitude, lon: position.coords.longitude,
          source: 'current', label: 'Current location' };
        if (!validShoppingLocation(location)) { reject(new Error('We could not find a valid location. Please enter an address.')); return; }
        resolve(location);
      }, error => {
        if (inactive()) return;
        completed = true;
        if (error.code === 3 && !fresh) { attempt(true); return; }
        finish();
        reject(new Error(error.code === 1
          ? 'Location access is blocked. Allow it in your browser or enter an address.'
          : error.code === 3 ? 'Your device could not provide a location. Check that device location services are on, then try again or enter a delivery address.'
            : 'We could not find your current location. Try again or enter an address.'));
      }, fresh
        ? { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
        : { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
    };
    attempt(false);
  });
}
