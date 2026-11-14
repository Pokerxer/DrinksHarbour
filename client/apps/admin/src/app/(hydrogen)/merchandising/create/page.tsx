import PairingForm from '@/app/shared/merchandising/pairings/pairing-form';
import { metaObject } from '@/config/site.config';

export const metadata = {
  ...metaObject('Create Pairing'),
};

export default async function CreatePairingPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string }>;
}) {
  // ?source=<sourceProductId> loads an existing pairing into the form —
  // editing is the same upsert (there is no GET-by-id endpoint).
  const query = await searchParams;
  return <PairingForm editSourceId={query?.source} />;
}
