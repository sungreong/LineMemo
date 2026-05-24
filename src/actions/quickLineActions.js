import { inferType, normalizeDateOnly, normalizeLineValueInput, nowIso, parseLineParts, sortedItems, stampLine, uid } from "../domain.js";

export function createQuickLineActions(ctx) {
  const { state, resolveDuplicatesBeforeAdd, scheduleSave, notify, clearTableAddDraft, clearQuickLineDraft } = ctx;

  function quickAddLineFromForm(form) {
    const isTableAdd = form.hasAttribute("data-table-quick-add");
    const cardId = form.dataset.card || form.elements.cardId?.value;
    const card = state.data.cards.find((entry) => entry.id === cardId);
    if (!card) {
      notify("카드를 선택하세요");
      return;
    }
    const rawLabel = String(form.elements.lineLabel?.value || "").trim();
    const rawValue = normalizeLineValueInput(form.elements.lineValue?.value);
    if (!rawValue.trim()) {
      notify("추가할 값을 입력하세요");
      return;
    }

    const parsed = parseLineParts(rawValue);
    const label = rawLabel || parsed.label;
    const value = rawLabel || !parsed.label ? rawValue : parsed.value;
    const maxOrder = sortedItems(card.items).at(-1)?.order || 0;
    const item = stampLine({ id: uid("line"), label, value, type: inferType(value), secret: false, expiresAt: normalizeDateOnly(form.elements.lineExpiresAt?.value), order: maxOrder + 1 });
    const pending = { type: "quick-line", cardId, item, draftKind: isTableAdd ? "table" : "quickLine", draftCardId: cardId };
    if (resolveDuplicatesBeforeAdd([item], pending)) return;
    card.items.push(item);
    card.updatedAt = nowIso();
    state.expandedCards.add(card.id);
    state.collapsedCards.delete(card.id);
    if (isTableAdd) clearTableAddDraft(state, cardId);
    else clearQuickLineDraft(state, cardId);
    scheduleSave();
    notify("줄 추가됨");
    queueMicrotask(() => {
      const selector = isTableAdd ? "[data-table-quick-add] [name='lineValue']" : `[data-card="${cardId}"] [name='lineValue']`;
      document.querySelector(selector)?.focus();
    });
  }

  return { quickAddLineFromForm };
}
