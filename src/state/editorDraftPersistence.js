import { DEFAULT_SPLIT_PATTERN, ITEM_TYPES } from "../domain.js";

const EDITOR_DRAFT_KEY = "linememo-lite-card-editor-draft";
const boundRoots = new WeakSet();

function canStore() {
  return typeof localStorage !== "undefined";
}

function defaultDraft() {
  return {
    title: "",
    tabId: "inbox",
    tags: "",
    description: "",
    quickValues: "",
    quickSplitMode: "line",
    quickSplitPattern: DEFAULT_SPLIT_PATTERN,
    quickExpiresAt: ""
  };
}

function normalizeDraft(draft = {}) {
  return {
    ...defaultDraft(),
    title: String(draft.title || ""),
    tabId: String(draft.tabId || "inbox"),
    tags: String(draft.tags || ""),
    description: String(draft.description || ""),
    quickValues: String(draft.quickValues || ""),
    quickSplitMode: draft.quickSplitMode === "pattern" ? "pattern" : "line",
    quickSplitPattern: String(draft.quickSplitPattern || DEFAULT_SPLIT_PATTERN),
    quickExpiresAt: String(draft.quickExpiresAt || "")
  };
}

function normalizeItems(items = []) {
  return Array.isArray(items)
    ? items.map((item, index) => ({
      id: String(item?.id || `draft-line-${index}`),
      label: String(item?.label || ""),
      value: String(item?.value || ""),
      group: String(item?.group || ""),
      type: ITEM_TYPES.includes(item?.type) ? item.type : "text",
      secret: Boolean(item?.secret),
      expiresAt: String(item?.expiresAt || ""),
      order: Number.isFinite(Number(item?.order)) ? Number(item.order) : index + 1,
      createdAt: String(item?.createdAt || ""),
      updatedAt: String(item?.updatedAt || "")
    }))
    : [];
}

function hasContent(draft, items) {
  const values = [draft.title, draft.tags, draft.description, draft.quickValues, draft.quickSplitMode === "pattern" ? draft.quickSplitPattern : ""];
  return values.some((value) => String(value || "").trim())
    || items.some((item) => String(item.label || item.value || item.group || item.expiresAt || "").trim() || item.secret);
}

function setStoredSnapshot(snapshot) {
  if (!canStore()) return;
  try {
    if (snapshot) localStorage.setItem(EDITOR_DRAFT_KEY, JSON.stringify(snapshot));
    else localStorage.removeItem(EDITOR_DRAFT_KEY);
  } catch {
    // Storage can be unavailable in restricted WebView states.
  }
}

function readStoredSnapshot() {
  if (!canStore()) return null;
  try {
    const raw = localStorage.getItem(EDITOR_DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    setStoredSnapshot(null);
    return null;
  }
}

function currentSnapshot(state) {
  return state.data?.settings?.cardEditorDraftSnapshot || readStoredSnapshot();
}

function snapshotIsRestorable(state, snapshot) {
  if (!state.data?.settings?.cardDraftAutosave || !snapshot) return false;
  const cardId = String(snapshot?.cardId || "");
  if (!cardId) return false;
  if (cardId !== "new" && !state.data.cards.some((card) => card.id === cardId)) return false;
  const draft = normalizeDraft(snapshot.draft);
  const items = normalizeItems(snapshot.items);
  return cardId !== "new" || hasContent(draft, items);
}

export function clearEditorDraftSnapshot(state) {
  if (state?.data?.settings) delete state.data.settings.cardEditorDraftSnapshot;
  setStoredSnapshot(null);
}

export function hasEditorDraftSnapshot(state) {
  return snapshotIsRestorable(state, currentSnapshot(state));
}

export function saveEditorDraftSnapshot(state) {
  if (!state.data?.settings?.cardDraftAutosave || !state.editingCardId || !state.editorDraft) {
    clearEditorDraftSnapshot(state);
    return false;
  }
  const draft = normalizeDraft(state.editorDraft);
  const items = normalizeItems(state.editorItems);
  if (state.editingCardId === "new" && !hasContent(draft, items)) {
    clearEditorDraftSnapshot(state);
    return false;
  }
  const snapshot = {
    version: 1,
    cardId: state.editingCardId,
    draft,
    items,
    savedAt: new Date().toISOString()
  };
  state.data.settings.cardEditorDraftSnapshot = snapshot;
  setStoredSnapshot(snapshot);
  return true;
}

export function restoreEditorDraft(state) {
  if (!state.data?.settings?.cardDraftAutosave) {
    clearEditorDraftSnapshot(state);
    return false;
  }
  const snapshot = currentSnapshot(state);
  try {
    if (!snapshotIsRestorable(state, snapshot)) return false;
    const cardId = String(snapshot?.cardId || "");
    const draft = normalizeDraft(snapshot.draft);
    const items = normalizeItems(snapshot.items);
    state.editingCardId = cardId;
    state.activePanel = "editor";
    state.editorDraft = draft;
    state.editorItems = items;
    return true;
  } catch {
    clearEditorDraftSnapshot(state);
    return false;
  }
}

export function bindEditorDraftPersistence(root, { state, syncEditorDraft, scheduleDraftSave }) {
  if (!root || boundRoots.has(root)) return;
  boundRoots.add(root);
  const persist = () => {
    if (state.editingCardId) syncEditorDraft();
    if (saveEditorDraftSnapshot(state)) scheduleDraftSave?.();
  };
  const persistSoon = () => queueMicrotask(persist);
  root.addEventListener("input", (event) => {
    if (event.target.closest?.("#card-form")) persistSoon();
  });
  root.addEventListener("change", (event) => {
    if (event.target.closest?.("#card-form") || event.target.dataset.setting === "cardDraftAutosave") persistSoon();
  });
  root.addEventListener("click", (event) => {
    const action = event.target.closest?.("[data-action]")?.dataset.action;
    if (["add-line", "line-up", "line-down", "line-delete", "delete-confirm-now", "delete-confirm-skip", "parse-paste", "close-editor"].includes(action)) {
      setTimeout(persist, 0);
    }
  });
  window.addEventListener("beforeunload", () => {
    persist();
    scheduleDraftSave?.({ immediate: true });
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") persist();
  });
}
