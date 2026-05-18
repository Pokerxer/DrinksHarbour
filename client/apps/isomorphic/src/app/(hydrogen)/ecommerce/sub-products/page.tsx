// @ts-nocheck
import Link from 'next/link';
import { PiPlusBold } from 'react-icons/pi';
import { routes } from '@/config/routes';
import { Button } from 'rizzui/button';
import PageHeader from '@/app/shared/page-header';
import SubProductsTable from '@/app/shared/ecommerce/sub-product/sub-product-list/table';
import { metaObject } from '@/config/site.config';
import ExportButton from '@/app/shared/export-button';
import POSNavHeader from '@/app/shared/point-of-sale/pos-nav-header';

export const metadata = {
  ...metaObject('Products'),
};

const pageHeader = {
  title: 'Products',
  breadcrumb: [
    {
      href: routes.eCommerce.dashboard,
      name: 'E-Commerce',
    },
    {
      href: routes.eCommerce.subProducts,
      name: 'Products',
    },
    {
      name: 'List',
    },
  ],
};

export default async function SubProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const params = await searchParams;
  const fromPOS = params.from === 'pos';

  return (
    <>
      {fromPOS && <POSNavHeader />}
      <PageHeader title={pageHeader.title} breadcrumb={pageHeader.breadcrumb}>
        <div className="mt-4 flex items-center gap-3 @lg:mt-0">
          <Link
            href={routes.eCommerce.createSubProduct}
            className="w-full @lg:w-auto"
          >
            <Button as="span" className="w-full @lg:w-auto">
              <PiPlusBold className="me-1.5 h-[17px] w-[17px]" />
              Add Product
            </Button>
          </Link>
        </div>
      </PageHeader>

      <SubProductsTable pageSize={10} />
    </>
  );
}
