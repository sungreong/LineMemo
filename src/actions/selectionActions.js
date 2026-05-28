import { copyTextForOrderedItems, makeCard, normalizeSearchText, nowIso, parseSearchQuery, searchCards, sortedItems } from "../domain.js";
import { activeTabFilter, defaultTabId, syncActiveTabs } from "../state/tabs.js";

function firstLineTitle(entries) {
  const item = entries.find((entry) => entry.item.type !== "divider")?.item;
  return String(item?.label || item?.value || "").slice(0, 42);
}

function moveTitle(entries) {
  return firstLineTitle(entries) || `선택한 ${entries.length}줄`;
}

function tabNameForCard(state, card) {
  return state.data.tabs.find((tab) => tab.id === card.tabId)?.name || "Inbox";
}

function cardName(card) {
  return /카드$/u.test(card.title) ? card.title : `${card.title} 카드`;
}

function targetLabel(state, card) {
  return `${tabNameForCard(state, card)} · ${cardName(card)}`;
}

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

  function targetCardsForSelection(entries) {
    const sourceIds = new Set(entries.map(({ card }) => card.id));
    return state.data.cards.filter((card) => !sourceIds.has(card.id));
  }

  function startSelectionMove() {
    const entries = selectedEntriesInView();
    if (!entries.length) {
      notify("이동할 줄을 선택하세요");
      return false;
    }
    const target = targetCardsForSelection(entries)[0];
    state.selectionMoveDraft = {
      mode: target ? "card" : "new-card",
      targetCardId: target?.id || "",
      targetQuery: "",
      targetTabId: defaultTabId(state),
      targetTitle: moveTitle(entries),
      count: entries.length,
      sourceCount: new Set(entries.map(({ card }) => card.id)).size
    };
    state.activePanel = "selection-move";
    render();
    return true;
  }

  function updateSelectionMoveMode(mode) {
    state.selectionMoveDraft = {
      ...(state.selectionMoveDraft || {}),
      mode: mode === "new-card" ? "new-card" : "card"
    };
    render();
  }

  function updateSelectionMoveTarget(targetCardId) {
    state.selectionMoveDraft = { ...(state.selectionMoveDraft || {}), targetCardId };
    render();
  }

  function updateSelectionMoveQuery(targetQuery) {
    const current = state.selectionMoveDraft?.targetCardId || "";
    const query = String(targetQuery || "");
    const needle = normalizeSearchText(query);
    const targets = state.data.cards.filter((card) => {
      const tab = tabNameForCard(state, card);
      return !needle || normalizeSearchText(`${tab} ${card.title} ${card.description || ""}`).includes(needle);
    });
    const targetCardId = targets.some((card) => card.id === current) ? current : targets[0]?.id || "";
    state.selectionMoveDraft = { ...(state.selectionMoveDraft || {}), targetQuery: query, targetCardId };
    render();
  }

  function updateSelectionMoveTab(targetTabId) {
    state.selectionMoveDraft = { ...(state.selectionMoveDraft || {}), targetTabId };
    render();
  }

  function updateSelectionMoveTitle(targetTitle) {
    state.selectionMoveDraft = { ...(state.selectionMoveDraft || {}), targetTitle };
  }

  function cancelSelectionMove() {
    state.selectionMoveDraft = null;
    if (state.activePanel === "selection-move") state.activePanel = null;
    render();
  }

  function removeMovedFromSources(entries, time) {
    const bySource = new Map();
    for (const { card, item } of entries) {
      if (!bySource.has(card.id)) bySource.set(card.id, { card, ids: new Set() });
      bySource.get(card.id).ids.add(item.id);
    }
    for (const { card, ids } of bySource.values()) {
      card.items = card.items
        .filter((line) => !ids.has(line.id))
        .map((line, index) => ({ ...line, order: index + 1 }));
      card.updatedAt = time;
    }
  }

  function finishSelectionMove(target, movedCount, message) {
    state.selected.clear();
    state.selectionMoveDraft = null;
    state.activePanel = null;
    state.query = "";
    syncActiveTabs(state, target.tabId, { single: true });
    state.expandedCards.add(target.id);
    state.collapsedCards.delete(target.id);
    scheduleSave();
    notify(message || `${targetLabel(state, target)}로 ${movedCount}줄 이동됨`);
    render();
  }

  function moveSelectionToCard(entries, targetCardId) {
    const target = state.data.cards.find((card) => card.id === targetCardId);
    if (!target) return null;
    const time = nowIso();
    const moved = entries
      .filter(({ card }) => card.id !== target.id)
      .map(({ card, item }) => {
        const current = card.items.find((line) => line.id === item.id);
        return current ? { card, item: current } : null;
      })
      .filter(Boolean);
    if (!moved.length) return { target, movedCount: 0 };
    removeMovedFromSources(moved, time);
    const maxOrder = sortedItems(target.items).at(-1)?.order || 0;
    target.items.push(...moved.map(({ item }, index) => ({ ...item, order: maxOrder + index + 1, updatedAt: time })));
    target.updatedAt = time;
    return { target, movedCount: moved.length };
  }

  function moveSelectionToNewCard(entries, draft) {
    const tabId = state.data.tabs.some((tab) => tab.id === draft.targetTabId && tab.id !== "all") ? draft.targetTabId : defaultTabId(state);
    const time = nowIso();
    const moved = entries
      .map(({ card, item }) => {
        const current = card.items.find((line) => line.id === item.id);
        return current ? { card, item: current } : null;
      })
      .filter(Boolean);
    if (!moved.length) return null;
    removeMovedFromSources(moved, time);
    const title = String(draft.targetTitle || "").trim() || moveTitle(entries);
    const card = makeCard({
      title,
      tabId,
      description: "",
      tags: [],
      items: moved.map(({ item }, index) => ({ ...item, order: index + 1, updatedAt: time }))
    });
    state.data.cards.unshift(card);
    return { target: card, movedCount: moved.length };
  }

  function confirmSelectionMove() {
    const entries = selectedEntriesInView();
    const draft = state.selectionMoveDraft || {};
    if (!entries.length) {
      notify("이동할 줄을 선택하세요");
      return false;
    }
    const result = draft.mode === "new-card"
      ? moveSelectionToNewCard(entries, draft)
      : moveSelectionToCard(entries, draft.targetCardId);
    if (!result?.target) {
      notify("이동할 대상을 선택하세요");
      return false;
    }
    if (!result.movedCount) {
      notify("이미 대상 카드에 있습니다");
      return false;
    }
    finishSelectionMove(result.target, result.movedCount);
    return true;
  }

  return {
    selectedItemsInView,
    copySelectedInView,
    clearSelection,
    groupSelectedInView,
    startSelectionMove,
    updateSelectionMoveMode,
    updateSelectionMoveTarget,
    updateSelectionMoveQuery,
    updateSelectionMoveTab,
    updateSelectionMoveTitle,
    cancelSelectionMove,
    confirmSelectionMove
  };
}
