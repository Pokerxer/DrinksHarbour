"use client";

import React from "react";

export interface StockStatusProps {
  stock?: number;
  totalStock?: number;
  availableStock?: number;
  inStock?: boolean;
  size?: "sm" | "md" | "lg";
  showProgress?: boolean;
  className?: string;
}

interface StatusInfo {
  text: string;
  color: string;
  bg: string;
  dot: string;
}

const StockStatus: React.FC<StockStatusProps> = ({
  stock,
  totalStock = 100,
  availableStock,
  inStock = true,
  size = "sm",
  showProgress = false,
  className = "",
}) => {
  const getStatus = (): StatusInfo => {
    if (!inStock || stock === 0) {
      return {
        text: "Out of Stock",
        color: "text-red-500",
        bg: "bg-red-500",
        dot: "bg-red-500",
      };
    }

    const effectiveStock = availableStock ?? stock ?? totalStock;
    const soldPercentage = ((totalStock - effectiveStock) / totalStock) * 100;

    if (soldPercentage >= 90) {
      return {
        text: "Almost Gone",
        color: "text-red-500",
        bg: "bg-red-500",
        dot: "bg-red-500",
      };
    }
    if (soldPercentage >= 70) {
      return {
        text: "Selling Fast",
        color: "text-orange-500",
        bg: "bg-orange-500",
        dot: "bg-orange-500",
      };
    }
    if (soldPercentage >= 50) {
      return {
        text: "Limited Stock",
        color: "text-yellow-600",
        bg: "bg-yellow-500",
        dot: "bg-yellow-500",
      };
    }
    return {
      text: "In Stock",
      color: "text-emerald-500",
      bg: "bg-emerald-500",
      dot: "bg-emerald-500",
    };
  };

  const status = getStatus();

  const sizeClasses = {
    sm: "text-[9px]",
    md: "text-xs",
    lg: "text-sm",
  };

  const dotSizes = {
    sm: "w-1.5 h-1.5",
    md: "w-2 h-2",
    lg: "w-2.5 h-2.5",
  };

  const effectiveStock = availableStock ?? stock ?? totalStock;
  const soldPercentage = Math.min(
    100,
    Math.max(0, ((totalStock - effectiveStock) / totalStock) * 100),
  );

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <div
        className={`flex items-center gap-1 ${status.color} ${sizeClasses[size]}`}
      >
        <span className={`${dotSizes[size]} rounded-full ${status.dot}`} />
        {stock !== undefined && stock <= 5 && stock > 0 ? (
          <span className="font-medium">Only {stock} left</span>
        ) : (
          <span className="font-medium">{status.text}</span>
        )}
      </div>
      {showProgress && (
        <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${status.bg} transition-all duration-300`}
            style={{ width: `${100 - soldPercentage}%` }}
          />
        </div>
      )}
    </div>
  );
};

export default StockStatus;
