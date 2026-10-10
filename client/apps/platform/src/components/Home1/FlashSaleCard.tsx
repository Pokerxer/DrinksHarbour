"use client";
import { memo, useState } from "react";
import Link from "next/link";
import Image from "@/components/UI/OptimizedImage";
import { StockStatus } from "@/components/StockStatus";
import { PiLightningFill, PiImageBroken, PiShoppingCartSimple, PiFireSimple } from "react-icons/pi";
import type { SaleProduct } from "./flash-sale-types";
import { getBestSale } from "./flash-sale-helpers";
const FlashSaleCard = memo(function FlashSaleCard({
  product,
  onQuickView,
}: {
  product: SaleProduct;
  onQuickView: (product: SaleProduct) => void;
}) {
  const [imageError, setImageError] = useState(false);
  const sale = getBestSale(product);

  const imageUrl = product.primaryImage?.url || product.images?.[0]?.url || "";
  const isFlashSale = sale.saleType === "flash_sale";
  const isFixed = sale.saleType === "fixed";

  const totalStock = product.stockInfo?.totalStock ?? 100;
  const availableStock = product.stockInfo?.availableStock ?? sale.stock ?? 100;

  return (
    <div className="relative bg-white rounded-2xl overflow-hidden shadow-md border border-gray-100 motion-safe:hover:shadow-lg motion-safe:hover:-translate-y-0.5 transition-all duration-200 group">
      <Link href={`/product/${product.slug}`} className="block">
        {/* Image */}
        <div className="relative aspect-square bg-gradient-to-br from-gray-50 to-gray-100">
          {!imageError && imageUrl ? (
            <Image
              src={imageUrl}
              alt={product.name}
              fill
              sizes="(max-width: 480px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 20vw, 16vw"
              className="object-contain p-2 motion-safe:group-hover:scale-105 transition-transform duration-300"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <PiImageBroken size={44} className="text-gray-300" />
            </div>
          )}

          {/* Discount Badge */}
          {sale.hasDiscount && (
            <div className="absolute top-0 left-0">
              <div
                className={`text-white text-[10px] font-black px-2 py-1 rounded-br-xl flex items-center gap-0.5 ${
                  isFlashSale
                    ? "bg-gradient-to-br from-orange-500 to-red-600"
                    : isFixed
                      ? "bg-gradient-to-br from-emerald-500 to-teal-600"
                      : "bg-gradient-to-br from-red-500 to-pink-600"
                }`}
              >
                {isFlashSale && <PiLightningFill size={9} />}
                {sale.discountLabel ||
                  (isFixed
                    ? `₦${(sale.originalPrice - sale.currentPrice).toLocaleString()} OFF`
                    : `${sale.discountPct}% OFF`)}
              </div>
            </div>
          )}

          {/* Flash Sale type indicator */}
          {isFlashSale && (
            <div className="absolute top-0 right-0 m-1">
              <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center motion-safe:animate-pulse">
                <PiLightningFill size={12} className="text-white" />
              </div>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-2.5">
          <h3 className="text-[11px] font-semibold text-gray-800 line-clamp-2 leading-tight min-h-[2rem]">
            {product.name}
          </h3>

          {/* Stock progress */}
          <div className="mt-1.5">
            <StockStatus
              stock={sale.stock}
              totalStock={totalStock}
              availableStock={availableStock}
              showProgress
            />
          </div>

          {/* Price row */}
          <div className="mt-2 flex items-center justify-between gap-1">
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-black text-red-500 leading-tight">
                ₦{sale.currentPrice.toLocaleString()}
              </span>
              {sale.hasDiscount && sale.originalPrice > sale.currentPrice && (
                <span className="text-[10px] text-gray-400 line-through leading-tight">
                  ₦{sale.originalPrice.toLocaleString()}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onQuickView(product);
              }}
              className="flex-shrink-0 min-h-10 min-w-10 bg-gradient-to-br from-orange-500 to-red-600 text-white rounded-xl hover:from-orange-600 hover:to-red-700 motion-safe:active:scale-95 transition-all flex items-center justify-center shadow-sm"
              aria-label={`Quick view ${product.name}`}
            >
              <PiShoppingCartSimple size={15} />
            </button>
          </div>

          {/* Sold count */}
          {(product.totalSold ?? 0) > 0 && (
            <div className="mt-1 flex items-center gap-1">
              <PiFireSimple size={10} className="text-orange-400" />
              <span className="text-[9px] text-gray-400">
                {(product.totalSold! >= 1000
                  ? `${(product.totalSold! / 1000).toFixed(1)}k`
                  : product.totalSold
                )}{" "}
                sold
              </span>
            </div>
          )}
        </div>
      </Link>
    </div>
  );
});


export default FlashSaleCard;
