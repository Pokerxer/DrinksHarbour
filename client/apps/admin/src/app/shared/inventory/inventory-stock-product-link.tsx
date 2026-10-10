'use client';
import Link from 'next/link';
import { routes } from '@/config/routes';

export default function StockProductLink({ id, name }: { id: string; name: string }) {
  if (!id) return <span>{name}</span>;
  return (
    <Link
      href={routes.eCommerce.subProductDetails(id)}
      onClick={(event) => event.stopPropagation()}
      className="hover:underline focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
    >
      {name}
    </Link>
  );
}
