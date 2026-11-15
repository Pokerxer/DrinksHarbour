'use client';

import SharedAddressAutocomplete, { type AddressAutocompleteProps } from '../../../../../packages/isomorphic-core/src/components/google-map/delivery-address-autocomplete';
import { API_URL } from '@/lib/api';

export type { AddressDetails } from '../../../../../packages/isomorphic-core/src/components/google-map/delivery-address-autocomplete';

export default function AddressAutocomplete(props: Omit<AddressAutocompleteProps, 'apiUrl'>) {
  return <SharedAddressAutocomplete {...props} apiUrl={API_URL} />;
}
