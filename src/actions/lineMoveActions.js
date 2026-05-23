import { normalizeSearchText, nowIso, sortedItems } from "../domain.js";
import { syncActiveTabs } from "../state/tabs.js";

function firstTargetCard(state, sourceCardId) {
  return state.data.cards.find((card) => card.id !== sourceCardId);
}

function matchingTargetCards(state, sourceCardId, query = "") {
  const needle = normalizeSearchText(query);
  return state.data.cards.filter((card) => {
    if (card.id === sourceCardId) return false;
    const tab = state.data.tabs.find((entry) => entry.id === card.tabId)?.name || "";
    return !needle || normalizeSearchText(`${tab} ${card.title} ${card.description || ""}`).includes(needle);
  });
}

function targetLabel(state, card) {
  const tab = state.data.tabs.find((entry) => entry.id === card.tabId)?.name || "Inbox";
  const name = /카드$/u.test(card.title) ? card.title : `${card.title} 카드`;
  return `${tab} · ${name}`;
}

export function moveLineBetweenCards(state, sourceCardId, lineId, targetCardId, time = nowIso()) {
  const source = state.data.cards.find((card) => card.id === sourceCardId);
  const target = state.data.cards.find((card) => card.id === targetCardId);
  if (!source || !target || source.id === target.id) return null;
  const item = source.items.find((line) => line.id === lineId);
  if (!item) return null;
  source.items = source.items.filter((line) => line.id !== lineId).map((line, index) => ({ ...line, order: index + 1 }));
  const maxOrder = sortedItems(target.items).at(-1)?.order || 0;
  target.items.push({ ...item, order: maxOrder + 1, updatedAt: time });
  source.updatedAt = time;
  target.updatedAt = time;
  return { source, target, item };
}

export function createLineMoveActions(ctx) {
  const { state, scheduleSave, notify, render } = ctx;

  function startLineMove(cardId, lineId) {
    const source = state.data.cards.find((card) => card.id === cardId);
    const item = source?.items.find((line) => line.id === lineId);
    if (!source || !item) return;
    const target = firstTargetCard(state, source.id);
    state.movingLineKey = `${source.id}:${item.id}`;
    state.lineMoveDraft = { targetCardId: target?.id || "", targetQuery: "" };
    state.editingLineKey = null;
    state.lineEditDraft = null;
    state.activePanel = "line-move";
    render();
  }

  function updateLineMoveTarget(targetCardId) {
    state.lineMoveDraft = { ...(state.lineMoveDraft || {}), targetCardId };
    render();
  }

  function updateLineMoveQuery(targetQuery) {
    const [sourceCardId] = String(state.movingLineKey || "").split(":");
    const current = state.lineMoveDraft?.targetCardId || "";
    const targets = matchingTargetCards(state, sourceCardId, targetQuery);
    const targetCardId = targets.some((card) => card.id === current) ? current : targets[0]?.id || "";
    state.lineMoveDraft = { ...(state.lineMoveDraft || {}), targetQuery, targetCardId };
    render();
  }

  function cancelLineMove() {
    state.movingLineKey = null;
    state.lineMoveDraft = null;
    if (state.activePanel === "line-move") state.activePanel = null;
    render();
  }

  function confirmLineMove() {
    const [sourceCardId, lineId] = String(state.movingLineKey || "").split(":");
    const targetCardId = state.lineMoveDraft?.targetCardId || "";
    const result = moveLineBetweenCards(state, sourceCardId, lineId, targetCardId);
    if (!result) {
      notify("이동할 카드를 선택하세요");
      return;
    }
    state.selected.delete(`${sourceCardId}:${lineId}`);
    state.movingLineKey = null;
    state.lineMoveDraft = null;
    state.activePanel = null;
    state.query = "";
    syncActiveTabs(state, result.target.tabId, { single: true });
    state.expandedCards.add(result.target.id);
    state.collapsedCards.delete(result.target.id);
    scheduleSave();
    notify(`${targetLabel(state, result.target)}로 이동됨`);
    render();
  }

  return { startLineMove, updateLineMoveTarget, updateLineMoveQuery, cancelLineMove, confirmLineMove };
}
