'use client';

import React, { useCallback } from 'react';
import * as Icon from 'react-icons/pi';

interface QuantitySelectorProps {
  quantity: number;
  onChange: (quantity: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
};
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
      (e: React.ChangeEvent<HTMLInputElement>) => {;
const value = parseInt(e.target.value, 10);
        if (!isNaN(value) && value >= min && value <= max) {
          onChange(value);
        }
      },
      [min, max, onChange]
    );

    return (
<div
        className={`flex items-center border-2 rounded-xl overflow-hidden bg-gray-50 ${
          disabled ? 'opacity-50 cursor-not-allowed border-gray-200' : 'border-gray-200'
        }`}
      >
        <button
          onClick={handleDecrease}
          disabled={disabled || quantity <= min}
          className="w-12 h-12 flex items-center justify-center bg-white hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Decrease quantity"
        >
          <Icon.PiMinusBold size={18} />
        </button>

        <input
          type="number"
          value={quantity}
          onChange={handleInputChange}
          disabled={disabled}
          min={min}
          max={max}
          className="w-16 h-12 text-center bg-transparent font-bold text-lg focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />

        <button
          onClick={handleIncrease}
          disabled={disabled || quantity >= max}
          className="w-12 h-12 flex items-center justify-center bg-white hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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
