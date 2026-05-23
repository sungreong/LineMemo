import { escapeAttr, escapeHtml } from "./utils.js";

export function cellKey(cardId, lineId, field) {
  return `${cardId}|${lineId || ""}|${field}`;
}

export function renderEditableCell({ state, card, item = null, field, className = "", tag = "span", value, display, displayHtml = "" }) {
  const key = cellKey(card.id, item?.id, field);
  if (state.editingCellKey === key) {
    if (field === "tabId") {
      return `
        <select class="cell-edit-input ${className}" data-cell-edit-input>
          ${state.data.tabs.filter((tab) => tab.id !== "all").map((tab) => `<option value="${tab.id}" ${tab.id === state.cellEditValue ? "selected" : ""}>${escapeHtml(tab.name)}</option>`).join("")}
        </select>
      `;
    }
    if (field === "value") {
      const rows = Math.min(8, Math.max(2, String(state.cellEditValue || "").split(/\r?\n/).length));
      return `<textarea class="cell-edit-input ${className}" data-cell-edit-input rows="${rows}">${escapeHtml(state.cellEditValue)}</textarea>`;
    }
    return `<input class="cell-edit-input ${className}" data-cell-edit-input value="${escapeAttr(state.cellEditValue)}" />`;
  }
  const maskedSecretValue = field === "value" && item?.secret && !state.revealed?.has?.(item.id);
  const title = maskedSecretValue ? "********" : value ?? display ?? "";
  const attrs = `data-cell-edit data-card="${card.id}" data-id="${escapeAttr(item?.id || "")}" data-field="${field}" title="${escapeAttr(title)}"`;
  const body = displayHtml || escapeHtml(display ?? value ?? "");
  return `<${tag} class="${className}" ${attrs}>${body}</${tag}>`;
}
