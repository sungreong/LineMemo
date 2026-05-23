import { copyTextForOrderedItems, nowIso, parseSearchQuery, searchCards, sortedItems } from "../domain.js";
import { activeTabFilter } from "../state/tabs.js";

export function createSelectionActions({ state, copyText, selectedItemsForCard, render, scheduleSave = () => {}, notify = () => {} }) {
  function visibleCardsSorted() {
    const cards = searchCards(state.data, activeTabFilter(state), state.query);
    if (parseSearchQuery(state.query).text.trim()) return cards;
    return cards.sort((a, b) => {
      if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });
  }

  function selectedEntriesInView() {
    const cards = visibleCardsSorted();
    if (state.viewMode === "table") {
      return cards
        .flatMap((card) => sortedItems(card.items).filter((item) => item.type !== "divider").map((item) => ({ card, item })))
        .sort((a, b) => state.tableSortAsc ? a.card.title.localeCompare(b.card.title, "ko") : b.card.title.localeCompare(a.card.title, "ko"))
        .filter(({ card, item }) => state.selected.has(`${card.id}:${item.id}`));
    }
    return cards.flatMap((card) => selectedItemsForCard(card).map((item) => ({ card, item })));
  }

  function selectedItemsInView() {
    return selectedEntriesInView().map(({ item }) => item);
  }

  async function copySelectedInView(includeLabels = false) {
    const key = includeLabels ? "selection:labels" : "selection";
    const items = selectedItemsInView();
    await copyText(copyTextForOrderedItems(items, includeLabels), { key, type: "selected", count: items.length, includeLabels, secret: items.some((item) => item.secret) });
  }

  function clearSelection() {
    state.selected.clear();
    render();
  }

  function groupSelectedInView(groupName) {
    const entries = selectedEntriesInView();
    if (entries.length < 2) {
      notify("세트로 묶을 줄을 2개 이상 선택하세요");
      return false;
    }
    const group = String(groupName || "").trim();
    const time = nowIso();
    entries.forEach(({ card, item }) => {
      item.group = group;
      item.updatedAt = time;
      card.updatedAt = time;
    });
    scheduleSave();
    render();
    notify(group ? `${entries.length}줄을 '${group}' 세트로 지정함` : `${entries.length}줄 세트 해제됨`);
    return true;
  }

  return { selectedItemsInView, copySelectedInView, clearSelection, groupSelectedInView };
}
