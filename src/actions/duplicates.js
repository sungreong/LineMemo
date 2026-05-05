import { makeCard, nowIso, sortedItems, stampLine } from "../domain.js";
import { syncActiveTabs } from "../state/tabs.js";

export function createDuplicateActions(ctx) {
  const { state, scheduleSave, notify, closeEditor, render } = ctx;

  function tabNameForCard(card) {
    return state.data.tabs.find((tab) => tab.id === card.tabId)?.name || "Inbox";
  }

  function findDuplicateMatches(items) {
    const values = new Set(items.map((item) => String(item.value || "").trim()).filter(Boolean));
    if (!values.size) return [];
    return state.data.cards.flatMap((card) => sortedItems(card.items)
      .filter((item) => values.has(String(item.value || "").trim()))
      .map((item) => ({ card, item })));
  }

  function resolveDuplicatesBeforeAdd(items, pending) {
    const matches = findDuplicateMatches(items);
    if (!matches.length) return false;
    state.duplicateConflict = {
      total: matches.length,
      pending,
      matches: matches.slice(0, 8).map(({ card, item }) => ({
        cardId: card.id,
        lineId: item.id,
        tabName: tabNameForCard(card),
        cardTitle: card.title,
        label: item.label || item.type || "값",
        value: item.secret ? "********" : item.value
      }))
    };
    render();
    return true;
  }

  function focusDuplicate(index = 0) {
    const match = state.duplicateConflict?.matches?.[index];
    if (!match) return;
    const card = state.data.cards.find((entry) => entry.id === match.cardId);
    const item = card?.items.find((line) => line.id === match.lineId);
    if (!card || !item) return;
    syncActiveTabs(state, card.tabId, { single: true });
    state.query = item.value;
    state.expandedCards.add(card.id);
    state.collapsedCards.delete(card.id);
    state.duplicateConflict = null;
    state.activePanel = null;
    state.editingCardId = null;
    state.editorDraft = null;
    state.editorItems = [];
    notify("기존 위치로 이동");
    render();
  }

  function addCardPayload(payload, message = "카드 생성됨") {
    const card = makeCard(payload);
    state.data.cards.unshift(card);
    state.expandedCards.add(card.id);
    state.collapsedCards.delete(card.id);
    scheduleSave();
    notify(message);
  }

  function commitDuplicatePending() {
    const pending = state.duplicateConflict?.pending;
    state.duplicateConflict = null;
    if (!pending) {
      render();
      return;
    }
    if (pending.type === "new-card") {
      addCardPayload(pending.payload, "카드 생성됨");
      closeEditor(false);
    }
    if (pending.type === "quick-paste") {
      addCardPayload(pending.payload, "카드 생성됨");
      state.activePanel = null;
    }
    if (pending.type === "inline-card") {
      addCardPayload(pending.payload, "카드 추가됨");
      state.showTableAdd = false;
    }
    if (pending.type === "quick-lines") addLines(pending.cardId, pending.items);
    if (pending.type === "quick-line") addLines(pending.cardId, [pending.item]);
    render();
  }

  function addLines(cardId, items) {
    const card = state.data.cards.find((entry) => entry.id === cardId);
    if (!card) return;
    const maxOrder = sortedItems(card.items).at(-1)?.order || 0;
    const time = nowIso();
    card.items.push(...items.map((item, index) => stampLine(item, time, maxOrder + index + 1)));
    card.updatedAt = time;
    state.expandedCards.add(card.id);
    state.collapsedCards.delete(card.id);
    scheduleSave();
    notify(items.length > 1 ? `${items.length}줄 추가됨` : "줄 추가됨");
  }

  return { resolveDuplicatesBeforeAdd, focusDuplicate, commitDuplicatePending };
}
