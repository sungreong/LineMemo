import { copyTextForItems, getBlocks, searchCards, sortedItems } from "../domain.js";
import { importSampleCsvText, importSampleJsonText } from "../data/importSamples.js";
import { activeTabFilter } from "../state/tabs.js";

function copyTextWithTitle(card) {
  return [card.title, copyTextForItems(card.items, true)].filter(Boolean).join("\n");
}

function escapeMarkdownCell(value) {
  return String(value || "").replace(/\|/g, "\\|").replace(/\n/g, "<br>");
}

function markdownValueForItem(item) {
  if (item.type === "image" && /^https?:\/\/\S+|^data:image\//i.test(item.value || "")) {
    return `![${item.label || "image"}](${item.value})`;
  }
  return item.value;
}

function copyMarkdownForCard(card) {
  const rows = sortedItems(card.items).filter((item) => item.type !== "divider");
  const table = rows.map((item) => `| ${escapeMarkdownCell(item.label || item.type)} | ${escapeMarkdownCell(markdownValueForItem(item))} |`).join("\n");
  return [`## ${card.title}`, "", "| 라벨 | 값 |", "| --- | --- |", table].join("\n");
}

function lineGroupName(item) {
  return String(item?.group || "").trim();
}

function relatedLineItems(card, item) {
  const group = lineGroupName(item);
  if (!group) return [];
  return sortedItems(card.items).filter((entry) => entry.type !== "divider" && lineGroupName(entry) === group);
}

function copyableItems(items = []) {
  return sortedItems(items).filter((item) => item.type !== "divider");
}

function hasSecret(items = []) {
  return copyableItems(items).some((item) => item.secret);
}

function visibleCards(state) {
  return searchCards(state.data, activeTabFilter(state), state.query);
}

export function createUiActionHandler(deps) {
  const {
    state,
    render,
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
    startLineMove = () => {},
    cancelLineMove = () => {},
    confirmLineMove = () => {},
    startNewCard,
    createTab,
    focusDuplicate,
    commitDuplicatePending,
    selectedItemsForCard,
    copySelectedInView,
    clearSelection,
    groupSelectedInView = () => false,
    copyText,
    copySplitPattern = () => {},
    insertSplitPattern = () => {},
    setViewMode,
    focusTableAdd,
    handleExport,
    handleDataPathChange = async () => {},
    handleDataPathReset = async () => {},
    lockApp,
    checkExpiryNotifications = async () => {},
    cancelDeleteConfirm = () => {},
    confirmPendingDelete = () => {}
  } = deps;

  return async function handleAction(element, event) {
    const action = element.dataset.action;
    const id = element.dataset.id;
    const cardId = element.dataset.card || id;
    const card = state.data.cards.find((entry) => entry.id === cardId);
    if (element.disabled) return;
    if (action === "menu-toggle") return;
    if (action !== "close-panel" && action !== "select-line") event.preventDefault();

    if (action === "open-panel") openPanel(element.dataset.panel);
    if (action === "settings-tab") {
      state.settingsTab = element.dataset.tab || "behavior";
      render();
    }
    if (action === "close-panel" && event.target === element) {
      if (state.activePanel === "line-move") cancelLineMove();
      else openPanel(state.activePanel);
    }
    if (action === "duplicate-cancel") {
      state.duplicateConflict = null;
      render();
    }
    if (action === "delete-confirm-cancel") cancelDeleteConfirm();
    if (action === "delete-confirm-now") confirmPendingDelete(Boolean(document.querySelector("[name='skipDeleteConfirm']")?.checked));
    if (action === "delete-confirm-skip") confirmPendingDelete(true);
    if (action === "duplicate-keep") commitDuplicatePending();
    if (action === "duplicate-go") focusDuplicate(Number(element.dataset.index || 0));
    if (action === "toggle-density") {
      state.denseMode = !state.denseMode;
      localStorage.setItem("linememo-dense-mode", String(state.denseMode));
      render();
    }
    if (action === "toggle-collapse-all") {
      const cards = visibleCards(state);
      const shouldExpand = cards.length > 0 && cards.every((entry) => state.collapsedCards.has(entry.id));
      cards.forEach((entry) => {
        if (shouldExpand) state.collapsedCards.delete(entry.id);
        else state.collapsedCards.add(entry.id);
      });
      render();
    }
    if (action === "set-view") setViewMode(element.dataset.mode);
    if (action === "toggle-view") {
      state.viewMode = state.viewMode === "table" ? "cards" : "table";
      localStorage.setItem("linememo-view-mode", state.viewMode);
      render();
    }
    if (action === "focus-table-add") focusTableAdd();
    if (action === "lock-now") lockApp();
    if (action === "toggle-table-add") {
      state.showTableAdd = !state.showTableAdd;
      render();
    }
    if (action === "toggle-table-sort") {
      state.tableSortAsc = !state.tableSortAsc;
      render();
    }
    if (action === "toggle-quick-line") {
      const targetCardId = element.dataset.card || id;
      state.activeQuickLineCardId = state.activeQuickLineCardId === targetCardId ? "" : targetCardId;
      render();
      queueMicrotask(() => document.querySelector(`[data-quick-line-form][data-card="${targetCardId}"] [name='lineValue']`)?.focus());
    }
    if (action === "toggle-collapse") {
      if (state.collapsedCards.has(id)) state.collapsedCards.delete(id);
      else state.collapsedCards.add(id);
      render();
    }
    if (action === "save-line-edit") saveLineEdit();
    if (action === "cancel-line-edit") cancelLineEdit();
    if (action === "delete-line") deleteCardLine(element.dataset.card, id);
    if (action === "edit-line-detail") startLineEdit(element.dataset.card, id);
    if (action === "move-line") startLineMove(element.dataset.card, id);
    if (action === "cancel-line-move") cancelLineMove();
    if (action === "confirm-line-move") confirmLineMove();
    if (action === "new-card") startNewCard();
    if (action === "new-tab") createTab();
    if (action === "manager-page") {
      const kind = element.dataset.kind;
      const total = Number(element.dataset.total || (kind === "tags" ? tagStats().length : state.data.tabs.length));
      moveManagerPage(kind, Number(element.dataset.direction || 0), total);
    }
    if (action === "tab") setActiveTab(id);
    if (action === "manager-focus-tab") {
      state.managerFocusTabId = id;
      render();
    }
    if (action === "manager-focus-tag") {
      state.managerFocusTag = element.dataset.tag;
      render();
    }
    if (action === "manager-select-tab") selectManagerTab(id);
    if (action === "manager-select-tag") selectManagerTag(element.dataset.tag);
    if (action === "tab-up") moveTab(id, -1);
    if (action === "tab-down") moveTab(id, 1);
    if (action === "tab-rename") renameTab(id);
    if (action === "tab-delete") deleteTab(id);
    if (action === "tag-rename") renameTag(element.dataset.tag);
    if (action === "tag-delete") deleteTag(element.dataset.tag);
    if (action === "search-tag") toggleTagQuery(element.dataset.tag);
    if (action === "ack-warning") updateSetting("acknowledgedPlainTextWarning", true);
    if (action === "close-editor") closeEditor();
    if (action === "parse-paste") pasteToEditor(document.querySelector("#paste-area").value);
    if (action === "add-line") addEditorLine();
    if (action === "line-up") moveEditorLine(id, -1);
    if (action === "line-down") moveEditorLine(id, 1);
    if (action === "line-delete") deleteEditorLine(id);
    if (action === "edit-card") startEditCard(id);
    if (action === "delete-card") deleteCard(id);
    if (action === "favorite") toggleFavorite(id);
    if (action === "reveal") toggleReveal(id);
    if (action === "toggle-expand") {
      if (state.expandedCards.has(id)) state.expandedCards.delete(id);
      else state.expandedCards.add(id);
      render();
    }
    if (action === "copy-line" && card) {
      const item = card.items.find((line) => line.id === element.dataset.id);
      await copyText(item?.value || "", { key: `line:${card.id}:${item?.id}`, type: "line", label: item?.label || item?.type || "값", secret: item?.secret });
    }
    if (action === "copy-line-group" && card) {
      const item = card.items.find((line) => line.id === element.dataset.id);
      const related = relatedLineItems(card, item);
      await copyText(copyTextForItems(related, true), { key: `group:${card.id}:${lineGroupName(item)}`, type: "group", label: lineGroupName(item), count: related.length, secret: related.some((entry) => entry.secret) });
    }
    if (action === "copy-line-group-tab" && card) {
      const item = card.items.find((line) => line.id === element.dataset.id);
      const related = relatedLineItems(card, item);
      await copyText(related.map((entry) => entry.value).join("\t"), { key: `group:${card.id}:${lineGroupName(item)}:tab`, type: "group-tab", label: lineGroupName(item), count: related.length, secret: related.some((entry) => entry.secret) });
    }
    if (action === "copy-line-group-next" && card) {
      const item = card.items.find((line) => line.id === element.dataset.id);
      const related = relatedLineItems(card, item);
      const key = `group:${card.id}:${lineGroupName(item)}:next`;
      state.groupCopyCursor = state.groupCopyCursor || {};
      const index = state.groupCopyCursor[key] || 0;
      const next = related[index % Math.max(related.length, 1)];
      state.groupCopyCursor[key] = (index + 1) % Math.max(related.length, 1);
      await copyText(next?.value || "", { key, type: "group-next", label: next?.label || lineGroupName(item), index: index + 1, count: related.length, secret: next?.secret });
    }
    if (action === "copy-card" && card) await copyText(copyTextForItems(card.items), { key: `card:${card.id}`, type: "card", title: card.title, count: copyableItems(card.items).length, secret: hasSecret(card.items) });
    if (action === "copy-card-labels" && card) await copyText(copyTextForItems(card.items, true), { key: `card:${card.id}`, type: "card", title: card.title, count: copyableItems(card.items).length, secret: hasSecret(card.items) });
    if (action === "copy-card-title" && card) await copyText(copyTextWithTitle(card), { key: `card:${card.id}:title`, type: "card-title", title: card.title, count: copyableItems(card.items).length, secret: hasSecret(card.items) });
    if (action === "copy-card-markdown" && card) await copyText(copyMarkdownForCard(card), { key: `card:${card.id}:markdown`, type: "card-markdown", title: card.title, count: copyableItems(card.items).length, secret: hasSecret(card.items) });
    if (action === "copy-selected" && card) {
      const items = selectedItemsForCard(card);
      await copyText(copyTextForItems(items), { key: `card:${card.id}`, type: "selected", count: items.length, secret: hasSecret(items) });
    }
    if (action === "copy-selected-labels" && card) {
      const items = selectedItemsForCard(card);
      await copyText(copyTextForItems(items, true), { key: `card:${card.id}`, type: "selected", count: items.length, includeLabels: true, secret: hasSecret(items) });
    }
    if (action === "copy-selected-global") await copySelectedInView(false);
    if (action === "copy-selected-global-labels") await copySelectedInView(true);
    if (action === "group-selected") {
      const groupName = prompt("복사 세트 이름 (비우면 세트 해제)");
      if (groupName !== null) groupSelectedInView(groupName);
    }
    if (action === "clear-selection") clearSelection();
    if (action === "copy-block" && card) {
      const block = getBlocks(card.items)[Number(element.dataset.index)];
      await copyText(copyTextForItems(block), { key: `card:${card.id}`, type: "block", count: copyableItems(block).length, secret: hasSecret(block) });
    }
    if (action === "copy-path") await copyText(state.dataPath, "settings:path");
    if (action === "copy-import-csv") await copyText(importSampleCsvText(), "settings:import-csv");
    if (action === "copy-import-json") await copyText(importSampleJsonText(), "settings:import-json");
    if (action === "copy-split-pattern") await copySplitPattern(element.closest("form"));
    if (action === "insert-split-pattern") insertSplitPattern(element.closest("form"), element);
    if (action === "set-data-path") await handleDataPathChange();
    if (action === "reset-data-path") await handleDataPathReset();
    if (action === "export") await handleExport();
    if (action === "check-expiry-notifications") await checkExpiryNotifications();
  };
}
