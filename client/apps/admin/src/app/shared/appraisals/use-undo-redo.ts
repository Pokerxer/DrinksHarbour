import { useCallback, useRef, useState } from 'react';

/**
 * Undo/redo state management hook.
 *
 * Maintains a history stack of past states and a future stack for redo.
 * Caps history at `maxHistory` entries to prevent memory bloat.
 */
export function useUndoRedo<T>(initial: T, maxHistory = 50) {
  const [state, setState] = useState(initial);
  const past = useRef<T[]>([]);
  const future = useRef<T[]>([]);

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setState((prev) => {
        const resolved =
          typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
        past.current = [...past.current.slice(-maxHistory + 1), prev];
        future.current = [];
        return resolved;
      });
    },
    [maxHistory]
  );

  const undo = useCallback(() => {
    if (past.current.length === 0) return;
    const prev = past.current[past.current.length - 1];
    past.current = past.current.slice(0, -1);
    setState((current) => {
      future.current = [...future.current, current];
      return prev;
    });
  }, []);

  const redo = useCallback(() => {
    if (future.current.length === 0) return;
    const next = future.current[future.current.length - 1];
    future.current = future.current.slice(0, -1);
    setState((current) => {
      past.current = [...past.current, current];
      return next;
    });
  }, []);

  const canUndo = past.current.length > 0;
  const canRedo = future.current.length > 0;

  return { state, set, undo, redo, canUndo, canRedo };
}
