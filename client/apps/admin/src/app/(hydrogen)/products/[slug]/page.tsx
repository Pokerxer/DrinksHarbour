import Link from 'next/link';
import { routes } from '@/config/routes';
import ProductDetails from '@/app/shared/ecommerce/product/product-details';
import { metaObject } from '@/config/site.config';

export const metadata = {
  ...metaObject('Product Details'),
};

export default function ProductDetailsPage() {
  return (
    <>
      <div className="mt-4">
        <nav aria-label="Breadcrumb" className="mb-4 text-sm text-gray-600">
          <Link
            href={routes.eCommerce.products}
            className="underline underline-offset-4"
          >
            Products
          </Link>
          <span aria-hidden="true" className="mx-2">
            /
          </span>
          <span aria-current="page">Product details</span>
        </nav>
        <ProductDetails />
      </div>
    </>
  );
}
