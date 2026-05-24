import { writeText, readText } from "@tauri-apps/plugin-clipboard-manager";
import "./styles.css";
import { createRenderers } from "./ui/renderers.js";
import { icon } from "./ui/icons.js";
import { bindQuickPastePreview } from "./ui/quickPastePreview.js";
import { applyAppearanceSettings } from "./ui/appearance.js";
import { escapeHtml } from "./ui/utils.js";
import { cellKey } from "./ui/editableCell.js";
import { createBackupActions } from "./actions/backupActions.js";
import { createCopyActions } from "./actions/copyActions.js";
import { createDeleteConfirmActions } from "./actions/deleteConfirmActions.js";
import { syncDesktopPreferencesForState } from "./actions/desktopIntegration.js";
import { createDuplicateActions } from "./actions/duplicates.js";
import { createLineMoveActions } from "./actions/lineMoveActions.js";
import { bindLineContextMenuActions } from "./actions/lineContextMenuActions.js";
import { bindLockForms, createLockActions } from "./actions/lockActions.js";
import { bindManagerControls } from "./actions/managerControls.js";
import { createQuickInputActions } from "./actions/quickInputActions.js";
import { createQuickLineActions } from "./actions/quickLineActions.js";
import { createSplitPatternActions } from "./actions/splitPatternActions.js";
import { bindRootActions } from "./actions/rootEvents.js";
import { bindKeyboardShortcuts } from "./actions/shortcuts.js";
import { createSelectionActions } from "./actions/selectionActions.js";
import { createTagActions } from "./actions/tagActions.js";
import { bindTagSuggestionActions } from "./actions/tagSuggestionActions.js";
import { createUiActionHandler } from "./actions/uiActions.js";
import { createViewActions } from "./actions/viewActions.js";
import { ITEM_TYPES, DEFAULT_SPLIT_PATTERN, applyExpiryToItems, allTags, copyTextForItems, formatTags, inferType, makeCard, mergeLineTimestamps, normalizeData, normalizeDateOnly, normalizeLineValueInput, nowIso, parsePasteItems, parseTags, stampLine, sortedItems, uid } from "./domain.js";
import { createExpiryNotificationScheduler } from "./notifications/expiryNotifications.js";
import { cardPayloadHasChanges, lineEditHasChanges } from "./saveDiff.js";
import { applyDesktopPreferences, getStoragePathStatus, loadData, saveData } from "./storage.js";
import { clearQuickDraft, clearQuickLineDraft, clearTableAddDraft, createEmptyDrafts, syncDraftField } from "./state/drafts.js";
import { bindEditorDraftPersistence, clearEditorDraftSnapshot, hasEditorDraftSnapshot, restoreEditorDraft } from "./state/editorDraftPersistence.js";
import { defaultTabId, syncActiveTabs } from "./state/tabs.js";
const app = document.querySelector("#app");
const state = {
  data: normalizeData(null),
  activeTabId: "inbox",
  activeTabIds: ["inbox"],
  lastRealTabId: "inbox",
  query: "",
  selected: new Set(),
  revealed: new Set(),
  expandedCards: new Set(),
  collapsedCards: new Set(),
  activePanel: null,
  editingCardId: null,
  editorDraft: null,
  editingLineKey: null,
  lineEditDraft: null,
  editingCellKey: null,
  cellEditValue: "",
  editorItems: [],
  toast: "",
  lastCopiedKey: "",
  dataPath: "", storagePath: null,
  lastCopiedText: "",
  denseMode: localStorage.getItem("linememo-dense-mode") !== "false",
  viewMode: localStorage.getItem("linememo-view-mode") || "cards",
  showTableAdd: false,
  activeQuickLineCardId: "",
  tableSortAsc: true,
  duplicateConflict: null,
  deleteConfirm: null,
  deleteConfirmMutedUntil: 0,
  lineContextMenu: null,
  movingLineKey: null,
  lineMoveDraft: null,
  desktopIntegration: { available: false, minimizeToTray: false, launchOnStartup: false, error: "" },
  managerPages: { tabs: 1, tags: 1 },
  managerFilters: { tabQuery: "", tabVisibility: "all", tabSort: "order", tagQuery: "", tagSort: "name" },
  drafts: createEmptyDrafts(),
  lock: { locked: false, reason: "", unlockError: "", lastActivityAt: Date.now() }
};

const MANAGER_PAGE_SIZE = 12;
let render = () => {};
let renderTagPreview = () => "";
let resolveDuplicatesBeforeAdd = () => false;
let focusDuplicate = () => {};
let commitDuplicatePending = () => {};
let selectedItemsInView = () => [];
let copySelectedInView = async () => {};
let clearSelection = () => {};
let groupSelectedInView = () => false;
let copyText = async () => {};
let setViewMode = () => {};
let focusTableAdd = () => {};
let selectManagerTag = () => {};
let toggleTagQuery = () => {};
let renameTag = () => {};
let deleteTag = () => {};
let handleImport = async () => {}, handleExport = async () => {}, handleDataPathChange = async () => {}, handleDataPathReset = async () => {};
let lockApp = () => false, unlockApp = async () => false, setLockPassword = async () => false;
let changeLockPassword = async () => false, removeLockPassword = async () => false;
let lockOnBoot = () => {}, touchLockActivity = () => {}, bindLockActivityTracking = () => {};
let quickPaste = () => {}, quickAddLineFromForm = () => {}, copySplitPattern = async () => {}, insertSplitPattern = () => {}, startLineMove = () => {}, updateLineMoveTarget = () => {}, updateLineMoveQuery = () => {};
let cancelLineMove = () => {}, confirmLineMove = () => {};
let requestDeleteConfirm = (_message, onConfirm) => onConfirm?.(), cancelDeleteConfirm = () => {}, confirmPendingDelete = () => {};
let syncExpiryNotificationSchedule = () => {}, checkExpiryNotifications = async () => {};

let saveTimer = null, draftSaveTimer = null;
let revealTimers = new Map();
let toastTimer = null;
let isComposingSearch = false;
let searchRenderTimer = null;

async function syncDesktopPreferences({ silent = true } = {}) {
  return syncDesktopPreferencesForState({ state, applyDesktopPreferences, scheduleSave, render: () => render(), notify }, { silent });
}

async function boot() {
  state.data = await loadData();
  applyAppearanceSettings(state.data.settings);
  const remembered = state.data.settings.rememberLastTab ? state.data.settings.lastTabId || "inbox" : "inbox";
  syncActiveTabs(state, remembered, { single: true });
  state.storagePath = await getStoragePathStatus(); state.dataPath = state.storagePath.path;
  await syncDesktopPreferences();
  lockOnBoot();
  render();
  syncExpiryNotificationSchedule({ immediate: true });
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    state.data = await saveData(state.data);
    render();
  }, 350);
}

function scheduleDraftSave(options = {}) { clearTimeout(draftSaveTimer); const persist = () => saveData(state.data).catch(() => {}); if (options.immediate) persist(); else draftSaveTimer = setTimeout(persist, 120); }

function notify(message) {
  state.toast = message;
  clearTimeout(toastTimer);
  render();
  toastTimer = setTimeout(() => {
    state.toast = "";
    render();
  }, 1400);
}

({ sync: syncExpiryNotificationSchedule, runNow: checkExpiryNotifications } = createExpiryNotificationScheduler({ state, notify, scheduleSave }));

function confirmSave(message = "변경사항을 저장하시겠습니까?") { return !state.data.settings.confirmBeforeSave || confirm(message); }

function scheduleSearchRender() {
  clearTimeout(searchRenderTimer);
  searchRenderTimer = setTimeout(() => {
    searchRenderTimer = null;
    render();
    queueMicrotask(() => {
      const search = document.querySelector("#search");
      search?.focus();
      search?.setSelectionRange?.(search.value.length, search.value.length);
    });
  }, 25);
}

function setActiveTab(id, options = {}) {
  syncActiveTabs(state, id, options);
  state.selected.clear();
  if (options.closePanel) state.activePanel = null;
  if (state.data.settings.rememberLastTab) {
    state.data.settings.lastTabId = state.activeTabId === "all" ? "all" : defaultTabId(state);
    scheduleSave();
  }
  render();
}

function selectManagerTab(id) {
  setActiveTab(id, { single: true, closePanel: true });
}

function openPanel(panel) {
  const nextPanel = state.activePanel === panel ? null : panel;
  state.activePanel = nextPanel;
  if (nextPanel === "tabs") clampManagerPage("tabs", state.data.tabs.length);
  if (nextPanel === "tags") clampManagerPage("tags", tagStats().length);
  if (panel !== "editor") closeEditor(false);
  render();
}

function pageCountFor(total) {
  return Math.max(1, Math.ceil(total / MANAGER_PAGE_SIZE));
}

function clampManagerPage(kind, total) {
  const pageCount = pageCountFor(total);
  const current = Number(state.managerPages[kind] || 1);
  const page = Math.min(Math.max(1, current), pageCount);
  state.managerPages[kind] = page;
  return {
    page,
    pageCount,
    start: (page - 1) * MANAGER_PAGE_SIZE,
    end: page * MANAGER_PAGE_SIZE
  };
}

function moveManagerPage(kind, direction, total) {
  const pageState = clampManagerPage(kind, total);
  state.managerPages[kind] = Math.min(Math.max(1, pageState.page + direction), pageState.pageCount);
  render();
}

function renderManagerPager(kind, total) {
  const pageState = clampManagerPage(kind, total);
  if (pageState.pageCount <= 1) return "";
  return `
    <div class="manager-pager">
      <button type="button" data-action="manager-page" data-kind="${kind}" data-total="${total}" data-direction="-1" ${pageState.page <= 1 ? "disabled" : ""} title="이전 페이지" aria-label="이전 페이지">${icon("chevronLeft")}</button>
      <span>${pageState.page} / ${pageState.pageCount}</span>
      <button type="button" data-action="manager-page" data-kind="${kind}" data-total="${total}" data-direction="1" ${pageState.page >= pageState.pageCount ? "disabled" : ""} title="다음 페이지" aria-label="다음 페이지">${icon("chevronRight")}</button>
    </div>
  `;
}

function createTab() {
  const name = prompt("새 탭 이름");
  if (!name?.trim()) return;
  state.data.tabs.push({ id: uid("tab"), name: name.trim(), order: state.data.tabs.length, system: false });
  state.managerPages.tabs = pageCountFor(state.data.tabs.length);
  scheduleSave();
  render();
}

function renameTab(id) {
  const tab = state.data.tabs.find((entry) => entry.id === id);
  if (!tab || tab.system) return;
  const name = prompt("탭 이름", tab.name);
  if (!name?.trim()) return;
  tab.name = name.trim();
  scheduleSave();
  render();
}

function deleteTab(id) {
  const tab = state.data.tabs.find((entry) => entry.id === id);
  if (!tab || tab.system) return;
  const affectedCards = state.data.cards.filter((card) => card.tabId === id).length;
  requestDeleteConfirm(`'${tab.name}' 탭을 삭제할까요?`, () => {
    state.data.cards.forEach((card) => {
      if (card.tabId === id) card.tabId = "inbox";
    });
    state.data.tabs = state.data.tabs.filter((entry) => entry.id !== id).map((entry, index) => ({ ...entry, order: index }));
    syncActiveTabs(state, "inbox", { single: true });
    clampManagerPage("tabs", state.data.tabs.length);
    scheduleSave();
    render();
  }, { detail: `${affectedCards}개 카드가 Inbox로 이동됩니다.` });
}

function moveTab(id, direction) {
  const tabs = state.data.tabs;
  const index = tabs.findIndex((tab) => tab.id === id);
  const target = index + direction;
  if (index < 0 || target < 1 || target >= tabs.length) return;
  if (tabs[index].system || tabs[target].id === "all") return;
  [tabs[index], tabs[target]] = [tabs[target], tabs[index]];
  state.data.tabs = tabs.map((tab, order) => ({ ...tab, order }));
  scheduleSave();
  render();
}

function tabStats(tabId) {
  const cards = tabId === "all" ? state.data.cards : state.data.cards.filter((card) => card.tabId === tabId);
  return {
    cards: cards.length,
    items: cards.reduce((sum, card) => sum + sortedItems(card.items).filter((item) => item.type !== "divider").length, 0)
  };
}

function tagStats() {
  return allTags(state.data).map((tag) => {
    const cards = state.data.cards.filter((card) => parseTags(card.tags).includes(tag));
    return {
      tag,
      cards: cards.length,
      items: cards.reduce((sum, card) => sum + sortedItems(card.items).filter((item) => item.type !== "divider").length, 0)
    };
  });
}

function startNewCard() {
  if (hasEditorDraftSnapshot(state)) {
    const loadDraft = confirm("작성 중이던 카드 초안이 있습니다.\n불러올까요?\n\n취소하면 이전 초안을 지우고 새 카드로 시작합니다.");
    if (loadDraft && restoreEditorDraft(state)) { render(); queueMicrotask(() => document.querySelector("#card-title")?.focus()); return; }
    clearEditorDraftSnapshot(state); scheduleDraftSave({ immediate: true });
  }
  state.editingCardId = "new"; state.activePanel = "editor";
  state.editorDraft = { title: "", tabId: defaultTabId(state), tags: "", description: "", quickValues: "", quickSplitMode: "line", quickSplitPattern: DEFAULT_SPLIT_PATTERN, quickExpiresAt: "" };
  state.editorItems = []; render(); queueMicrotask(() => document.querySelector("#card-title")?.focus());
}

function startEditCard(cardId) {
  const card = state.data.cards.find((entry) => entry.id === cardId);
  if (!card) return;
  state.editingCardId = cardId;
  state.activePanel = "editor";
  state.editorDraft = {
    title: card.title,
    tabId: card.tabId,
    tags: formatTags(card.tags),
    description: card.description,
    quickValues: "",
    quickSplitMode: "line",
    quickSplitPattern: DEFAULT_SPLIT_PATTERN,
    quickExpiresAt: ""
  };
  state.editorItems = sortedItems(card.items).map((item) => ({ ...item }));
  render();
}

function closeEditor(shouldRender = true) {
  clearEditorDraftSnapshot(state);
  scheduleDraftSave({ immediate: true });
  state.editingCardId = null;
  state.editorDraft = null;
  state.editorItems = [];
  if (state.activePanel === "editor") state.activePanel = null;
  if (shouldRender) render();
}

function pasteToEditor(text) {
  syncEditorDraft();
  state.editorItems = parsePasteItems(text, {
    splitMode: state.editorDraft?.quickSplitMode,
    splitPattern: state.editorDraft?.quickSplitPattern
  });
  render();
}

function addEditorLine() {
  syncEditorDraft();
  state.editorItems.push(stampLine({
    id: uid("line"),
    label: "",
    value: "",
    type: "text",
    secret: false,
    expiresAt: "",
    order: state.editorItems.length + 1
  }));
  render();
}

function updateEditorLine(id, patch) {
  state.editorItems = state.editorItems.map((item) => (item.id === id ? { ...item, ...patch } : item));
}

function deleteEditorLine(id) {
  syncEditorDraft();
  requestDeleteConfirm("이 줄을 삭제할까요?", () => {
    state.editorItems = state.editorItems.filter((item) => item.id !== id).map((item, index) => ({ ...item, order: index + 1 }));
    render();
  });
}

function moveEditorLine(id, direction) {
  syncEditorDraft();
  const index = state.editorItems.findIndex((item) => item.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= state.editorItems.length) return;
  [state.editorItems[index], state.editorItems[target]] = [state.editorItems[target], state.editorItems[index]];
  state.editorItems = state.editorItems.map((item, order) => ({ ...item, order: order + 1 }));
  render();
}

function syncEditorDraft() {
  const form = document.querySelector("#card-form");
  if (!form) return;
  const formData = new FormData(form);
  state.editorDraft = {
    title: String(formData.get("title") || ""),
    tabId: String(formData.get("tabId") || "inbox"),
    tags: String(formData.get("tags") || ""),
    description: String(formData.get("description") || ""),
    quickValues: String(formData.get("quickValues") || ""),
    quickSplitMode: String(formData.get("quickSplitMode") || "line"),
    quickSplitPattern: String(formData.get("quickSplitPattern") || DEFAULT_SPLIT_PATTERN),
    quickExpiresAt: normalizeDateOnly(formData.get("quickExpiresAt"))
  };
}

function saveEditor(form) {
  syncEditorDraft();
  const formData = new FormData(form);
  const quickValues = String(formData.get("quickValues") || "");
  const quickItems = applyExpiryToItems(parsePasteItems(quickValues, {
    splitMode: formData.get("quickSplitMode"),
    splitPattern: formData.get("quickSplitPattern")
  }), formData.get("quickExpiresAt"));
  const items = state.editorItems
    .map((item, index) => ({ ...item, order: index + 1, value: item.type === "divider" ? "---" : item.value, expiresAt: item.type === "divider" ? "" : normalizeDateOnly(item.expiresAt) }))
    .filter((item) => item.type === "divider" || item.value.trim() || item.label.trim());
  const mergedItems = items.length ? items : quickItems;
  const payload = {
    title: String(formData.get("title") || "").trim() || firstMeaningfulLine(mergedItems) || "새 카드",
    tabId: formData.get("tabId"),
    description: formData.get("description"),
    tags: parseTags(formData.get("tags")),
    items: mergedItems
  };

  if (state.editingCardId === "new") {
    if (resolveDuplicatesBeforeAdd(payload.items, { type: "new-card", payload })) return;
    const card = makeCard(payload);
    state.data.cards.unshift(card);
    state.expandedCards.add(card.id);
    state.collapsedCards.delete(card.id);
  } else {
    const card = state.data.cards.find((entry) => entry.id === state.editingCardId);
    if (card) {
      if (!cardPayloadHasChanges(card, payload)) { closeEditor(false); notify("변경 없음"); render(); return; }
      if (!confirmSave()) return;
      const time = nowIso();
      Object.assign(card, payload, { items: mergeLineTimestamps(payload.items, card.items, time), updatedAt: time });
    }
  }
  closeEditor(false);
  scheduleSave();
  notify("저장됨");
}

function clearDraftForPending(pending) {
  if (pending?.type === "quick-paste") clearQuickDraft(state);
  if (pending?.type === "quick-lines") clearQuickDraft(state);
  if (pending?.type === "quick-line" && pending.draftKind === "table") clearTableAddDraft(state, pending.draftCardId);
  if (pending?.type === "quick-line" && pending.draftKind === "quickLine") clearQuickLineDraft(state, pending.draftCardId);
}

function firstMeaningfulLine(items) {
  return sortedItems(items).find((item) => item.type !== "divider")?.value.slice(0, 42);
}

function startLineEdit(cardId, lineId) {
  const card = state.data.cards.find((entry) => entry.id === cardId);
  const item = card?.items.find((line) => line.id === lineId);
  if (!card || !item || item.type === "divider") return;
  state.editingLineKey = `${cardId}:${lineId}`;
  state.activePanel = "line-editor";
  state.lineEditDraft = {
    label: item.label,
    value: item.value,
    group: item.group || "",
    type: item.type,
    secret: item.secret,
    expiresAt: item.expiresAt || ""
  };
  render();
  queueMicrotask(() => document.querySelector("[data-line-edit-value]")?.focus());
}

function startCellEdit(cardId, lineId, field) {
  const card = state.data.cards.find((entry) => entry.id === cardId);
  const item = lineId ? card?.items.find((line) => line.id === lineId) : null;
  if (!card) return;
  let value = "";
  if (field === "title") value = card.title;
  else if (field === "tabId") value = card.tabId;
  else if (item && field === "label") value = item.label || "";
  else if (item && field === "value") value = item.value || "";
  else return;
  state.editingCellKey = cellKey(cardId, lineId, field);
  state.cellEditValue = value;
  state.editingLineKey = null;
  state.lineEditDraft = null;
  render();
  queueMicrotask(() => {
    const input = document.querySelector("[data-cell-edit-input]");
    input?.focus();
    if (input?.select) input.select();
  });
}

function cancelCellEdit() {
  state.editingCellKey = null;
  state.cellEditValue = "";
  render();
}

function saveCellEdit() {
  if (!state.editingCellKey) return;
  const [cardId, lineId, field] = state.editingCellKey.split("|");
  const card = state.data.cards.find((entry) => entry.id === cardId);
  if (!card) return;
  const rawValue = normalizeLineValueInput(state.cellEditValue);
  const value = rawValue.trim();
  if ((field === "title" || field === "value") && !value) {
    notify(field === "title" ? "제목을 입력하세요" : "값을 입력하세요");
    return;
  }

  if (field === "title") {
    card.title = value;
  } else if (field === "tabId") {
    if (state.data.tabs.some((tab) => tab.id === value && tab.id !== "all")) card.tabId = value;
  } else {
    const item = card.items.find((line) => line.id === lineId);
    if (!item) return;
    const time = nowIso();
    if (field === "label") item.label = value;
    if (field === "value") {
      item.value = rawValue;
      item.type = inferType(rawValue);
    }
    item.updatedAt = time;
    card.updatedAt = time;
  }
  if (field === "title" || field === "tabId") card.updatedAt = nowIso();
  state.editingCellKey = null;
  state.cellEditValue = "";
  scheduleSave();
  notify("수정됨");
  render();
}

function updateLineEditDraft(patch) {
  state.lineEditDraft = { ...(state.lineEditDraft || {}), ...patch };
  if (patch.type === "divider") {
    state.lineEditDraft.label = "";
    state.lineEditDraft.value = "---";
  }
}

function cancelLineEdit() {
  state.editingLineKey = null;
  state.lineEditDraft = null;
  if (state.activePanel === "line-editor") state.activePanel = null;
  render();
}

function saveLineEdit() {
  if (!state.editingLineKey || !state.lineEditDraft) return;
  const [cardId, lineId] = state.editingLineKey.split(":");
  const draft = { ...state.lineEditDraft };
  const draftValue = normalizeLineValueInput(draft.value);
  if (draft.type !== "divider" && !draftValue.trim()) {
    notify("값을 입력하세요");
    return;
  }
  const card = state.data.cards.find((entry) => entry.id === cardId);
  const item = card?.items.find((line) => line.id === lineId);
  if (!card || !item) return;
  if (!lineEditHasChanges(item, draft)) { cancelLineEdit(); notify("변경 없음"); return; }
  if (!confirmSave()) return;
  const time = nowIso();
  Object.assign(item, {
    label: draft.type === "divider" ? "" : String(draft.label || "").trim(),
    value: draft.type === "divider" ? "---" : draftValue,
    group: draft.type === "divider" ? "" : String(draft.group || "").trim(),
    type: ITEM_TYPES.includes(draft.type) ? draft.type : "text",
    secret: Boolean(draft.secret),
    expiresAt: draft.type === "divider" ? "" : normalizeDateOnly(draft.expiresAt),
    updatedAt: time
  });
  card.updatedAt = time;
  state.editingLineKey = null;
  state.lineEditDraft = null;
  if (state.activePanel === "line-editor") state.activePanel = null;
  scheduleSave();
  notify("줄 저장됨");
  render();
}

function deleteCardLine(cardId, lineId) {
  const card = state.data.cards.find((entry) => entry.id === cardId);
  if (!card) return;
  requestDeleteConfirm("이 줄을 삭제할까요?", () => {
    card.items = card.items.filter((line) => line.id !== lineId).map((line, index) => ({ ...line, order: index + 1 }));
    card.updatedAt = nowIso();
    state.selected.delete(`${cardId}:${lineId}`);
    if (state.editingLineKey === `${cardId}:${lineId}`) {
      state.editingLineKey = null;
      state.lineEditDraft = null;
      if (state.activePanel === "line-editor") state.activePanel = null;
    }
    scheduleSave();
    render();
  }, { detail: `${card.title} 카드에서 제거됩니다.` });
}

function deleteCard(cardId) {
  const card = state.data.cards.find((entry) => entry.id === cardId);
  if (!card) return;
  requestDeleteConfirm("카드를 삭제할까요?", () => {
    state.data.cards = state.data.cards.filter((entry) => entry.id !== cardId);
    for (const id of [...state.selected]) {
      if (id.startsWith(`${cardId}:`)) state.selected.delete(id);
    }
    scheduleSave();
    render();
  }, { detail: `${card.title} 카드와 안의 줄이 삭제됩니다.` });
}

function toggleFavorite(cardId) {
  const card = state.data.cards.find((entry) => entry.id === cardId);
  if (!card) return;
  card.favorite = !card.favorite;
  card.updatedAt = nowIso();
  scheduleSave();
  render();
}

function toggleReveal(lineId) {
  if (state.revealed.has(lineId)) {
    state.revealed.delete(lineId);
    clearTimeout(revealTimers.get(lineId));
    revealTimers.delete(lineId);
  } else {
    state.revealed.add(lineId);
    clearTimeout(revealTimers.get(lineId));
    const timer = setTimeout(() => {
      state.revealed.delete(lineId);
      revealTimers.delete(lineId);
      render();
    }, Number(state.data.settings.secretRevealSeconds || 10) * 1000);
    revealTimers.set(lineId, timer);
  }
  render();
}

function clearRevealedSecrets() {
  for (const timer of revealTimers.values()) clearTimeout(timer);
  revealTimers.clear();
  state.revealed.clear();
  state.lastCopiedKey = "";
}

function toggleSelected(cardId, lineId, checked) {
  const key = `${cardId}:${lineId}`;
  if (checked) state.selected.add(key);
  else state.selected.delete(key);
}

function selectedItemsForCard(card) {
  return sortedItems(card.items).filter((item) => state.selected.has(`${card.id}:${item.id}`));
}

function updateSetting(key, value) {
  state.data.settings[key] = value;
  applyAppearanceSettings(state.data.settings);
  scheduleSave();
  if (key === "lockTimeoutMinutes") touchLockActivity();
  if (key === "minimizeToTray" || key === "launchOnStartup") {
    syncDesktopPreferences({ silent: false });
  }
  if (key.startsWith("expiryNotification") || key === "expiryNotifications" || key === "expiryNotifyBeforeDays") {
    syncExpiryNotificationSchedule({ immediate: Boolean(state.data.settings.expiryNotifications) });
  }
  render();
}

function bindEvents() {
  bindLockForms({ unlockApp, setPassword: setLockPassword, changePassword: changeLockPassword, removePassword: removeLockPassword });

  const searchInput = document.querySelector("#search");
  searchInput?.addEventListener("compositionstart", () => {
    isComposingSearch = true;
    clearTimeout(searchRenderTimer);
  });
  searchInput?.addEventListener("compositionend", (event) => {
    isComposingSearch = false;
    state.query = event.target.value;
    scheduleSearchRender();
  });
  searchInput?.addEventListener("input", (event) => {
    state.query = event.target.value;
    const inputType = event.inputType || "";
    if (isComposingSearch || event.isComposing || inputType.includes("Composition")) return;
    scheduleSearchRender();
  });

  document.querySelector("#quick-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    quickPaste(event.currentTarget);
  });

  document.querySelector("#card-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    saveEditor(event.currentTarget);
  });
  document.querySelector("#card-form")?.addEventListener("input", syncEditorDraft);
  document.querySelector("#card-form")?.addEventListener("change", (event) => { syncEditorDraft(); if (event.target.name === "quickSplitMode") render(); });

  document.querySelectorAll("[data-draft]").forEach((control) => {
    const eventName = control.type === "checkbox" || control.tagName === "SELECT" ? "change" : "input";
    control.addEventListener(eventName, (event) => {
      syncDraftField(event.currentTarget, state);
      if (event.currentTarget.dataset.draftRender === "true") render();
    });
  });
  bindQuickPastePreview();

  document.querySelector("[data-line-move-target]")?.addEventListener("change", (event) => {
    updateLineMoveTarget(event.currentTarget.value);
  });
  document.querySelector("[data-line-move-query]")?.addEventListener("input", (event) => {
    updateLineMoveQuery(event.currentTarget.value);
  });

  document.querySelector("[data-table-quick-add]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    quickAddLineFromForm(event.currentTarget);
  });

  document.querySelectorAll("[data-quick-line-form]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      quickAddLineFromForm(event.currentTarget);
    });
  });

  document.querySelectorAll("[data-field]").forEach((control) => {
    control.addEventListener("input", (event) => {
      const row = event.target.closest(".edit-line");
      const field = event.target.dataset.field;
      const value = field === "secret" ? event.target.checked : event.target.value;
      const patch = { [field]: value };
      if (field === "type" && value === "divider") {
        patch.value = "---";
        row.querySelector("[data-field='value']").value = "---";
      }
      updateEditorLine(row.dataset.id, patch);
    });
  });

  document.querySelectorAll("[data-setting]").forEach((control) => {
    control.addEventListener("change", (event) => {
      const key = event.target.dataset.setting;
      const type = event.target.dataset.settingType || "";
      const value = event.target.type === "checkbox"
        ? event.target.checked
        : type === "string"
          ? event.target.value
          : Number(event.target.value);
      updateSetting(key, value);
    });
  });

  document.querySelectorAll("[data-cell-edit]").forEach((element) => {
    element.addEventListener("dblclick", (event) => {
      startCellEdit(event.currentTarget.dataset.card, event.currentTarget.dataset.id, event.currentTarget.dataset.field);
    });
  });

  document.querySelectorAll("[data-cell-edit-input]").forEach((control) => {
    control.addEventListener("input", (event) => {
      state.cellEditValue = event.currentTarget.value;
    });
    control.addEventListener("change", (event) => {
      state.cellEditValue = event.currentTarget.value;
      if (event.currentTarget.tagName === "SELECT") saveCellEdit();
    });
    control.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey && event.currentTarget.tagName !== "TEXTAREA") {
        event.preventDefault();
        saveCellEdit();
      }
      if (event.key === "Escape") {
        event.preventDefault();
        cancelCellEdit();
      }
    });
    control.addEventListener("blur", () => {
      if (state.editingCellKey) saveCellEdit();
    });
  });

  document.querySelectorAll("[data-line-edit-field]").forEach((control) => {
    control.addEventListener("input", (event) => {
      const field = event.currentTarget.dataset.lineEditField;
      const value = event.currentTarget.type === "checkbox" ? event.currentTarget.checked : event.currentTarget.value;
      updateLineEditDraft({ [field]: value });
      if (field === "type" && value === "divider") {
        const valueInput = document.querySelector("[data-line-edit-value]");
        if (valueInput) valueInput.value = "---";
      }
      if (field === "type") render();
    });
    control.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey && event.currentTarget.tagName !== "TEXTAREA") {
        event.preventDefault();
        saveLineEdit();
      }
      if (event.key === "Escape") {
        event.preventDefault();
        cancelLineEdit();
      }
    });
  });

  document.querySelectorAll("[data-tag-input]").forEach((input) => {
    const preview = input.closest("form")?.querySelector("[data-tag-preview]");
    const sync = () => {
      if (preview) preview.innerHTML = renderTagPreview(input.value);
    };
    sync();
    input.addEventListener("input", sync);
  });

  document.querySelector("#import-file")?.addEventListener("change", (event) => handleImport(event.target.files?.[0]));

  bindManagerControls({ state, render });

  document.querySelectorAll("[data-action='select-line']").forEach((box) => {
    box.addEventListener("change", (event) => {
      toggleSelected(event.target.dataset.card, event.target.dataset.id, event.target.checked);
      render();
    });
  });
}

({ render, renderTagPreview } = createRenderers({
  app,
  state,
  bindEvents,
  clampManagerPage,
  renderManagerPager,
  selectedItemsForCard
}));

({ resolveDuplicatesBeforeAdd, focusDuplicate, commitDuplicatePending } = createDuplicateActions({
  state,
  scheduleSave,
  notify,
  closeEditor,
  render: () => render(),
  clearDraftForPending
}));

({ requestDeleteConfirm, cancelDeleteConfirm, confirmPendingDelete } = createDeleteConfirmActions({
  state,
  render: () => render(),
  notify
}));

({ quickPaste } = createQuickInputActions({
  state,
  resolveDuplicatesBeforeAdd,
  scheduleSave,
  notify,
  clearQuickDraft,
  render: () => render()
}));

({ quickAddLineFromForm } = createQuickLineActions({
  state,
  resolveDuplicatesBeforeAdd,
  scheduleSave,
  notify,
  clearTableAddDraft,
  clearQuickLineDraft
}));

({ copyText } = createCopyActions({ state, notify, render: () => render(), writeText, readText }));

({ copySplitPattern, insertSplitPattern } = createSplitPatternActions({ copyText, notify }));

({ startLineMove, updateLineMoveTarget, updateLineMoveQuery, cancelLineMove, confirmLineMove } = createLineMoveActions({
  state,
  scheduleSave,
  notify,
  render: () => render()
}));

({ selectedItemsInView, copySelectedInView, clearSelection, groupSelectedInView } = createSelectionActions({
  state,
  copyText,
  selectedItemsForCard,
  render: () => render(),
  scheduleSave,
  notify
}));

({ setViewMode, focusTableAdd } = createViewActions({
  state,
  render: () => render()
}));

({ selectManagerTag, toggleTagQuery, renameTag, deleteTag } = createTagActions({
  state,
  scheduleSave,
  notify,
  render: () => render(),
  tagStats,
  clampManagerPage,
  requestDeleteConfirm
}));

({ handleImport, handleExport, handleDataPathChange, handleDataPathReset } = createBackupActions({
  state,
  notify,
  render: () => render()
}));

({
  lockApp,
  unlockApp,
  setPassword: setLockPassword,
  changePassword: changeLockPassword,
  removePassword: removeLockPassword,
  lockOnBoot,
  touchActivity: touchLockActivity,
  bindActivityTracking: bindLockActivityTracking
} = createLockActions({
  state,
  scheduleSave,
  notify,
  render: () => render(),
  clearSecrets: clearRevealedSecrets,
  openSettings: () => state.activePanel !== "settings" && openPanel("settings")
}));

const handleAction = createUiActionHandler({
  state,
  render: () => render(),
  openPanel,
  tagStats,
  moveManagerPage,
  setActiveTab,
  selectManagerTab,
  selectManagerTag,
  moveTab,
  renameTab,
  deleteTab,
  renameTag,
  deleteTag,
  toggleTagQuery,
  updateSetting,
  closeEditor,
  pasteToEditor,
  addEditorLine,
  moveEditorLine,
  deleteEditorLine,
  startEditCard,
  deleteCard,
  toggleFavorite,
  toggleReveal,
  saveLineEdit,
  cancelLineEdit,
  deleteCardLine,
  startLineEdit,
  startLineMove,
  cancelLineMove,
  confirmLineMove,
  startNewCard,
  createTab,
  focusDuplicate,
  commitDuplicatePending,
  selectedItemsForCard,
  copySelectedInView,
  clearSelection,
  groupSelectedInView,
  copyText,
  copySplitPattern,
  insertSplitPattern,
  setViewMode,
  focusTableAdd,
  handleExport,
  handleDataPathChange,
  handleDataPathReset,
  lockApp,
  checkExpiryNotifications,
  cancelDeleteConfirm,
  confirmPendingDelete
});

bindRootActions(app, handleAction);
bindTagSuggestionActions(app, { state });
bindLineContextMenuActions(app, { state, render: () => render(), copyText, startLineEdit, startLineMove, deleteCardLine, toggleReveal, scheduleSave, notify });
bindEditorDraftPersistence(app, { state, syncEditorDraft, scheduleDraftSave });
bindLockActivityTracking();
bindKeyboardShortcuts({
  state,
  startNewCard,
  openPanel,
  setViewMode,
  focusTableAdd,
  lockApp,
  cancelCellEdit,
  cancelLineEdit,
  cancelLineMove,
  closeEditor,
  saveCellEdit,
  saveLineEdit,
  scheduleSave,
  notify,
  selectedItemsInView,
  copySelectedInView
});

boot().catch((error) => {
  app.innerHTML = `<pre class="fatal">${escapeHtml(error.message || error)}</pre>`;
});
