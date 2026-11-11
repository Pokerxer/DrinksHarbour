import { formatMoney } from './money';
import type { OfflineBook } from './offline';
import { suggestBottles } from './suggestions';
import type { KioskConfig, KioskProduct } from './types';
import { compareKey } from './use-compare';

export function BottleSuggestions({
  book, config, product, selected, canAdd, onAdd, onView,
}: {
  book: OfflineBook | null;
  config: KioskConfig;
  product: KioskProduct;
  selected: KioskProduct[];
  canAdd: boolean;
  onAdd: (product: KioskProduct) => void;
  onView: (product: KioskProduct) => void;
}) {
  const catalogue = book?.config.revision === config.revision ? book?.items : undefined;
  const suggestions = suggestBottles(product, catalogue ?? []);
  if (!suggestions.length) return null;
  return (
    <section className="checker-suggestions" aria-label="Similar bottles">
      <h2>Similar bottles in this store</h2>
      <ul>
        {suggestions.map((candidate) => {
          const bottle: KioskProduct = { ...candidate };
          if (!config.settings.displayBarcode) delete bottle.barcode;
          const key = compareKey(bottle);
          const added = selected.some((item) => compareKey(item) === key);
          return (
            <li key={key}>
              <button type="button" className="checker-suggestion-view" onClick={() => onView(bottle)}>
                {bottle.image && <img src={bottle.image} alt="" loading="lazy" referrerPolicy="no-referrer" />}
                <span>
                  <strong>{bottle.name}</strong>
                  {bottle.size && <small>{bottle.size}</small>}
                  <span>{formatMoney(bottle.price, bottle.currency)}</span>
                </span>
              </button>
              {config.settings.enableCompare && (
                <button type="button" className="checker-suggestion-add" disabled={added || !canAdd}
                  aria-label={added ? `${bottle.name} added` : `Add ${bottle.name} to compare`}
                  onClick={() => onAdd(bottle)}>
                  {added ? 'Added' : 'Add to compare'}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
