import { sortedItems } from "../domain.js";
import { lineTypeLabel } from "./lineValueView.js";
import { renderExpiryBadge } from "./expiryBadge.js";
import { icon } from "./icons.js";
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

export function setCollapseKey(cardId, groupName) {
  const cardKey = encodeURIComponent(String(cardId || ""));
  const groupKey = encodeURIComponent(String(groupName || "").trim());
  return `set:${cardKey}:${groupKey}`;
}

export function renderLineLabelHtml(card, item) {
  const groupItems = relatedLineItems(card, item);
  const label = escapeHtml(item.label || lineTypeLabel(item.type));
  const group = lineGroupName(item);
  return `
    <span class="line-label-text">${label}</span>
    ${renderExpiryBadge(item)}
    ${group ? `<span class="line-group-chip" title="복사 세트: ${escapeAttr(group)}">${escapeHtml(group)}${groupItems.length > 1 ? ` · ${groupItems.length}` : ""}</span>` : ""}
  `;
}

export function renderCopySetHeader(card, item, seen = new Set(), mode = "card", options = {}) {
  const group = lineGroupName(item);
  const groupItems = relatedLineItems(card, item);
  const key = `${card.id}:${group}`;
  if (!group || groupItems.length < 2 || seen.has(key)) return "";
  seen.add(key);
  const first = groupItems.slice(0, 3).map((entry) => entry.label || lineTypeLabel(entry.type)).join(" / ");
  const collapsible = mode === "table" && options.collapsible !== false;
  const forcedOpen = Boolean(options.isForcedOpenBySearch);
  const collapsed = Boolean(options.isCollapsed) && !forcedOpen;
  const expanded = !collapsed;
  const collapseKey = setCollapseKey(card.id, group);
  const status = forcedOpen ? `<em class="set-search-status">검색 결과 표시 중</em>` : "";
  const summary = collapsed ? `${first} · ${groupItems.length}줄 접힘` : first;
  const toggle = collapsible ? `
        <button type="button" class="set-collapse-toggle" data-action="toggle-set-collapse" data-set-key="${escapeAttr(collapseKey)}" aria-expanded="${expanded}" title="${expanded ? "세트 접기" : "세트 펼치기"}" aria-label="${escapeAttr(`세트 ${group} ${expanded ? "접기" : "펼치기"}`)}">${icon(expanded ? "chevronDown" : "chevronRight")}</button>` : "";
  return `
    <div class="${mode === "table" ? "table-set-row" : "copy-set-row"} ${collapsible ? "is-collapsible" : ""} ${collapsed ? "is-collapsed" : ""} ${forcedOpen ? "search-forced-open" : ""}" data-set-key="${escapeAttr(collapseKey)}">
      ${toggle}
      <strong>세트 ${escapeHtml(group)} · ${groupItems.length}줄</strong>
      <span class="set-summary">${escapeHtml(summary)}${status}</span>
      <div class="set-actions">
        <button type="button" data-action="copy-line-group" data-card="${card.id}" data-id="${item.id}">전체</button>
        <button type="button" data-action="copy-line-group-tab" data-card="${card.id}" data-id="${item.id}">탭구분</button>
        <button type="button" data-action="copy-line-group-next" data-card="${card.id}" data-id="${item.id}">다음</button>
      </div>
    </div>
  `;
}
