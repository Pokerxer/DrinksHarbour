'use client';

import { useRouter } from 'next/navigation';
import { Button } from 'rizzui';
import { routes } from '@/config/routes';
import { requestDuplicate } from './create-edit/duplicate-intent';

export default function DuplicateSubProductButton({
  sourceId,
}: {
  sourceId: string;
}) {
  const router = useRouter();
  return (
    <Button
      type="button"
      variant="outline"
      className="mt-3 w-full"
      onClick={() => {
        requestDuplicate(sourceId);
        router.push(routes.eCommerce.createSubProduct);
      }}
    >
      Duplicate
    </Button>
  );
}
