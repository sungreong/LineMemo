import { ITEM_TYPES, normalizeDateOnly, normalizeLineValueInput, parseTags, sortedItems } from "./domain.js";

function normalizeType(type) {
  return ITEM_TYPES.includes(type) ? type : "text";
}

function comparableLine(item = {}, index = 0, preserveId = true) {
  const type = normalizeType(item.type);
  return {
    id: preserveId ? String(item.id || "") : "",
    order: Number.isFinite(Number(item.order)) ? Number(item.order) : index + 1,
    label: type === "divider" ? "" : String(item.label || "").trim(),
    value: type === "divider" ? "---" : normalizeLineValueInput(item.value),
    group: type === "divider" ? "" : String(item.group || "").trim(),
    type,
    secret: Boolean(item.secret),
    expiresAt: type === "divider" ? "" : normalizeDateOnly(item.expiresAt)
  };
}

function comparableCard(card) {
  return {
    title: String(card?.title || "제목 없는 카드"),
    tabId: String(card?.tabId || "inbox"),
    description: String(card?.description || ""),
    tags: parseTags(card?.tags).join("\n"),
    items: sortedItems(card?.items).map((item, index) => comparableLine(item, index))
  };
}

export function lineEditHasChanges(item, draft) {
  const current = comparableLine(item, 0, false);
  const next = comparableLine({ ...draft, id: item?.id, order: item?.order }, 0, false);
  return JSON.stringify(current) !== JSON.stringify(next);
}

export function cardPayloadHasChanges(card, payload) {
  return JSON.stringify(comparableCard(card)) !== JSON.stringify(comparableCard(payload));
}
