// localStorage helpers for finished-game results and in-progress state.
// Everything stays on this device. Keys are namespaced per app.

const RESULTS_KEY = "tsk.finishedGames.v1";
const DRAFT_KEY = "tsk.currentGame.v1";

export function loadResults(storage = globalThis.localStorage) {
  try {
    const raw = storage.getItem(RESULTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveResult(result, storage = globalThis.localStorage) {
  const results = loadResults(storage);
  results.unshift(result);
  // Cap the list so storage never grows forever.
  const capped = results.slice(0, 100);
  try {
    storage.setItem(RESULTS_KEY, JSON.stringify(capped));
  } catch {
    // Storage full or blocked — losing a save beats crashing the app.
  }
  return capped;
}

export function clearResults(storage = globalThis.localStorage) {
  try {
    storage.removeItem(RESULTS_KEY);
  } catch {
    /* ignore */
  }
}

export function loadDraft(storage = globalThis.localStorage) {
  try {
    const raw = storage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveDraft(draft, storage = globalThis.localStorage) {
  try {
    if (draft === null) storage.removeItem(DRAFT_KEY);
    else storage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* ignore */
  }
}
