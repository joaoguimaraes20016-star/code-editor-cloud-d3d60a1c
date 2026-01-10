import { useState, useCallback, useEffect, useRef } from 'react';
import { Page } from '../../types/infostack';
import { deepClone } from '../utils/helpers';

interface HistoryEntry {
  page: Page;
  actionLabel?: string;
}

interface HistoryState {
  past: HistoryEntry[];
  present: HistoryEntry;
  future: HistoryEntry[];
}

interface UseHistoryReturn {
  page: Page;
  setPage: (page: Page, skipHistory?: boolean, actionLabel?: string) => void;
  undo: () => { actionLabel?: string } | null;
  redo: () => { actionLabel?: string } | null;
  canUndo: boolean;
  canRedo: boolean;
  reset: (page: Page) => void;
  clearHistory: () => void;
}

const MAX_HISTORY_LENGTH = 50;
const STORAGE_KEY = 'infostack_history';

// Debounce helper
function debounce<T extends (...args: unknown[]) => void>(fn: T, ms: number) {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), ms);
  };
}

export function useHistory(initialState: Page): UseHistoryReturn {
  const [history, setHistory] = useState<HistoryState>(() => {
    // Try to load from localStorage on initial mount
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_${initialState.id}`);
      if (saved) {
        const parsed = JSON.parse(saved) as HistoryState;
        // Only restore if page IDs match and present is valid
        if (parsed.present?.page?.id === initialState.id) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Could not load history from localStorage:', e);
    }
    // If no valid saved state, use initialState
    return {
      past: [],
      present: { page: deepClone(initialState), actionLabel: 'Initial state' },
      future: [],
    };
  });

  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  // Debounced save to localStorage
  const saveToLocalStorage = useRef(
    debounce((historyState: HistoryState) => {
      try {
        localStorage.setItem(
          `${STORAGE_KEY}_${historyState.present.page.id}`,
          JSON.stringify(historyState)
        );
      } catch (e) {
        console.warn('Could not save history to localStorage:', e);
      }
    }, 500)
  ).current;

  // Save to localStorage whenever history changes
  useEffect(() => {
    saveToLocalStorage(history);
  }, [history, saveToLocalStorage]);

  const setPage = useCallback((newPage: Page, skipHistory = false, actionLabel?: string) => {
    setHistory((prev) => {
      if (skipHistory) {
        return {
          ...prev,
          present: { page: deepClone(newPage), actionLabel: prev.present.actionLabel },
        };
      }

      const newPast = [...prev.past, { ...prev.present }];
      // Limit history length
      if (newPast.length > MAX_HISTORY_LENGTH) {
        newPast.shift();
      }

      return {
        past: newPast,
        present: { page: deepClone(newPage), actionLabel: actionLabel || 'Change' },
        future: [], // Clear future on new action
      };
    });
  }, []);

  const undo = useCallback(() => {
    let undoneAction: { actionLabel?: string } | null = null;
    
    setHistory((prev) => {
      if (prev.past.length === 0) return prev;

      const newPast = [...prev.past];
      const previous = newPast.pop()!;
      
      // Store the action that was undone (current state's action)
      undoneAction = { actionLabel: prev.present.actionLabel };

      return {
        past: newPast,
        present: previous,
        future: [{ ...prev.present }, ...prev.future],
      };
    });
    
    return undoneAction;
  }, []);

  const redo = useCallback(() => {
    let redoneAction: { actionLabel?: string } | null = null;
    
    setHistory((prev) => {
      if (prev.future.length === 0) return prev;

      const newFuture = [...prev.future];
      const next = newFuture.shift()!;
      
      // Store the action that was redone
      redoneAction = { actionLabel: next.actionLabel };

      return {
        past: [...prev.past, { ...prev.present }],
        present: next,
        future: newFuture,
      };
    });
    
    return redoneAction;
  }, []);

  const reset = useCallback((newPage: Page) => {
    setHistory({
      past: [],
      present: { page: deepClone(newPage), actionLabel: 'Reset' },
      future: [],
    });
  }, []);

  const clearHistory = useCallback(() => {
    try {
      localStorage.removeItem(`${STORAGE_KEY}_${history.present.page.id}`);
    } catch (e) {
      console.warn('Could not clear history from localStorage:', e);
    }
    setHistory((prev) => ({
      past: [],
      present: prev.present,
      future: [],
    }));
  }, [history.present.page.id]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      if (modifier && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (modifier && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        redo();
      } else if (modifier && e.key === 'y') {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  return {
    page: history.present.page,
    setPage,
    undo,
    redo,
    canUndo,
    canRedo,
    reset,
    clearHistory,
  };
}