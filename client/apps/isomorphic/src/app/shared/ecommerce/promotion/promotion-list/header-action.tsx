'use client';

import Link from 'next/link';
import { PiPlusBold } from 'react-icons/pi';
import { Button } from 'rizzui';
import { routes } from '@/config/routes';

export default function PromotionHeaderAction() {
  return (
    <Link
      href={routes.eCommerce.createPromotion}
      className="w-full @lg:w-auto"
    >
      <Button as="span" className="w-full @lg:w-auto">
        <PiPlusBold className="me-1.5 h-[17px] w-[17px]" />
        Add Promotion
      </Button>
    </Link>
  );
}
