import { escapeAttr, escapeHtml } from "./utils.js";

export function cellKey(cardId, lineId, field) {
  return `${cardId}|${lineId || ""}|${field}`;
}

export function renderEditableCell({ state, card, item = null, field, className = "", tag = "span", value, display }) {
  const key = cellKey(card.id, item?.id, field);
  if (state.editingCellKey === key) {
    if (field === "tabId") {
      return `
        <select class="cell-edit-input ${className}" data-cell-edit-input>
          ${state.data.tabs.filter((tab) => tab.id !== "all").map((tab) => `<option value="${tab.id}" ${tab.id === state.cellEditValue ? "selected" : ""}>${escapeHtml(tab.name)}</option>`).join("")}
        </select>
      `;
    }
    return `<input class="cell-edit-input ${className}" data-cell-edit-input value="${escapeAttr(state.cellEditValue)}" />`;
  }
  const attrs = `data-cell-edit data-card="${card.id}" data-id="${escapeAttr(item?.id || "")}" data-field="${field}" title="${escapeAttr(value ?? display ?? "")}"`;
  return `<${tag} class="${className}" ${attrs}>${escapeHtml(display ?? value ?? "")}</${tag}>`;
}
