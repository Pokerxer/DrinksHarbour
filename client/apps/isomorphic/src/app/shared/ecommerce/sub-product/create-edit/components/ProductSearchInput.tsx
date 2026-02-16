import { useState, useRef, useCallback } from 'react';
import { PiMagnifyingGlass, PiX, PiBarcode, PiCamera } from 'react-icons/pi';
import { Loader } from 'rizzui';

interface ProductSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  isLoading: boolean;
  placeholder?: string;
}

export function ProductSearchInput({
  value,
  onChange,
  onClear,
  isLoading,
  placeholder = "Search for a product by name, brand, or barcode...",
}: ProductSearchInputProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [showBarcodeInput, setShowBarcodeInput] = useState(false);
  const [barcodeValue, setBarcodeValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  const handleBarcodeSubmit = useCallback(() => {
    if (barcodeValue.trim()) {
      onChange(barcodeValue.trim());
      setShowBarcodeInput(false);
      setBarcodeValue('');
      inputRef.current?.focus();
    }
  }, [barcodeValue, onChange]);

  const handleBarcodeKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleBarcodeSubmit();
    } else if (e.key === 'Escape') {
      setShowBarcodeInput(false);
      setBarcodeValue('');
      inputRef.current?.focus();
    }
  };

  const handleClear = () => {
    onClear();
    inputRef.current?.focus();
  };

  return (
    <div className="relative">
      <div className="relative">
        <PiMagnifyingGlass className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-24 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {isLoading && <Loader variant="spinner" size="sm" />}
          
          {!showBarcodeInput && (
            <button
              type="button"
              onClick={() => setShowBarcodeInput(true)}
              className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-blue-600 transition-colors"
              title="Scan barcode"
            >
              <PiBarcode className="h-5 w-5" />
            </button>
          )}
          
          {value && !isLoading && (
            <button
              type="button"
              onClick={handleClear}
              className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              title="Clear search"
            >
              <PiX className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Barcode Input Popup */}
      {showBarcodeInput && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-lg border border-gray-200 bg-white p-4 shadow-lg">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-700">
            <PiBarcode className="h-4 w-4" />
            Enter Barcode
          </div>
          <input
            ref={barcodeInputRef}
            type="text"
            value={barcodeValue}
            onChange={(e) => setBarcodeValue(e.target.value)}
            onKeyDown={handleBarcodeKeyDown}
            placeholder="Scan or type barcode..."
            autoFocus
            className="mb-3 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setShowBarcodeInput(false);
                setBarcodeValue('');
              }}
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleBarcodeSubmit}
              disabled={!barcodeValue.trim()}
              className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              Search
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProductSearchInput;
