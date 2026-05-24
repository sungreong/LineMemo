import { applyBaseLabelToItems, applyExpiryToItems, makeCard, nowIso, parsePasteItems, parseTags, sortedItems, stampLine } from "../domain.js";
import { defaultTabId, syncActiveTabs } from "../state/tabs.js";

function tabNameForCard(state, card) {
  return state.data.tabs.find((tab) => tab.id === card.tabId)?.name || "Inbox";
}

function cardName(card) {
  return /카드$/u.test(card.title) ? card.title : `${card.title} 카드`;
}

function firstMeaningfulLine(items) {
  return sortedItems(items).find((item) => item.type !== "divider")?.value.slice(0, 42);
}

function addItemsToCard(state, card, items) {
  const maxOrder = sortedItems(card.items).at(-1)?.order || 0;
  const time = nowIso();
  card.items.push(...items.map((item, index) => stampLine(item, time, maxOrder + index + 1)));
  card.updatedAt = time;
  state.expandedCards.add(card.id);
  state.collapsedCards.delete(card.id);
}

function focusCard(state, card) {
  syncActiveTabs(state, card.tabId, { single: true });
  state.query = "";
  state.expandedCards.add(card.id);
  state.collapsedCards.delete(card.id);
}

export function createQuickInputActions(ctx) {
  const { state, resolveDuplicatesBeforeAdd, scheduleSave, notify, clearQuickDraft, render } = ctx;

  function submitQuickInput(fields) {
    const raw = String(fields.quickText || "");
    const items = applyExpiryToItems(applyBaseLabelToItems(parsePasteItems(raw, {
      splitMode: fields.quickSplitMode,
      splitPattern: fields.quickSplitPattern
    }), fields.quickBaseLabel), fields.quickExpiresAt);
    if (!items.length) {
      notify("붙여넣을 줄이 없습니다");
      return false;
    }

    const targetCard = state.data.cards.find((card) => card.id === fields.targetCardId);
    if (targetCard) {
      const message = `${tabNameForCard(state, targetCard)} · ${cardName(targetCard)}에 ${items.length}줄 추가됨`;
      if (resolveDuplicatesBeforeAdd(items, { type: "quick-lines", cardId: targetCard.id, items, message, focusTarget: true })) return false;
      addItemsToCard(state, targetCard, items);
      focusCard(state, targetCard);
      state.activePanel = null;
      clearQuickDraft(state);
      scheduleSave();
      notify(message);
      return true;
    }

    const tabId = defaultTabId(state);
    const payload = {
      title: String(fields.quickTitle || "").trim() || String(fields.quickBaseLabel || "").trim() || firstMeaningfulLine(items) || "빠른 메모",
      tabId,
      description: "",
      tags: parseTags(fields.quickTags),
      items
    };
    if (resolveDuplicatesBeforeAdd(items, { type: "quick-paste", payload })) return false;
    const card = makeCard(payload);
    state.data.cards.unshift(card);
    state.collapsedCards.delete(card.id);
    state.activePanel = null;
    clearQuickDraft(state);
    scheduleSave();
    notify("카드 생성됨");
    return true;
  }

  function quickPaste(form) {
    const formData = new FormData(form);
    submitQuickInput({
      quickText: formData.get("quickText"),
      quickTitle: formData.get("quickTitle"),
      quickTags: formData.get("quickTags"),
      quickBaseLabel: formData.get("quickBaseLabel"),
      quickExpiresAt: formData.get("quickExpiresAt"),
      quickSplitMode: formData.get("quickSplitMode"),
      quickSplitPattern: formData.get("quickSplitPattern"),
      targetCardId: formData.get("targetCardId")
    });
  }

  return { quickPaste, submitQuickInput };
}
