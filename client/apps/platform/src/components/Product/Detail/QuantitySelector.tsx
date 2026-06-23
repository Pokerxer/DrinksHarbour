'use client';

import React, { useCallback } from 'react';
import * as Icon from 'react-icons/pi';

interface QuantitySelectorProps {
  quantity: number;
  onChange: (quantity: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
}

const QuantitySelector: React.FC<QuantitySelectorProps> = React.memo(
  ({ quantity, onChange, min = 1, max = 99, disabled = false }) => {
    const handleDecrease = useCallback(() => {
      if (quantity > min) {
        onChange(quantity - 1);
      }
    }, [quantity, min, onChange]);

    const handleIncrease = useCallback(() => {
      if (quantity < max) {
        onChange(quantity + 1);
      }
    }, [quantity, max, onChange]);

    const handleInputChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseInt(e.target.value, 10);
        if (!isNaN(value) && value >= min && value <= max) {
          onChange(value);
        }
      },
      [min, max, onChange]
    );

    const isAtMin = quantity <= min;
    const isAtMax = quantity >= max;

    return (
      <div
        className={`flex items-center rounded-full overflow-hidden shadow-sm border border-gray-200 ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      >
        <button
          onClick={handleDecrease}
          disabled={disabled || isAtMin}
          className={`
            w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center
            transition-all duration-200 rounded-l-full
            ${isAtMin 
              ? 'bg-gray-100 text-gray-300 cursor-not-allowed' 
              : 'bg-white text-gray-700 hover:bg-red-50 hover:text-red-500 active:scale-95'
            }
          `}
          aria-label="Decrease quantity"
        >
          <Icon.PiMinusBold size={18} />
        </button>

        <div className="relative flex items-center justify-center min-w-[3rem] sm:min-w-[4rem] h-12 sm:h-14 bg-white border-x border-gray-200">
          <input
            type="number"
            value={quantity}
            onChange={handleInputChange}
            disabled={disabled}
            min={min}
            max={max}
            className="w-full h-full text-center bg-transparent font-bold text-base sm:text-lg focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="absolute -bottom-5 sm:-bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-gray-400 font-normal hidden sm:block">
            qty
          </span>
        </div>

        <button
          onClick={handleIncrease}
          disabled={disabled || isAtMax}
          className={`
            w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center
            transition-all duration-200 rounded-r-full
            ${isAtMax 
              ? 'bg-gray-100 text-gray-300 cursor-not-allowed' 
              : 'bg-white text-gray-700 hover:bg-green-50 hover:text-green-500 active:scale-95'
            }
          `}
          aria-label="Increase quantity"
        >
          <Icon.PiPlusBold size={18} />
        </button>
      </div>
    );
  }
);

QuantitySelector.displayName = 'QuantitySelector';

export default QuantitySelector;
