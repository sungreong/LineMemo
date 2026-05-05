import { copyTextForItems, getBlocks } from "../domain.js";

export function createUiActionHandler(deps) {
  const {
    state,
    render,
    openPanel,
    tagStats,
    moveManagerPage,
    setActiveTab,
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
    copyText,
    handleExport
  } = deps;

  return async function handleAction(element, event) {
    const action = element.dataset.action;
    const id = element.dataset.id;
    const cardId = element.dataset.card || id;
    const card = state.data.cards.find((entry) => entry.id === cardId);
    if (element.disabled) return;
    if (action !== "close-panel" && action !== "select-line") event.preventDefault();

    if (action === "open-panel") openPanel(element.dataset.panel);
    if (action === "close-panel" && event.target === element) openPanel(state.activePanel);
    if (action === "duplicate-cancel") {
      state.duplicateConflict = null;
      render();
    }
    if (action === "duplicate-keep") commitDuplicatePending();
    if (action === "duplicate-go") focusDuplicate(Number(element.dataset.index || 0));
    if (action === "toggle-density") {
      state.denseMode = !state.denseMode;
      localStorage.setItem("linememo-dense-mode", String(state.denseMode));
      render();
    }
    if (action === "toggle-view") {
      state.viewMode = state.viewMode === "table" ? "cards" : "table";
      localStorage.setItem("linememo-view-mode", state.viewMode);
      render();
    }
    if (action === "toggle-table-add") {
      state.showTableAdd = !state.showTableAdd;
      render();
    }
    if (action === "toggle-table-sort") {
      state.tableSortAsc = !state.tableSortAsc;
      render();
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
    if (action === "new-card") startNewCard();
    if (action === "new-tab") createTab();
    if (action === "manager-page") {
      const kind = element.dataset.kind;
      const total = kind === "tags" ? tagStats().length : state.data.tabs.length;
      moveManagerPage(kind, Number(element.dataset.direction || 0), total);
    }
    if (action === "tab") setActiveTab(id);
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
      await copyText(item?.value || "", `line:${card.id}:${item?.id}`);
    }
    if (action === "copy-card" && card) await copyText(copyTextForItems(card.items), `card:${card.id}`);
    if (action === "copy-card-labels" && card) await copyText(copyTextForItems(card.items, true), `card:${card.id}`);
    if (action === "copy-selected" && card) await copyText(copyTextForItems(selectedItemsForCard(card)), `card:${card.id}`);
    if (action === "copy-selected-labels" && card) await copyText(copyTextForItems(selectedItemsForCard(card), true), `card:${card.id}`);
    if (action === "copy-block" && card) {
      const block = getBlocks(card.items)[Number(element.dataset.index)];
      await copyText(copyTextForItems(block), `card:${card.id}`);
    }
    if (action === "copy-path") await copyText(state.dataPath, "settings:path");
    if (action === "export") await handleExport();
  };
}
