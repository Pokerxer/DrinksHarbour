import { useCallback, useMemo, useReducer } from 'react';

/**
 * Undo/redo state management hook.
 *
 * The whole history lives in ONE reducer state, not in refs mutated from
 * inside a `setState` updater. That is the correctness point, not a style
 * preference: React may invoke an updater more than once for a single edit
 * (StrictMode's development double-invoke, and any render React chooses to
 * replay), and the previous form pushed onto `past` from inside the updater
 * — so one edit recorded two history entries and the first Cmd+Z appeared to
 * do nothing. A reducer transition is pure and is applied exactly once per
 * dispatch.
 *
 * It also makes `canUndo`/`canRedo` honest. Read off refs they were derived
 * during render from a value whose mutation does not schedule one, so the
 * buttons could stay enabled (or disabled) until something else re-rendered
 * the editor.
 *
 * History is capped at `maxHistory` entries, oldest dropped first.
 */
export interface History<T> {
  past: T[];
  present: T;
  future: T[];
}

export type Action<T> =
  | { type: 'set'; next: T | ((prev: T) => T); maxHistory: number }
  | { type: 'reset'; next: T }
  | { type: 'undo' }
  | { type: 'redo' };

/**
 * Exported for tests. The hook itself needs a DOM to exercise and this suite
 * runs on `environment: 'node'`, but every rule worth pinning — the cap, the
 * cleared redo branch, reset discarding history, idempotent sets — is a
 * property of this pure transition, so testing it here tests the behaviour.
 */
export function reducer<T>(state: History<T>, action: Action<T>): History<T> {
  switch (action.type) {
    case 'set': {
      const resolved =
        typeof action.next === 'function'
          ? (action.next as (prev: T) => T)(state.present)
          : action.next;
      // An update that resolves to the identical reference is not an edit —
      // recording it would cost a Cmd+Z that visibly does nothing.
      if (Object.is(resolved, state.present)) return state;
      const past = [...state.past, state.present].slice(-action.maxHistory);
      return { past, present: resolved, future: [] };
    }
    // Seeds a new baseline and DISCARDS the history, for loading a document
    // into an editor that was already showing something. Routing that through
    // `set` makes the blank starting draft an undoable state, so the first
    // Cmd+Z after opening a saved form replaces it with an empty one.
    case 'reset':
      return { past: [], present: action.next, future: [] };
    case 'undo': {
      if (state.past.length === 0) return state;
      return {
        past: state.past.slice(0, -1),
        present: state.past[state.past.length - 1],
        future: [state.present, ...state.future],
      };
    }
    case 'redo': {
      if (state.future.length === 0) return state;
      return {
        past: [...state.past, state.present],
        present: state.future[0],
        future: state.future.slice(1),
      };
    }
    default:
      return state;
  }
}

export function useUndoRedo<T>(initial: T, maxHistory = 50) {
  const [history, dispatch] = useReducer(reducer<T>, {
    past: [],
    present: initial,
    future: [],
  });

  const set = useCallback(
    (next: T | ((prev: T) => T)) => dispatch({ type: 'set', next, maxHistory }),
    [maxHistory]
  );
  const reset = useCallback((next: T) => dispatch({ type: 'reset', next }), []);
  const undo = useCallback(() => dispatch({ type: 'undo' }), []);
  const redo = useCallback(() => dispatch({ type: 'redo' }), []);

  return useMemo(
    () => ({
      state: history.present,
      set,
      reset,
      undo,
      redo,
      canUndo: history.past.length > 0,
      canRedo: history.future.length > 0,
    }),
    [history, set, reset, undo, redo]
  );
}
