import { sortedItems } from "../domain.js";
import { icon } from "./icons.js";
import { escapeAttr, escapeHtml } from "./utils.js";

function findLine(state, cardId, lineId) {
  const card = state.data.cards.find((entry) => entry.id === cardId);
  const item = card?.items.find((line) => line.id === lineId);
  return card && item ? { card, item } : null;
}

function relatedLineItems(card, item) {
  const group = String(item?.group || "").trim();
  if (!group) return [];
  return sortedItems(card.items).filter((entry) => entry.type !== "divider" && String(entry.group || "").trim() === group);
}

function isUrl(item) {
  return item.type === "url" || /^https?:\/\/\S+/i.test(String(item.value || ""));
}

function menuButton(action, iconName, label, card, item, options = {}) {
  return `
    <button type="button" class="${options.danger ? "danger" : ""}" data-line-menu-action="${action}" data-card="${card.id}" data-id="${item.id}" role="menuitem">
      ${icon(iconName)}
      <span>${escapeHtml(label)}</span>
      ${options.meta ? `<small>${escapeHtml(options.meta)}</small>` : ""}
    </button>
  `;
}

export function renderLineContextMenu(state) {
  const menu = state.lineContextMenu;
  if (!state.data.settings.lineContextMenu || !menu) return "";
  const found = findLine(state, menu.cardId, menu.lineId);
  if (!found) return "";
  const { card, item } = found;
  const related = relatedLineItems(card, item);
  const selected = state.selected.has(`${card.id}:${item.id}`);
  const title = item.label || item.type || "줄";
  return `
    <div class="line-context-menu" style="left:${Number(menu.x || 0)}px; top:${Number(menu.y || 0)}px" role="menu" aria-label="줄 빠른 작업">
      <header>
        <strong>${escapeHtml(title)}</strong>
        <span title="${escapeAttr(item.value)}">${escapeHtml(item.secret && !state.revealed.has(item.id) ? "********" : item.value)}</span>
      </header>
      ${menuButton("copy", "copy", "값 복사", card, item, state.data.settings.rightClickCopy ? { meta: "자동" } : {})}
      ${menuButton("copy-label", "label", "라벨 포함 복사", card, item)}
      ${isUrl(item) ? menuButton("open-url", "external", "링크 열기", card, item) : ""}
      <div class="line-context-divider"></div>
      ${menuButton("edit", "pencil", "상세 수정", card, item)}
      ${menuButton("move", "move", "다른 카드로 이동", card, item)}
      ${menuButton("select", selected ? "checkSquare" : "square", selected ? "선택 해제" : "선택", card, item)}
      ${menuButton("secret", item.secret ? "eye" : "key", item.secret ? "비밀 표시 해제" : "비밀값으로 표시", card, item)}
      ${item.secret ? menuButton("reveal", state.revealed.has(item.id) ? "eyeOff" : "eye", state.revealed.has(item.id) ? "다시 숨기기" : "잠시 보기", card, item) : ""}
      ${related.length > 1 ? `
        <div class="line-context-divider"></div>
        ${menuButton("copy-group", "copyStack", `세트 ${related.length}줄 복사`, card, item)}
        ${menuButton("copy-group-tab", "tabCopy", "세트 탭 구분 복사", card, item)}
        ${menuButton("copy-group-next", "rotate", "세트 다음 값 복사", card, item)}
      ` : ""}
      <div class="line-context-divider"></div>
      ${menuButton("delete", "trash", "줄 삭제", card, item, { danger: true })}
    </div>
  `;
}
