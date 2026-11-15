'use client';

import SharedLocationPickerMap, { type LocationPickerMapProps } from '../../../../../packages/isomorphic-core/src/components/google-map/delivery-location-map';
import { API_URL } from '@/lib/api';

export default function LocationPickerMap(props: Omit<LocationPickerMapProps, 'apiUrl'>) {
  return <SharedLocationPickerMap {...props} apiUrl={API_URL} />;
}
