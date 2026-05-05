import { copyTextForOrderedItems, searchCards, sortedItems } from "../domain.js";
import { activeTabFilter } from "../state/tabs.js";

export function createSelectionActions({ state, copyText, selectedItemsForCard, render }) {
  function visibleCardsSorted() {
    return searchCards(state.data, activeTabFilter(state), state.query).sort((a, b) => {
      if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });
  }

  function selectedItemsInView() {
    const cards = visibleCardsSorted();
    if (state.viewMode === "table") {
      return cards
        .flatMap((card) => sortedItems(card.items).filter((item) => item.type !== "divider").map((item) => ({ card, item })))
        .sort((a, b) => state.tableSortAsc ? a.card.title.localeCompare(b.card.title, "ko") : b.card.title.localeCompare(a.card.title, "ko"))
        .filter(({ card, item }) => state.selected.has(`${card.id}:${item.id}`))
        .map(({ item }) => item);
    }
    return cards.flatMap(selectedItemsForCard);
  }

  async function copySelectedInView(includeLabels = false) {
    const key = includeLabels ? "selection:labels" : "selection";
    await copyText(copyTextForOrderedItems(selectedItemsInView(), includeLabels), key);
  }

  function clearSelection() {
    state.selected.clear();
    render();
  }

  return { selectedItemsInView, copySelectedInView, clearSelection };
}
