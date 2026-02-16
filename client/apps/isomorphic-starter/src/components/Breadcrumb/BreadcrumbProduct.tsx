"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PiCaretRight } from "react-icons/pi";

interface Category {
  _id?: string;
  name: string;
  slug: string;
}

interface SubCategory {
  _id?: string;
  name: string;
  slug: string;
}

interface ProductData {
  _id?: string;
  name: string;
  slug: string;
  category?: Category;
  subCategory?: SubCategory;
}

interface BreadcrumbProductProps {
  data: ProductData;
  productPage?: string;
  productId?: string | number;
}

const BreadcrumbProduct: React.FC<BreadcrumbProductProps> = ({
  data,
  productPage,
  productId,
}) => {
  const router = useRouter();

  const handleDetailProduct = (newProductId: string | number) => {
    router.push(`/product/${productPage}?id=${newProductId}`);
  };

  // Build breadcrumb items
  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Shop", href: "/shop" },
  ];

  // Add category if exists
  if (data?.category?.name && data?.category?.slug) {
    breadcrumbItems.push({
      label: data.category.name,
      href: `/shop?category=${data.category.slug}`,
    });
  }

  // Add subcategory if exists
  if (data?.subCategory?.name && data?.subCategory?.slug) {
    breadcrumbItems.push({
      label: data.subCategory.name,
      href: `/shop?category=${data.category?.slug}&subcategory=${data.subCategory.slug}`,
    });
  }

  // Add product name (current page - no link)
  if (data?.name) {
    breadcrumbItems.push({
      label: data.name,
      href: null, // Current page, no link
    });
  }

  return (
    <div className="breadcrumb-product bg-gray-50 border-b border-gray-200">
      <div className="md:pt-6 pt-4 pb-4">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            {/* Breadcrumb Navigation */}
            <nav aria-label="Breadcrumb">
              <ol className="flex items-center flex-wrap gap-1 text-sm">
                {breadcrumbItems.map((item, index) => {
                  const isLast = index === breadcrumbItems.length - 1;
                  
                  return (
                    <li key={index} className="flex items-center">
                      {index > 0 && (
                        <PiCaretRight size={14} className="mx-1 text-gray-400" />
                      )}
                      
                      {isLast || !item.href ? (
                        // Current page - no link
                        <span 
                          className="text-gray-900 font-medium truncate max-w-[200px] sm:max-w-[300px]"
                          aria-current="page"
                        >
                          {item.label}
                        </span>
                      ) : (
                        // Link to previous pages
                        <Link
                          href={item.href}
                          className="text-gray-500 hover:text-gray-900 hover:underline transition-colors"
                        >
                          {item.label}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ol>
            </nav>

            {/* Previous/Next Product Navigation */}
            {productId && (
              <div className="flex items-center gap-2 text-sm">
                {Number(productId) > 1 && (
                  <button
                    onClick={() => handleDetailProduct(Number(productId) - 1)}
                    className="flex items-center gap-1 text-gray-500 hover:text-gray-900 transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-100"
                  >
                    <span>← Prev</span>
                  </button>
                )}
                
                {Number(productId) < 100 && ( // Assuming max 100 products for demo
                  <button
                    onClick={() => handleDetailProduct(Number(productId) + 1)}
                    className="flex items-center gap-1 text-gray-500 hover:text-gray-900 transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-100"
                  >
                    <span>Next →</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BreadcrumbProduct;
