import { ITEM_TYPES } from "../domain.js";
import { icon } from "./icons.js";
import { renderLineValueHtml } from "./lineValueView.js";
import { escapeAttr, escapeHtml, formatDateTime } from "./utils.js";

export function renderLineEditorModal(state, tabNameForCard) {
  if (!state.editingLineKey || !state.lineEditDraft) return "";
  const [cardId, lineId] = state.editingLineKey.split(":");
  const card = state.data.cards.find((entry) => entry.id === cardId);
  const item = card?.items.find((line) => line.id === lineId);
  if (!card || !item) return "";
  const draft = state.lineEditDraft;
  const lineUpdated = item.updatedAt ? (item.updatedAt === item.createdAt ? "아직 수정 없음" : formatDateTime(item.updatedAt)) : "기록 없음";
  return `
    <aside class="panel line-editor-panel">
      <header class="panel-head">
        <div>
          <h2>줄 상세 수정</h2>
          <p class="panel-note" title="${escapeAttr(`${tabNameForCard(card)} · ${card.title}`)}">${escapeHtml(tabNameForCard(card))} · ${escapeHtml(card.title)}</p>
        </div>
        <button type="button" data-action="cancel-line-edit">닫기</button>
      </header>
      <div class="line-editor-grid">
        <label>라벨<input data-line-edit-field="label" value="${escapeAttr(draft.label || "")}" placeholder="라벨" /></label>
        <label>타입<select data-line-edit-field="type">${ITEM_TYPES.map((type) => `<option value="${type}" ${type === draft.type ? "selected" : ""}>${type}</option>`).join("")}</select></label>
        <label class="line-editor-group">세트<input data-line-edit-field="group" value="${escapeAttr(draft.group || "")}" placeholder="예: MS Graph 인증" /></label>
        <label>유효기간<input type="date" data-line-edit-field="expiresAt" value="${escapeAttr(draft.expiresAt || "")}" /></label>
        <label class="line-editor-value">값<textarea data-line-edit-value data-line-edit-field="value" rows="9" placeholder="복사할 값" ${draft.type === "divider" ? "readonly" : ""}>${escapeHtml(draft.value || "")}</textarea></label>
        ${draft.type === "image" ? `<div class="line-editor-preview">${renderLineValueHtml(draft, { revealed: true })}</div>` : ""}
      </div>
      <details class="line-history-details">
        <summary>마지막 수정 · ${escapeHtml(lineUpdated)} · 기록 보기</summary>
        <dl class="line-history">
          <div><dt>카드 생성</dt><dd>${formatDateTime(card.createdAt)}</dd></div>
          <div><dt>카드 수정</dt><dd>${formatDateTime(card.updatedAt)}</dd></div>
          <div><dt>줄 생성</dt><dd>${formatDateTime(item.createdAt)}</dd></div>
          <div><dt>줄 수정</dt><dd>${lineUpdated}</dd></div>
        </dl>
      </details>
      <div class="line-editor-actions sticky-actions">
        <button type="button" class="danger" data-action="delete-line" data-card="${card.id}" data-id="${item.id}">${icon("trash")} 삭제</button>
        <span></span>
        <button type="button" data-action="cancel-line-edit">취소</button>
        <button type="button" class="primary" data-action="save-line-edit">저장</button>
      </div>
    </aside>
  `;
}
