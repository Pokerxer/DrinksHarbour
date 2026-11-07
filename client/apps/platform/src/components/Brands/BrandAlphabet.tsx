import styles from './BrandsControls.module.css';

interface BrandAlphabetProps {
  availableLetters: string[];
  value: string | null;
  onChange: (value: string | null) => void;
}

export default function BrandAlphabet({ availableLetters, value, onChange }: BrandAlphabetProps) {
  return (
    <div role="group" aria-label="Filter brands by first letter" className={`${styles.alphabet} mb-6 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm`}>
      <button type="button" aria-pressed={value === null} onClick={() => onChange(null)}
        className={`${styles.allBrands} rounded-lg text-xs font-bold focus-visible:outline-red-700 ${value === null ? 'bg-red-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}>
        All brands
      </button>
      {'#ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(letter => (
        <button type="button" key={letter} aria-pressed={value === letter}
          disabled={!availableLetters.includes(letter) && value !== letter}
          onClick={() => onChange(value === letter ? null : letter)}
          className={`rounded-lg text-xs font-bold focus-visible:outline-red-700 disabled:cursor-not-allowed disabled:text-gray-300 ${value === letter ? 'bg-red-600 text-white shadow-sm' : 'text-gray-700 hover:bg-gray-100'}`}>
          {letter}
        </button>
      ))}
    </div>
  );
}
