import { sortedItems } from "../domain.js";
import { lineTypeLabel } from "./lineValueView.js";
import { escapeAttr, escapeHtml } from "./utils.js";

export function lineGroupName(item) {
  return String(item.group || "").trim();
}

export function relatedLineItems(card, item) {
  const group = lineGroupName(item);
  if (!group) return [];
  return sortedItems(card.items).filter((entry) => entry.type !== "divider" && lineGroupName(entry) === group);
}

export function groupCopyKey(card, item) {
  return `group:${card.id}:${lineGroupName(item)}`;
}

export function renderLineLabelHtml(card, item) {
  const groupItems = relatedLineItems(card, item);
  const label = escapeHtml(item.label || lineTypeLabel(item.type));
  const group = lineGroupName(item);
  return `
    <span class="line-label-text">${label}</span>
    ${group ? `<span class="line-group-chip" title="복사 세트: ${escapeAttr(group)}">${escapeHtml(group)}${groupItems.length > 1 ? ` · ${groupItems.length}` : ""}</span>` : ""}
  `;
}

export function renderCopySetHeader(card, item, seen = new Set(), mode = "card") {
  const group = lineGroupName(item);
  const groupItems = relatedLineItems(card, item);
  const key = `${card.id}:${group}`;
  if (!group || groupItems.length < 2 || seen.has(key)) return "";
  seen.add(key);
  const first = groupItems.slice(0, 3).map((entry) => entry.label || lineTypeLabel(entry.type)).join(" / ");
  return `
    <div class="${mode === "table" ? "table-set-row" : "copy-set-row"}">
      <strong>세트 ${escapeHtml(group)} · ${groupItems.length}줄</strong>
      <span>${escapeHtml(first)}</span>
      <div>
        <button type="button" data-action="copy-line-group" data-card="${card.id}" data-id="${item.id}">전체</button>
        <button type="button" data-action="copy-line-group-tab" data-card="${card.id}" data-id="${item.id}">탭구분</button>
        <button type="button" data-action="copy-line-group-next" data-card="${card.id}" data-id="${item.id}">다음</button>
      </div>
    </div>
  `;
}
