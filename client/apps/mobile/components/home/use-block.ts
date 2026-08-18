import { useCallback, useEffect, useState } from 'react';
import type { CatalogResult } from '../../lib/catalog-api.ts';
import type { BlockState } from '../../lib/home-blocks.ts';

/**
 * One block's fetch lifecycle.
 *
 * Every block owns its own request (design §3): a single combined call means one
 * dead endpoint blanks the whole screen, and `onSale` and `bestsellers` are the
 * two least-exercised endpoints in the codebase.
 *
 * The hook holds no logic worth testing — the decisions it feeds (what renders,
 * when Home counts as empty) live in lib/home-blocks.ts, which is unit-tested.
 * Hooks cannot be exercised under environment:'node'.
 */
export function useBlock<T>(load: () => Promise<CatalogResult<T[]>>): {
  items: T[];
  state: BlockState;
  reload: () => void;
} {
  const [items, setItems] = useState<T[]>([]);
  const [state, setState] = useState<BlockState>({ phase: 'loading', itemCount: 0 });

  const run = useCallback(async () => {
    setState({ phase: 'loading', itemCount: 0 });

    const result = await load();

    if (!result.ok) {
      // Logged, not surfaced (design §7). No block here is essential.
      console.warn('[home] block failed:', result.error);
      setItems([]);
      setState({ phase: 'error', itemCount: 0 });
      return;
    }

    setItems(result.data);
    setState({ phase: 'ready', itemCount: result.data.length });
  }, [load]);

  useEffect(() => {
    let cancelled = false;

    // The cancel guard stops a slow rail writing state after the screen is gone.
    (async () => {
      if (!cancelled) await run();
    })();

    return () => {
      cancelled = true;
    };
  }, [run]);

  return { items, state, reload: () => void run() };
}
