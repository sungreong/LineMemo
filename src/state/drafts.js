import { DEFAULT_SPLIT_PATTERN } from "../domain.js";

export function createEmptyDrafts() {
  return {
    quick: { title: "", tags: "", text: "", targetCardId: "", baseLabel: "", group: "", expiresAt: "", splitMode: "line", splitPattern: DEFAULT_SPLIT_PATTERN },
    tableAdd: { cardId: "", lineLabel: "", lineValue: "", lineExpiresAt: "" },
    quickLines: {}
  };
}

export function quickLineDraft(state, cardId) {
  if (!state.drafts.quickLines[cardId]) {
    state.drafts.quickLines[cardId] = { lineLabel: "", lineValue: "", lineExpiresAt: "" };
  }
  return state.drafts.quickLines[cardId];
}

export function clearQuickDraft(state) {
  state.drafts.quick = { title: "", tags: "", text: "", targetCardId: "", baseLabel: "", group: "", expiresAt: "", splitMode: "line", splitPattern: DEFAULT_SPLIT_PATTERN };
}

export function clearTableAddDraft(state, cardId = "") {
  state.drafts.tableAdd = { cardId, lineLabel: "", lineValue: "", lineExpiresAt: "" };
}

export function clearQuickLineDraft(state, cardId) {
  state.drafts.quickLines[cardId] = { lineLabel: "", lineValue: "", lineExpiresAt: "" };
}

export function syncDraftField(target, state) {
  const draft = target.dataset.draft;
  const field = target.dataset.draftField || target.name;
  const value = target.type === "checkbox" ? target.checked : target.value;
  if (draft === "quick") state.drafts.quick[field] = value;
  if (draft === "tableAdd") state.drafts.tableAdd[field] = value;
  if (draft === "quickLine") {
    const cardId = target.closest("[data-card]")?.dataset.card;
    if (cardId) quickLineDraft(state, cardId)[field] = value;
  }
}
