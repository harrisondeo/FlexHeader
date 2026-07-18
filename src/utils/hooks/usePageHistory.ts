import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { saveToStorage, loadFromStorage } from "../storage/storage";
import { UNDO_STACK_KEY, REDO_STACK_KEY } from "../../constants";
import { reconcileHistoryAfterMerge, type PageTombstone } from "../domain/pageMerge";
import type { Page, PagesData } from "../domain/schemas";
import { log } from "../log";

// How long an edit burst (e.g. a run of keystrokes) can pause before the next
// change starts a new undo step, so backspacing through a whole value only
// costs one undo instead of one per character.
const HISTORY_DEBOUNCE_MS = 500;
const MAX_HISTORY_ENTRIES = 50;

interface UsePageHistoryParams {
  enabled: boolean;
  pagesData: PagesData;
  setPagesData: Dispatch<SetStateAction<PagesData>>;
  hasInitialized: boolean;
}

/**
 * Owns the undo/redo stacks for `pagesData` - recording pre-change snapshots,
 * replaying them, persisting them across popup close, and reconciling them
 * against a background sync merge. Extracted out of useFlexHeaderSettings so
 * that hook stays focused on settings persistence; this one owns page-state
 * history specifically.
 */
function usePageHistory({ enabled, pagesData, setPagesData, hasInitialized }: UsePageHistoryParams) {
  const [undoStack, setUndoStack] = useState<PagesData[]>([]);
  const [redoStack, setRedoStack] = useState<PagesData[]>([]);
  const historyBurstsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const clearPendingBursts = () => {
    historyBurstsRef.current.forEach((timer) => clearTimeout(timer));
    historyBurstsRef.current.clear();
  };

  /**
   * Records the pre-change snapshot onto the undo stack, clearing any redo
   * history (a new edit invalidates the old redo branch). Pass a
   * `debounceKey` for edits that fire on every keystroke (header/filter
   * value changes, page renames) - repeated calls with the same key within
   * HISTORY_DEBOUNCE_MS collapse into the single snapshot from the start of
   * the burst. Pass null for discrete one-shot actions (deletions), which
   * always record immediately.
   */
  const recordHistory = (debounceKey: string | null) => {
    if (!enabled) return;

    if (debounceKey) {
      const bursts = historyBurstsRef.current;
      const existingTimer = bursts.get(debounceKey);
      if (existingTimer) {
        clearTimeout(existingTimer);
        bursts.set(debounceKey, setTimeout(() => bursts.delete(debounceKey), HISTORY_DEBOUNCE_MS));
        return;
      }
      bursts.set(debounceKey, setTimeout(() => bursts.delete(debounceKey), HISTORY_DEBOUNCE_MS));
    }

    setUndoStack((prev) => [...prev, pagesData].slice(-MAX_HISTORY_ENTRIES));
    setRedoStack([]);
  };

  /**
   * A restored snapshot carries whatever `lastModified` its pages had back
   * when the snapshot was taken - older than the edit(s) being undone/redone.
   * Left as-is, a sync merge landing afterwards compares that stale
   * timestamp against the newer one still sitting in sync storage and picks
   * the newer side, silently reapplying the very edit the user just
   * undid (or re-discarding the one they just redid). Stamping a fresh
   * `lastModified` on whichever pages actually differ from the state being
   * moved away from makes undo/redo behave like any other edit for merge
   * purposes: the change just made locally is the newest one.
   */
  const stampChangedPages = (fromPages: Page[], toPages: Page[]): Page[] => {
    const stripModified = (page: Page) =>
      JSON.stringify(page, (key, value) => (key === "lastModified" ? undefined : value));
    const fromByKey = new Map(fromPages.map((p) => [p.pageId ?? p.id, p]));

    return toPages.map((page) => {
      const previousVersion = fromByKey.get(page.pageId ?? page.id);
      if (!previousVersion || stripModified(previousVersion) === stripModified(page)) {
        return page;
      }
      return { ...page, lastModified: Date.now() };
    });
  };

  const undo = () => {
    if (!enabled || undoStack.length === 0) return;
    clearPendingBursts();

    const previous = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, pagesData].slice(-MAX_HISTORY_ENTRIES));
    setPagesData({ ...previous, pages: stampChangedPages(pagesData.pages, previous.pages) });
  };

  const redo = () => {
    if (!enabled || redoStack.length === 0) return;
    clearPendingBursts();

    const next = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    setUndoStack((prev) => [...prev, pagesData].slice(-MAX_HISTORY_ENTRIES));
    setPagesData({ ...next, pages: stampChangedPages(pagesData.pages, next.pages) });
  };

  /** Drops pending debounce timers without touching the stacks themselves. */
  const resetHistory = () => {
    clearPendingBursts();
    setUndoStack([]);
    setRedoStack([]);
  };

  /** Restores persisted stacks from storage - the initial-mount load path only. */
  const loadPersistedHistory = async () => {
    try {
      const [savedUndoStack, savedRedoStack] = await Promise.all([
        loadFromStorage<PagesData[]>(UNDO_STACK_KEY, [], ['local']),
        loadFromStorage<PagesData[]>(REDO_STACK_KEY, [], ['local']),
      ]);
      setUndoStack(savedUndoStack);
      setRedoStack(savedRedoStack);
    } catch (error) {
      log("Failed to load undo/redo history", "error", error);
    }
  };

  /**
   * Drops only the stack entries a background sync merge actually
   * invalidated (see reconcileHistoryAfterMerge), instead of wiping
   * everything - the external-reload path.
   */
  const reconcileAfterMerge = (mergedPages: Page[], tombstones: PageTombstone[]) => {
    setUndoStack((prev) => reconcileHistoryAfterMerge(prev, mergedPages, tombstones));
    setRedoStack((prev) => reconcileHistoryAfterMerge(prev, mergedPages, tombstones));
  };

  useEffect(() => {
    const bursts = historyBurstsRef.current;
    return () => {
      bursts.forEach((timer) => clearTimeout(timer));
      bursts.clear();
    };
  }, []);

  // Persist undo/redo history so it survives the popup closing (its state
  // would otherwise live only in memory and vanish on reopen). Gated on
  // hasInitialized so the empty initial stacks don't overwrite what's
  // already in storage before it's been restored.
  useEffect(() => {
    if (!hasInitialized) return;
    saveToStorage(UNDO_STACK_KEY, undoStack, 'local').catch((error) => {
      log("Failed to persist undo history", "error", error);
    });
  }, [undoStack, hasInitialized]);

  useEffect(() => {
    if (!hasInitialized) return;
    saveToStorage(REDO_STACK_KEY, redoStack, 'local').catch((error) => {
      log("Failed to persist redo history", "error", error);
    });
  }, [redoStack, hasInitialized]);

  return {
    recordHistory,
    undo,
    redo,
    canUndo: enabled && undoStack.length > 0,
    canRedo: enabled && redoStack.length > 0,
    resetHistory,
    clearPendingBursts,
    loadPersistedHistory,
    reconcileAfterMerge,
  };
}

export default usePageHistory;
