import { writeText, readText } from "@tauri-apps/plugin-clipboard-manager";
import "./styles.css";
import { createRenderers } from "./ui/renderers.js";
import { icon } from "./ui/icons.js";
import { escapeHtml } from "./ui/utils.js";
import { cellKey } from "./ui/editableCell.js";
import { createDuplicateActions } from "./actions/duplicates.js";
import { bindManagerControls } from "./actions/managerControls.js";
import { bindRootActions } from "./actions/rootEvents.js";
import { createSelectionActions } from "./actions/selectionActions.js";
import { createTagActions } from "./actions/tagActions.js";
import { createUiActionHandler } from "./actions/uiActions.js";
import { createViewActions } from "./actions/viewActions.js";
import {
  ITEM_TYPES,
  allTags,
  copyTextForItems,
  formatTags,
  inferType,
  makeCard,
  mergeLineTimestamps,
  normalizeData,
  nowIso,
  parseLineParts,
  parseTags,
  parseLines,
  stampLine,
  sortedItems,
  uid
} from "./domain.js";
import { exportDataJson, getDataFilePath, importDataFromJson, loadData, saveData } from "./storage.js";
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
  dataPath: "",
  lastCopiedText: "",
  denseMode: localStorage.getItem("linememo-dense-mode") !== "false",
  viewMode: localStorage.getItem("linememo-view-mode") || "cards",
  showTableAdd: false,
  tableSortAsc: true,
  duplicateConflict: null,
  managerPages: {
    tabs: 1,
    tags: 1
  },
  managerFilters: {
    tabQuery: "",
    tabVisibility: "all",
    tabSort: "order",
    tagQuery: "",
    tagSort: "name"
  }
};

const MANAGER_PAGE_SIZE = 5;
let render = () => {};
let renderTagPreview = () => "";
let resolveDuplicatesBeforeAdd = () => false;
let focusDuplicate = () => {};
let commitDuplicatePending = () => {};
let selectedItemsInView = () => [];
let copySelectedInView = async () => {};
let clearSelection = () => {};
let setViewMode = () => {};
let focusTableAdd = () => {};
let selectManagerTag = () => {};
let toggleTagQuery = () => {};
let renameTag = () => {};
let deleteTag = () => {};

let saveTimer = null;
let revealTimers = new Map();
let toastTimer = null;
let copyFeedbackTimer = null;
let isComposingSearch = false;
let searchRenderTimer = null;

async function boot() {
  state.data = await loadData();
  const remembered = state.data.settings.rememberLastTab ? state.data.settings.lastTabId || "inbox" : "inbox";
  syncActiveTabs(state, remembered, { single: true });
  state.dataPath = await getDataFilePath();
  render();
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    state.data = await saveData(state.data);
    render();
  }, 350);
}

function notify(message) {
  state.toast = message;
  clearTimeout(toastTimer);
  render();
  toastTimer = setTimeout(() => {
    state.toast = "";
    render();
  }, 1400);
}

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

async function copyText(text, feedbackKey = "") {
  const value = String(text || "");
  if (!value) {
    notify("복사할 값이 없습니다");
    return;
  }
  try {
    await writeText(value);
  } catch {
    await navigator.clipboard.writeText(value);
  }
  state.lastCopiedText = value;
  state.lastCopiedKey = feedbackKey;
  notify("복사됨");
  clearTimeout(copyFeedbackTimer);
  copyFeedbackTimer = setTimeout(() => {
    state.lastCopiedKey = "";
    render();
  }, 1000);

  const settings = state.data.settings;
  if (settings.autoClearClipboard) {
    window.setTimeout(async () => {
      try {
        const current = await readText();
        if (current === value) await writeText("");
      } catch {
        const current = await navigator.clipboard.readText();
        if (current === value) await navigator.clipboard.writeText("");
      }
    }, Number(settings.clipboardClearSeconds || 30) * 1000);
  }
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
  if (!confirm(`'${tab.name}' 탭을 삭제하고 카드를 Inbox로 이동할까요?`)) return;
  state.data.cards.forEach((card) => {
    if (card.tabId === id) card.tabId = "inbox";
  });
  state.data.tabs = state.data.tabs.filter((entry) => entry.id !== id).map((entry, index) => ({ ...entry, order: index }));
  syncActiveTabs(state, "inbox", { single: true });
  clampManagerPage("tabs", state.data.tabs.length);
  scheduleSave();
  render();
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
  state.editingCardId = "new";
  state.activePanel = "editor";
  state.editorDraft = {
    title: "",
    tabId: defaultTabId(state),
    tags: "",
    description: "",
    quickValues: ""
  };
  state.editorItems = [];
  render();
  queueMicrotask(() => document.querySelector("#card-title")?.focus());
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
    quickValues: ""
  };
  state.editorItems = sortedItems(card.items).map((item) => ({ ...item }));
  render();
}

function closeEditor(shouldRender = true) {
  state.editingCardId = null;
  state.editorDraft = null;
  state.editorItems = [];
  if (state.activePanel === "editor") state.activePanel = null;
  if (shouldRender) render();
}

function pasteToEditor(text) {
  syncEditorDraft();
  state.editorItems = parseLines(text);
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
    order: state.editorItems.length + 1
  }));
  render();
}

function updateEditorLine(id, patch) {
  state.editorItems = state.editorItems.map((item) => (item.id === id ? { ...item, ...patch } : item));
}

function deleteEditorLine(id) {
  syncEditorDraft();
  state.editorItems = state.editorItems.filter((item) => item.id !== id).map((item, index) => ({ ...item, order: index + 1 }));
  render();
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
    quickValues: String(formData.get("quickValues") || "")
  };
}

function saveEditor(form) {
  const formData = new FormData(form);
  const quickValues = String(formData.get("quickValues") || "");
  const quickItems = parseLines(quickValues);
  const items = state.editorItems
    .map((item, index) => ({ ...item, order: index + 1, value: item.type === "divider" ? "---" : item.value }))
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
      const time = nowIso();
      Object.assign(card, payload, { items: mergeLineTimestamps(payload.items, card.items, time), updatedAt: time });
    }
  }
  closeEditor(false);
  scheduleSave();
  notify("저장됨");
}

function quickPaste(form) {
  const formData = new FormData(form);
  const raw = String(formData.get("quickText") || "");
  const items = parseLines(raw);
  if (!items.length) {
    notify("붙여넣을 줄이 없습니다");
    return;
  }
  const title = String(formData.get("quickTitle") || "").trim() || firstMeaningfulLine(items) || "빠른 메모";
  const tags = parseTags(formData.get("quickTags"));
  const tabId = defaultTabId(state);
  if (resolveDuplicatesBeforeAdd(items, { type: "quick-paste", payload: { title, tabId, description: "", tags, items } })) return;
  const card = makeCard({ title, tabId, description: "", tags, items });
  state.data.cards.unshift(card);
  state.collapsedCards.delete(card.id);
  state.activePanel = null;
  scheduleSave();
  notify("카드 생성됨");
}

function createInlineCard(form) {
  const formData = new FormData(form);
  const raw = String(formData.get("inlineText") || "");
  const items = parseLines(raw);
  if (!items.length) {
    notify("카드에 넣을 값이 없습니다");
    return;
  }
  const title = String(formData.get("inlineTitle") || "").trim() || firstMeaningfulLine(items) || "빠른 메모";
  const tags = parseTags(formData.get("inlineTags"));
  const tabId = defaultTabId(state);
  if (resolveDuplicatesBeforeAdd(items, { type: "inline-card", payload: { title, tabId, description: "", tags, items } })) return;
  const card = makeCard({ title, tabId, description: "", tags, items });
  state.data.cards.unshift(card);
  state.expandedCards.add(card.id);
  state.collapsedCards.delete(card.id);
  form.reset();
  state.showTableAdd = false;
  scheduleSave();
  notify("카드 추가됨");
}

function quickAddLines(cardId, raw) {
  const card = state.data.cards.find((entry) => entry.id === cardId);
  if (!card) return;
  const items = parseLines(raw);
  if (!items.length) {
    notify("추가할 값이 없습니다");
    return;
  }
  if (resolveDuplicatesBeforeAdd(items, { type: "quick-lines", cardId, items })) return;
  const maxOrder = sortedItems(card.items).at(-1)?.order || 0;
  card.items.push(...items.map((item, index) => ({ ...item, order: maxOrder + index + 1 })));
  card.updatedAt = nowIso();
  state.expandedCards.add(card.id);
  state.collapsedCards.delete(card.id);
  scheduleSave();
  notify(items.length > 1 ? `${items.length}줄 추가됨` : "줄 추가됨");
}

function quickAddLineFromForm(form) {
  const cardId = form.dataset.card || form.elements.cardId?.value;
  const card = state.data.cards.find((entry) => entry.id === cardId);
  if (!card) {
    notify("카드를 선택하세요");
    return;
  }
  const rawLabel = String(form.elements.lineLabel?.value || "").trim();
  const rawValue = String(form.elements.lineValue?.value || "").trim();
  if (!rawValue) {
    notify("추가할 값을 입력하세요");
    return;
  }

  const parsed = parseLineParts(rawValue);
  const label = rawLabel || parsed.label;
  const value = rawLabel ? rawValue : parsed.value;
  const maxOrder = sortedItems(card.items).at(-1)?.order || 0;
  const item = stampLine({
    id: uid("line"),
    label,
    value,
    type: inferType(value),
    secret: Boolean(form.elements.lineSecret?.checked) || shouldInferSecret(label),
    order: maxOrder + 1
  });
  if (resolveDuplicatesBeforeAdd([item], { type: "quick-line", cardId, item })) return;
  card.items.push(item);
  card.updatedAt = nowIso();
  state.expandedCards.add(card.id);
  state.collapsedCards.delete(card.id);
  form.reset();
  scheduleSave();
  notify("줄 추가됨");
}

function shouldInferSecret(label) {
  return /(비밀번호|패스워드|암호|password|passwd|secret|token|api[-_ ]?key|apikey|pw)/i.test(String(label || ""));
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
    type: item.type,
    secret: item.secret
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
  const value = String(state.cellEditValue || "").trim();
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
      item.value = value;
      item.type = inferType(value);
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
  if (draft.type !== "divider" && !String(draft.value || "").trim()) {
    notify("값을 입력하세요");
    return;
  }
  const card = state.data.cards.find((entry) => entry.id === cardId);
  const item = card?.items.find((line) => line.id === lineId);
  if (!card || !item) return;
  const time = nowIso();
  Object.assign(item, {
    label: draft.type === "divider" ? "" : String(draft.label || "").trim(),
    value: draft.type === "divider" ? "---" : String(draft.value || "").trim(),
    type: ITEM_TYPES.includes(draft.type) ? draft.type : "text",
    secret: Boolean(draft.secret),
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
}

function deleteCard(cardId) {
  if (!confirm("카드를 삭제할까요?")) return;
  state.data.cards = state.data.cards.filter((card) => card.id !== cardId);
  for (const id of [...state.selected]) {
    if (id.startsWith(`${cardId}:`)) state.selected.delete(id);
  }
  scheduleSave();
  render();
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
  scheduleSave();
  render();
}

async function handleImport(file) {
  if (!file) return;
  if (!confirm("백업 JSON을 가져오면 현재 데이터가 백업된 뒤 새 데이터로 교체됩니다. 계속할까요?")) return;
  try {
    const text = await file.text();
    state.data = await importDataFromJson(text);
    syncActiveTabs(state, state.data.settings.lastTabId || "inbox", { single: true });
    state.selected.clear();
    notify("가져오기 완료");
    render();
  } catch (error) {
    notify(`가져오기 실패: ${error.message}`);
  }
}

async function handleExport() {
  const json = await exportDataJson(state.data);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `linememo-lite-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function bindEvents() {
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

  document.querySelector("#inline-card-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    createInlineCard(event.currentTarget);
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
      const value = event.target.type === "checkbox" ? event.target.checked : Number(event.target.value);
      updateSetting(key, value);
    });
  });

  document.querySelectorAll("[data-edit-line]").forEach((element) => {
    element.addEventListener("dblclick", (event) => {
      startLineEdit(event.currentTarget.dataset.card, event.currentTarget.dataset.id);
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
      if (event.key === "Enter" && !event.shiftKey) {
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
    });
    control.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
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

document.addEventListener("keydown", (event) => {
  if (event.ctrlKey && event.key.toLowerCase() === "f") {
    event.preventDefault();
    document.querySelector("#search")?.focus();
  }
  if (event.ctrlKey && event.key.toLowerCase() === "n") {
    event.preventDefault();
    startNewCard();
  }
  if (event.ctrlKey && event.key.toLowerCase() === "s") {
    event.preventDefault();
    scheduleSave();
    notify("저장됨");
  }
  if (event.key === "Escape") {
    if (state.editingCellKey) cancelCellEdit();
    else if (state.editingLineKey) cancelLineEdit();
    else if (state.editingCardId) closeEditor();
    else if (state.activePanel) openPanel(state.activePanel);
  }
  if (event.ctrlKey && event.key.toLowerCase() === "c") {
    const selected = selectedItemsInView();
    if (selected.length) {
      event.preventDefault();
      copySelectedInView(false);
    }
  }
});

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
  render: () => render()
}));

({ selectedItemsInView, copySelectedInView, clearSelection } = createSelectionActions({
  state,
  copyText,
  selectedItemsForCard,
  render: () => render()
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
  clampManagerPage
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
  startNewCard,
  createTab,
  focusDuplicate,
  commitDuplicatePending,
  selectedItemsForCard,
  copySelectedInView,
  clearSelection,
  copyText,
  setViewMode,
  focusTableAdd,
  handleExport
});

bindRootActions(app, handleAction);

boot().catch((error) => {
  app.innerHTML = `<pre class="fatal">${escapeHtml(error.message || error)}</pre>`;
});


