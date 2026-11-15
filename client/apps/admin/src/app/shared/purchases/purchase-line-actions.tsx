import {
  PiBookmarkSimple,
  PiCamera,
  PiPlus,
  PiSquaresFour,
  PiTextT,
} from 'react-icons/pi';

export default function PurchaseLineActions({
  hasEmptyProductRow,
  catalogueDisabled = false,
  onAddProduct,
  onAddPresentationLine,
  onOpenCatalogue,
  onOpenScan,
  scanTitle,
}: {
  hasEmptyProductRow: boolean;
  catalogueDisabled?: boolean;
  onAddProduct: () => void;
  onAddPresentationLine: (type: 'section' | 'note') => void;
  onOpenCatalogue: () => void;
  onOpenScan: () => void;
  scanTitle: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-gray-100 px-5 py-3">
      <button
        type="button"
        onClick={onAddProduct}
        disabled={hasEmptyProductRow}
        title={
          hasEmptyProductRow
            ? 'Select a product on the empty row first'
            : undefined
        }
        className="flex items-center gap-1.5 text-xs font-medium text-[#b20202] hover:underline disabled:cursor-not-allowed disabled:opacity-40"
      >
        <PiPlus className="h-3.5 w-3.5" /> Add a product
      </button>
      <button
        type="button"
        onClick={() => onAddPresentationLine('section')}
        className="flex items-center gap-1.5 text-xs font-medium text-[#b20202] hover:underline"
      >
        <PiBookmarkSimple className="h-3.5 w-3.5" /> Add a section
      </button>
      <button
        type="button"
        onClick={() => onAddPresentationLine('note')}
        className="flex items-center gap-1.5 text-xs font-medium text-[#b20202] hover:underline"
      >
        <PiTextT className="h-3.5 w-3.5" /> Add a note
      </button>
      <button
        type="button"
        onClick={onOpenCatalogue}
        disabled={catalogueDisabled}
        title={
          catalogueDisabled ? 'Select a source warehouse first' : undefined
        }
        className="flex items-center gap-1.5 text-xs font-medium text-[#b20202] hover:underline disabled:cursor-not-allowed disabled:opacity-40"
      >
        <PiSquaresFour className="h-3.5 w-3.5" /> Catalogue
      </button>
      <button
        type="button"
        onClick={onOpenScan}
        title={scanTitle}
        className="flex items-center gap-1.5 text-xs font-medium text-[#b20202] hover:underline"
      >
        <PiCamera className="h-3.5 w-3.5" /> Scan &amp; Match
      </button>
    </div>
  );
}
