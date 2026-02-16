import React from 'react';

interface SoldProgressProps {
  sold: number;
  quantity: number;
  percentage: number;
}

export const SoldProgress: React.FC<SoldProgressProps> = ({ sold, quantity, percentage }) => {
return (
<div className="product-sold sm:pb-4 pb-2">
      <div className="progress bg-line h-1.5 w-full rounded-full overflow-hidden relative">
        <div
          className="progress-sold bg-red-500 absolute left-0 top-0 h-full"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="flex items-center justify-between gap-3 gap-y-1 flex-wrap mt-2">
        <div className="text-button-uppercase">
          <span className="text-secondary2 max-sm:text-xs">Sold: </span>
          <span className="max-sm:text-xs">{sold}</span>
        </div>
        <div className="text-button-uppercase">
          <span className="text-secondary2 max-sm:text-xs">Available: </span>
          <span className="max-sm:text-xs">{quantity - sold}</span>
        </div>
      </div>
    </div>
  );
};

export default SoldProgress;
