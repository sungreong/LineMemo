import {
  ITEM_TYPES,
  allTags,
  formatTags,
  getBlocks,
  parseSearchQuery,
  parseTags,
  searchCards,
  sortedItems
} from "../domain.js";
import { renderEditableCell as renderCell } from "./editableCell.js";
import { icon } from "./icons.js";
import { escapeAttr, escapeHtml, formatDateTime } from "./utils.js";
import { activeTabFilter, defaultTabId, isAllTabsActive, isTabActive, selectedTabIds } from "../state/tabs.js";

const REQUIRED_RENDERER_DEPS = {
  app: "object",
  state: "object",
  bindEvents: "function",
  clampManagerPage: "function",
  renderManagerPager: "function",
  selectedItemsForCard: "function"
};

function assertRendererDeps(ctx) {
  for (const [key, type] of Object.entries(REQUIRED_RENDERER_DEPS)) {
    if (!ctx?.[key] || typeof ctx[key] !== type) {
      throw new Error(`Missing renderer dependency: ${key}`);
    }
  }
}

export function createRenderers(ctx) {
  assertRendererDeps(ctx);
  const { app, state, bindEvents, clampManagerPage, renderManagerPager, selectedItemsForCard } = ctx;
  const renderEditableCell = (options) => renderCell({ state, ...options });

function copyIcon(key) {
  return state.lastCopiedKey === key ? icon("check") : icon("copy");
}

function render() {
  const cards = searchCards(state.data, activeTabFilter(state), state.query).sort((a, b) => {
    if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });

  app.innerHTML = `
    <main class="shell ${state.activePanel ? "has-panel" : ""} ${state.denseMode ? "dense" : ""}">
      <section class="workspace">
        ${renderWarning()}
        <header class="toolbar">
          <div class="brand">
            <strong>LineMemo</strong>
            <span>Lite</span>
          </div>
          <input id="search" class="search" placeholder="검색어 또는 #태그 여러 개..." value="${escapeAttr(state.query)}" />
          <div class="toolbar-actions">
            <button type="button" class="primary primary-action" data-action="open-panel" data-panel="quick" title="빠른 입력" aria-label="빠른 입력">${icon("input")}<span class="primary-action-text">빠른 입력</span></button>
            <button type="button" class="icon-button" data-action="new-card" title="새 카드" aria-label="새 카드">${icon("plus")}</button>
            ${renderViewSwitch()}
            <button type="button" class="icon-button ${state.activePanel === "tabs" ? "active-toggle" : ""}" data-action="open-panel" data-panel="tabs" title="Tabs" aria-label="Tabs 열기">${icon("folder")}</button>
            <button type="button" class="icon-button ${state.activePanel === "tags" ? "active-toggle" : ""}" data-action="open-panel" data-panel="tags" title="Tags" aria-label="Tags 열기">${icon("tag")}</button>
            <button type="button" class="icon-button ${state.activePanel === "settings" ? "active-toggle" : ""}" data-action="open-panel" data-panel="settings" title="Settings" aria-label="Settings 열기">${icon("settings")}</button>
          </div>
        </header>
        <nav class="tabs">${state.data.tabs.map(renderTab).join("")}</nav>
        ${renderTagFilters()}
        <section class="content">
          <div class="cards">
            <div class="list-meta" title="${cards.length} cards · ${state.data.cards.length} total">${cards.length}/${state.data.cards.length}</div>
            ${cards.length ? (state.viewMode === "table" ? renderTableView(cards) : cards.map(renderCard).join("")) : renderEmpty()}
          </div>
        </section>
        ${renderSelectionBar(cards)}
        ${renderModalPanel()}
        ${renderDuplicateConflict()}
      </section>
      ${state.toast ? `<div class="toast">${escapeHtml(state.toast)}</div>` : ""}
    </main>
  `;
  bindEvents();
}

function renderViewSwitch() {
  const mode = state.viewMode === "table" ? "table" : (state.denseMode ? "dense" : "cards");
  const options = [
    ["cards", "카드 보기", "cards"],
    ["dense", "밀집 보기", "compact"],
    ["table", "표 보기", "table"]
  ];
  return `
    <div class="view-switch" role="group" aria-label="보기 방식">
      ${options.map(([value, label, iconName]) => `
        <button type="button" class="icon-button ${mode === value ? "active-toggle" : ""}" data-action="set-view" data-mode="${value}" title="${label}" aria-label="${label}" aria-pressed="${mode === value}">${icon(iconName)}</button>
      `).join("")}
    </div>
  `;
}

function renderSelectionBar(cards) {
  const selected = selectedItemsInCards(cards);
  if (!selected.length) return "";
  return `
    <div class="selection-bar" role="status">
      <strong>${selected.length}줄 선택됨</strong>
      <button type="button" class="primary" data-action="copy-selected-global">${icon("copy")} 값 복사</button>
      <button type="button" data-action="copy-selected-global-labels">라벨 포함</button>
      <button type="button" data-action="clear-selection">선택 해제</button>
    </div>
  `;
}

function selectedItemsInCards(cards) {
  return cards.flatMap((card) => selectedItemsForCard(card));
}

function renderTableView(cards) {
  const showTabColumn = isAllTabsActive(state) || selectedTabIds(state).length > 1;
  const rows = cards
    .flatMap((card) => sortedItems(card.items)
      .filter((item) => item.type !== "divider")
      .map((item) => ({ card, item })))
    .sort((a, b) => {
      const result = a.card.title.localeCompare(b.card.title, "ko");
      return state.tableSortAsc ? result : -result;
    });

  if (!rows.length) return `<section class="line-table ${showTabColumn ? "with-tabs" : "single-tab"}">${renderTableHead(showTabColumn)}${renderTableQuickAdd(cards, showTabColumn)}</section><section class="empty compact-empty"><h2>표시할 줄이 없습니다.</h2></section>`;
  return `
    <section class="line-table ${showTabColumn ? "with-tabs" : "single-tab"}">
      ${renderTableHead(showTabColumn)}
      ${rows.map(({ card, item }) => renderTableRow(card, item, showTabColumn)).join("")}
      ${renderTableQuickAdd(cards, showTabColumn)}
    </section>
  `;
}

function renderTableHead(showTabColumn) {
  return `
    <div class="table-head">
      ${showTabColumn ? "<span>탭</span>" : ""}
      <button type="button" class="sort-button" data-action="toggle-table-sort" title="카드명 정렬">카드 ${icon(state.tableSortAsc ? "arrowUp" : "arrowDown")}</button>
      <span>라벨</span>
      <span>값</span>
      <span class="table-action-head">액션</span>
    </div>
  `;
}

function renderTableRow(card, item, showTabColumn) {
  const revealed = !item.secret || state.revealed.has(item.id);
  const selected = state.selected.has(`${card.id}:${item.id}`);
  return `
    <div class="table-row ${item.secret ? "secret" : ""} ${selected ? "selected" : ""}">
      ${showTabColumn ? renderEditableCell({ card, field: "tabId", className: "tab-badge", value: card.tabId, display: tabNameForCard(card) }) : ""}
      ${renderEditableCell({ card, field: "title", tag: "strong", value: card.title, display: card.title })}
      ${renderEditableCell({ card, item, field: "label", value: item.label || "", display: item.label || item.type })}
      ${renderEditableCell({ card, item, field: "value", tag: "code", value: item.value, display: revealed ? item.value : "********" })}
      <div class="table-actions">
        <input type="checkbox" title="선택" data-action="select-line" data-card="${card.id}" data-id="${item.id}" ${selected ? "checked" : ""} />
        <button type="button" class="tiny icon-button" data-action="edit-line-detail" data-card="${card.id}" data-id="${item.id}" title="줄 상세 수정" aria-label="줄 상세 수정">${icon("pencil")}</button>
        <button type="button" class="tiny icon-button copy-line ${state.lastCopiedKey === `line:${card.id}:${item.id}` ? "copied" : ""}" data-action="copy-line" data-card="${card.id}" data-id="${item.id}" title="줄 복사" aria-label="줄 복사">${copyIcon(`line:${card.id}:${item.id}`)}</button>
        <button type="button" class="tiny icon-button delete-line-button" data-action="delete-line" data-card="${card.id}" data-id="${item.id}" title="줄 삭제" aria-label="줄 삭제">${icon("trash")}</button>
      </div>
    </div>
  `;
}

function renderTableQuickAdd(cards, showTabColumn) {
  const targetCards = cards;
  if (!targetCards.length) return "";
  if (!state.showTableAdd) {
    return `
      <div class="table-add-footer">
        <button type="button" class="table-add-trigger" data-action="toggle-table-add" title="행 추가" aria-label="행 추가">${icon("plus")} 행 추가</button>
      </div>
    `;
  }
  return `
    <form id="table-add-row" class="table-add-row ${showTabColumn ? "with-tabs" : "single-tab"}" data-table-quick-add>
      <select name="cardId" aria-label="카드 선택">
        ${targetCards.map((card) => `<option value="${card.id}">${escapeHtml(tabNameForCard(card))} · ${escapeHtml(card.title)}</option>`).join("")}
      </select>
      <input class="optional-label" name="lineLabel" placeholder="라벨(선택)" autocomplete="off" />
      <input name="lineValue" placeholder="값 붙여넣기 후 Enter" autocomplete="off" />
      <div class="table-add-actions">
        <label class="secret-toggle"><input type="checkbox" name="lineSecret" /> secret</label>
        <button class="primary icon-button" type="submit" title="줄 추가" aria-label="줄 추가">${icon("plus")}</button>
        <button class="icon-button" type="button" data-action="toggle-table-add" title="행 추가 닫기" aria-label="행 추가 닫기">${icon("chevronDown")}</button>
      </div>
    </form>
  `;
}

function renderInlineCardComposer() {
  const tabName = state.data.tabs.find((tab) => tab.id === defaultTabId(state))?.name || "Inbox";
  return `
    <form class="inline-card-composer" id="inline-card-form">
      <input name="inlineTitle" placeholder="새 카드 제목" autocomplete="off" />
      <input name="inlineTags" data-tag-input placeholder="태그 comma" autocomplete="off" />
      <input name="inlineText" placeholder="${escapeAttr(tabName)}에 값 붙여넣기 후 Enter" autocomplete="off" />
      <button class="primary icon-button" type="submit" title="카드 추가" aria-label="카드 추가">+</button>
      <div class="tag-preview composer-tags" data-tag-preview></div>
    </form>
  `;
}

function renderWarning() {
  if (state.data.settings.acknowledgedPlainTextWarning) return "";
  return `
    <section class="warning">
      <span><strong>평문 저장</strong> · secret은 화면만 숨깁니다. 정말 민감한 값은 전용 보안 도구를 쓰세요.</span>
      <button type="button" data-action="ack-warning">확인</button>
    </section>
  `;
}

function renderTab(tab) {
  const active = isTabActive(state, tab.id) ? "active" : "";
  return `<button type="button" class="tab ${active}" data-action="tab" data-id="${tab.id}" aria-pressed="${active ? "true" : "false"}">${escapeHtml(tab.name)}</button>`;
}

function renderTagFilters() {
  const tags = allTags(state.data);
  if (!tags.length) return "";
  const selectedTags = parseSearchQuery(state.query).tags;
  return `
    <nav class="tag-filters" aria-label="태그 필터">
      ${tags.map((tag) => `<button type="button" class="tag-filter ${selectedTags.includes(tag) ? "active" : ""}" data-action="search-tag" data-tag="${escapeAttr(tag)}">#${escapeHtml(tag)}</button>`).join("")}
    </nav>
  `;
}

function renderCard(card) {
  const blocks = getBlocks(card.items);
  const visibleItems = visiblePreviewItems(card);
  const isCollapsed = state.collapsedCards.has(card.id);
  const lineCount = sortedItems(card.items).filter((item) => item.type !== "divider").length;
  const firstLine = sortedItems(card.items).find((item) => item.type !== "divider");
  const remaining = sortedItems(card.items).filter((item) => item.type !== "divider").length - visibleItems.filter((item) => item.type !== "divider").length;
  return `
    <article class="card ${isCollapsed ? "collapsed" : ""}">
      <header class="card-head">
        <div class="card-title">
          <h2><button type="button" class="collapse-toggle" data-action="toggle-collapse" data-id="${card.id}" title="${isCollapsed ? "펼치기" : "접기"}" aria-label="${isCollapsed ? "펼치기" : "접기"}">${icon(isCollapsed ? "chevronRight" : "chevronDown")}</button>${card.favorite ? `<span class="pin-mark" title="상단 고정">${icon("pin")}</span>` : ""}${renderEditableCell({ card, field: "title", className: "card-title-text", value: card.title, display: card.title })}</h2>
          ${card.description ? `<p>${escapeHtml(card.description)}</p>` : ""}
          <div class="card-meta">${renderEditableCell({ card, field: "tabId", className: "tab-badge", value: card.tabId, display: tabNameForCard(card) })}${renderCardTags(card)}</div>
          ${isCollapsed ? `<p class="collapsed-preview">${lineCount}줄${firstLine ? ` · ${escapeHtml(firstLine.label || firstLine.type)}: ${escapeHtml(firstLine.secret ? "********" : firstLine.value)}` : ""}</p>` : ""}
        </div>
        <div class="card-actions">
          <button type="button" class="icon-button copy-main ${state.lastCopiedKey === `card:${card.id}` ? "copied" : ""}" data-action="copy-card" data-id="${card.id}" title="카드 전체 복사" aria-label="카드 전체 복사">${copyIcon(`card:${card.id}`)}</button>
          <button type="button" class="icon-button delete-card-button" data-action="delete-card" data-id="${card.id}" title="카드 삭제" aria-label="카드 삭제">${icon("trash")}</button>
          <details class="more-menu">
            <summary title="더보기" aria-label="더보기">${icon("more")}</summary>
            <div>
              <button type="button" data-action="edit-card" data-id="${card.id}">수정</button>
              <button type="button" data-action="favorite" data-id="${card.id}">${card.favorite ? "고정 해제" : "상단 고정"}</button>
              <button type="button" data-action="copy-card-labels" data-id="${card.id}">라벨 포함 복사</button>
            </div>
          </details>
        </div>
      </header>
      ${isCollapsed ? "" : `
        <div class="preview-list">
          ${visibleItems.length ? visibleItems.map((item) => renderPreviewLine(card, item)).join("") : renderEmptyCardPreview(card)}
        </div>
        ${renderQuickLineForm(card)}
        <footer class="card-foot">
          ${remaining > 0 ? `<button type="button" class="text-button" data-action="toggle-expand" data-id="${card.id}">${state.expandedCards.has(card.id) ? "접기" : `+ ${remaining}줄 펼치기`}</button>` : `<span></span>`}
          <div class="block-actions">
            ${blocks.length > 1 ? blocks.map((_, index) => `<button type="button" data-action="copy-block" data-card="${card.id}" data-index="${index}">블록 ${index + 1}</button>`).join("") : ""}
          </div>
        </footer>
      `}
    </article>
  `;
}

function renderCardTags(card) {
  const tags = parseTags(card.tags);
  if (!tags.length) return "";
  return `<div class="card-tags">${tags.map((tag) => `<button type="button" class="tag-chip" data-action="search-tag" data-tag="${escapeAttr(tag)}">#${escapeHtml(tag)}</button>`).join("")}</div>`;
}

function renderTabBadge(card) {
  return `<button type="button" class="tab-badge" data-action="tab" data-id="${card.tabId}" title="${escapeAttr(tabNameForCard(card))} 탭">${escapeHtml(tabNameForCard(card))}</button>`;
}

function tabNameForCard(card) {
  return state.data.tabs.find((tab) => tab.id === card.tabId)?.name || "Inbox";
}

function visiblePreviewItems(card) {
  const items = sortedItems(card.items);
  if (state.expandedCards.has(card.id)) return items;
  let count = 0;
  const result = [];
  for (const item of items) {
    if (item.type !== "divider") count += 1;
    if (count > 5) break;
    result.push(item);
  }
  return result;
}

function renderPreviewLine(card, item) {
  if (item.type === "divider") return `<div class="preview-divider"></div>`;
  const revealed = !item.secret || state.revealed.has(item.id);
  const value = revealed ? item.value : "********";
  return `
    <div class="preview-row ${item.secret ? "secret" : ""} ${state.selected.has(`${card.id}:${item.id}`) ? "selected" : ""}">
      <input type="checkbox" title="선택" data-action="select-line" data-card="${card.id}" data-id="${item.id}" ${state.selected.has(`${card.id}:${item.id}`) ? "checked" : ""} />
      ${renderEditableCell({ card, item, field: "label", className: "line-label", value: item.label || "", display: item.label || item.type })}
      ${renderEditableCell({ card, item, field: "value", tag: "code", className: "line-value", value: item.value, display: value })}
      <div class="preview-actions">
        <button type="button" class="tiny icon-button" data-action="edit-line-detail" data-card="${card.id}" data-id="${item.id}" title="줄 상세 수정" aria-label="줄 상세 수정">${icon("pencil")}</button>
        ${item.secret ? `<button type="button" class="tiny icon-button" data-action="reveal" data-id="${item.id}" title="${revealed ? "숨김" : "표시"}" aria-label="${revealed ? "숨김" : "표시"}">${icon(revealed ? "eyeOff" : "eye")}</button>` : ""}
        <button type="button" class="tiny icon-button copy-line ${state.lastCopiedKey === `line:${card.id}:${item.id}` ? "copied" : ""}" data-action="copy-line" data-card="${card.id}" data-id="${item.id}" title="줄 복사" aria-label="줄 복사">${copyIcon(`line:${card.id}:${item.id}`)}</button>
        <button type="button" class="tiny icon-button delete-line-button" data-action="delete-line" data-card="${card.id}" data-id="${item.id}" title="줄 삭제" aria-label="줄 삭제">${icon("trash")}</button>
      </div>
    </div>
  `;
}

function renderInlineLineEditor(card, item, mode) {
  const draft = state.lineEditDraft || item;
  if (mode === "table") {
    return `
      <div class="table-row line-edit-row table-line-edit-row">
        <strong>${escapeHtml(card.title)}</strong>
        ${renderTabBadge(card)}
        <input data-line-edit-field="label" value="${escapeAttr(draft.label || "")}" placeholder="라벨" />
        <div class="line-edit-value-group">
          <input data-line-edit-value data-line-edit-field="value" value="${escapeAttr(draft.value || "")}" placeholder="값" ${draft.type === "divider" ? "readonly" : ""} />
          <select data-line-edit-field="type" aria-label="타입">${ITEM_TYPES.map((type) => `<option value="${type}" ${type === draft.type ? "selected" : ""}>${type}</option>`).join("")}</select>
          <label class="check line-secret"><input type="checkbox" data-line-edit-field="secret" ${draft.secret ? "checked" : ""} /> secret</label>
        </div>
        <div class="table-actions line-edit-actions">
          <button type="button" class="tiny primary" data-action="save-line-edit">저장</button>
          <button type="button" class="tiny" data-action="cancel-line-edit">취소</button>
          <button type="button" class="tiny danger" data-action="delete-line" data-card="${card.id}" data-id="${item.id}">삭제</button>
        </div>
      </div>
    `;
  }
  return `
    <div class="${mode === "table" ? "table-row" : "preview-row"} line-edit-row">
      <input data-line-edit-field="label" value="${escapeAttr(draft.label || "")}" placeholder="라벨" />
      <input data-line-edit-value data-line-edit-field="value" value="${escapeAttr(draft.value || "")}" placeholder="값" ${draft.type === "divider" ? "readonly" : ""} />
      <select data-line-edit-field="type">${ITEM_TYPES.map((type) => `<option value="${type}" ${type === draft.type ? "selected" : ""}>${type}</option>`).join("")}</select>
      <label class="check line-secret"><input type="checkbox" data-line-edit-field="secret" ${draft.secret ? "checked" : ""} /> secret</label>
      <button type="button" class="tiny primary" data-action="save-line-edit">저장</button>
      <button type="button" class="tiny" data-action="cancel-line-edit">취소</button>
      <button type="button" class="tiny danger" data-action="delete-line" data-card="${card.id}" data-id="${item.id}">삭제</button>
    </div>
  `;
}

function renderEmptyCardPreview(card) {
  return `
    <div class="empty-preview">
      <span>아직 줄이 없습니다. 아래에 값을 바로 추가하세요.</span>
    </div>
  `;
}

function renderQuickLineForm(card) {
  return `
    <form class="quick-line-form" data-quick-line-form data-card="${card.id}">
      <input name="lineValue" placeholder="값 붙여넣기 후 Enter" autocomplete="off" />
      <input class="optional-label" name="lineLabel" placeholder="라벨(선택)" autocomplete="off" />
      <label class="secret-toggle"><input type="checkbox" name="lineSecret" /> secret</label>
      <button class="icon-button" type="submit" title="줄 추가" aria-label="줄 추가">${icon("plus")}</button>
    </form>
  `;
}

function renderActivePanel() {
  if (state.activePanel === "quick") return renderQuickPaste();
  if (state.activePanel === "tabs") return renderTabManager();
  if (state.activePanel === "tags") return renderTagManager();
  if (state.activePanel === "settings") return renderSettings();
  if (state.activePanel === "editor") return renderEditor();
  if (state.activePanel === "line-editor") return renderLineEditorModal();
  return "";
}

function renderModalPanel() {
  const panel = renderActivePanel();
  if (!panel) return "";
  const labels = { quick: "빠른 입력", tabs: "Tabs", tags: "Tags", settings: "Settings", editor: "카드 편집", "line-editor": "줄 편집" };
  return `<div class="modal-backdrop" data-action="close-panel" role="presentation"><div class="modal-sheet" role="dialog" aria-modal="true" aria-label="${escapeAttr(labels[state.activePanel] || "패널")}">${panel}</div></div>`;
}

function renderDuplicateConflict() {
  const conflict = state.duplicateConflict;
  if (!conflict) return "";
  return `
    <div class="modal-backdrop conflict-backdrop">
      <aside class="panel conflict-panel">
        <header class="panel-head">
          <div>
            <h2>같은 값이 이미 있습니다</h2>
            <p class="panel-note">${conflict.total}개 위치에서 발견됐습니다.</p>
          </div>
          <button type="button" data-action="duplicate-cancel">닫기</button>
        </header>
        <div class="conflict-list">
          ${conflict.matches.map((match, index) => `
            <button type="button" class="conflict-row" data-action="duplicate-go" data-index="${index}" title="기존 위치 보기">
              <span class="tab-badge">${escapeHtml(match.tabName)}</span>
              <strong>${escapeHtml(match.cardTitle)}</strong>
              <span>${escapeHtml(match.label)}</span>
              <code>${escapeHtml(match.value)}</code>
            </button>
          `).join("")}
        </div>
        <footer class="conflict-actions">
          <button type="button" data-action="duplicate-cancel">취소</button>
          <button type="button" data-action="duplicate-go" data-index="0">기존 위치 보기</button>
          <button type="button" class="primary" data-action="duplicate-keep">그래도 추가</button>
        </footer>
      </aside>
    </div>
  `;
}

function renderQuickPaste() {
  const tabName = state.data.tabs.find((tab) => tab.id === defaultTabId(state))?.name || "Inbox";
  return `
    <aside class="panel quick-panel">
      <form id="quick-form">
        <header class="panel-head">
          <h2>빠른 입력</h2>
          <button type="button" data-action="open-panel" data-panel="quick">닫기</button>
        </header>
        <p class="panel-note">${escapeHtml(tabName)} 탭에 저장됩니다.</p>
        <label>제목<input name="quickTitle" placeholder="비워두면 첫 줄로 제목 생성" /></label>
        <label>태그<input name="quickTags" data-tag-input placeholder="apikey, 비밀번호, prod" /></label>
        <div class="tag-preview" data-tag-preview></div>
        <label>내용<textarea name="quickText" rows="9" placeholder="여러 줄을 붙여넣으세요&#10;---&#10;블록도 자동으로 나뉩니다" required></textarea></label>
        <button class="primary" type="submit">카드 만들기</button>
      </form>
    </aside>
  `;
}

function renderLineEditorModal() {
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
          <p class="panel-note">${escapeHtml(tabNameForCard(card))} · ${escapeHtml(card.title)}</p>
        </div>
        <button type="button" data-action="cancel-line-edit">닫기</button>
      </header>
      <dl class="line-history">
        <div><dt>카드 생성</dt><dd>${formatDateTime(card.createdAt)}</dd></div>
        <div><dt>카드 수정</dt><dd>${formatDateTime(card.updatedAt)}</dd></div>
        <div><dt>줄 생성</dt><dd>${formatDateTime(item.createdAt)}</dd></div>
        <div><dt>줄 수정</dt><dd>${lineUpdated}</dd></div>
      </dl>
      <div class="line-editor-grid">
        <label>라벨<input data-line-edit-field="label" value="${escapeAttr(draft.label || "")}" placeholder="라벨" /></label>
        <label>타입<select data-line-edit-field="type">${ITEM_TYPES.map((type) => `<option value="${type}" ${type === draft.type ? "selected" : ""}>${type}</option>`).join("")}</select></label>
        <label class="line-editor-value">값<textarea data-line-edit-value data-line-edit-field="value" rows="5" placeholder="복사할 값" ${draft.type === "divider" ? "readonly" : ""}>${escapeHtml(draft.value || "")}</textarea></label>
        <label class="check"><input type="checkbox" data-line-edit-field="secret" ${draft.secret ? "checked" : ""} /> secret</label>
      </div>
      <div class="line-editor-actions">
        <button type="button" class="danger" data-action="delete-line" data-card="${card.id}" data-id="${item.id}">${icon("trash")} 삭제</button>
        <span></span>
        <button type="button" data-action="cancel-line-edit">취소</button>
        <button type="button" class="primary" data-action="save-line-edit">저장</button>
      </div>
    </aside>
  `;
}

function renderTabManager() {
  const totalStats = tabStats("all");
  const filters = managerFilters();
  const entries = filteredTabEntries(filters);
  const pageState = clampManagerPage("tabs", entries.length);
  const visibleTabs = entries.slice(pageState.start, pageState.end);
  return `
    <aside class="panel">
      <header class="panel-head">
        <h2>탭 관리</h2>
        <div class="manager-head-actions">
          <button type="button" class="compact primary" data-action="new-tab">${icon("plus")} 탭</button>
          <button type="button" data-action="open-panel" data-panel="tabs">닫기</button>
        </div>
      </header>
      <div class="tab-stats-summary">
        <strong>전체</strong>
        <span>${totalStats.cards} cards · ${totalStats.items} lines</span>
      </div>
      <div class="manager-tools">
        <input data-manager-field="tabQuery" value="${escapeAttr(filters.tabQuery)}" placeholder="탭 검색" />
        <select data-manager-field="tabVisibility" aria-label="탭 필터">
          ${[
            ["all", "전체"],
            ["cards", "카드 있음"],
            ["lines", "라인 있음"],
            ["empty", "빈 탭"]
          ].map(([value, label]) => `<option value="${value}" ${filters.tabVisibility === value ? "selected" : ""}>${label}</option>`).join("")}
        </select>
        <select data-manager-field="tabSort" aria-label="탭 정렬">
          ${[
            ["order", "기본 순서"],
            ["updated", "최근 업데이트"],
            ["cards", "카드 많은 순"],
            ["lines", "라인 많은 순"],
            ["name", "이름순"]
          ].map(([value, label]) => `<option value="${value}" ${filters.tabSort === value ? "selected" : ""}>${label}</option>`).join("")}
        </select>
      </div>
      <div class="tab-manager">
        ${visibleTabs.length ? visibleTabs.map(({ tab, stats }) => {
          const active = isTabActive(state, tab.id);
          return `
          <div class="tab-edit-row ${active ? "active" : ""}" data-action="manager-select-tab" data-id="${tab.id}" role="button" tabindex="0" title="${escapeAttr(tab.name)} 탭 보기">
            <span>${escapeHtml(tab.name)}</span>
            <small>${stats.cards} cards · ${stats.items} lines</small>
            <div class="manager-row-actions" data-action="noop">
              <button type="button" class="icon-button" data-action="tab-up" data-id="${tab.id}" title="위로" aria-label="위로" ${tab.system ? "disabled" : ""}>${icon("arrowUp")}</button>
              <button type="button" class="icon-button" data-action="tab-down" data-id="${tab.id}" title="아래로" aria-label="아래로" ${tab.system ? "disabled" : ""}>${icon("arrowDown")}</button>
              <button type="button" class="icon-button" data-action="tab-rename" data-id="${tab.id}" title="이름 수정" aria-label="이름 수정" ${tab.system ? "disabled" : ""}>${icon("pencil")}</button>
              <button type="button" class="icon-button danger" data-action="tab-delete" data-id="${tab.id}" title="삭제" aria-label="삭제" ${tab.system ? "disabled" : ""}>${icon("trash")}</button>
            </div>
          </div>
        `;
        }).join("") : `<p class="panel-note">조건에 맞는 탭이 없습니다.</p>`}
      </div>
      ${renderManagerPager("tabs", entries.length)}
    </aside>
  `;
}

function managerFilters() {
  return {
    tabQuery: "",
    tabVisibility: "all",
    tabSort: "order",
    tagQuery: "",
    tagSort: "name",
    ...(state.managerFilters || {})
  };
}

function filteredTabEntries(filters) {
  const query = filters.tabQuery.trim().toLocaleLowerCase();
  const entries = state.data.tabs
    .map((tab) => ({ tab, stats: tabStats(tab.id), updatedAt: tabUpdatedAt(tab.id) }))
    .filter(({ tab, stats }) => {
      if (query && !tab.name.toLocaleLowerCase().includes(query)) return false;
      if (filters.tabVisibility === "cards" && stats.cards <= 0) return false;
      if (filters.tabVisibility === "lines" && stats.items <= 0) return false;
      if (filters.tabVisibility === "empty" && (stats.cards > 0 || stats.items > 0)) return false;
      return true;
    });
  return entries.sort((a, b) => sortManagerEntries(a, b, filters.tabSort, "tab"));
}

function tabUpdatedAt(tabId) {
  const cards = tabId === "all" ? state.data.cards : state.data.cards.filter((card) => card.tabId === tabId);
  return Math.max(0, ...cards.map((card) => Date.parse(card.updatedAt || card.createdAt || "") || 0));
}

function sortManagerEntries(a, b, sort, kind) {
  if (sort === "updated") return b.updatedAt - a.updatedAt;
  if (sort === "cards") return b.stats.cards - a.stats.cards || nameForEntry(a, kind).localeCompare(nameForEntry(b, kind), "ko");
  if (sort === "lines") return b.stats.items - a.stats.items || nameForEntry(a, kind).localeCompare(nameForEntry(b, kind), "ko");
  if (sort === "name") return nameForEntry(a, kind).localeCompare(nameForEntry(b, kind), "ko");
  return kind === "tab" ? a.tab.order - b.tab.order : nameForEntry(a, kind).localeCompare(nameForEntry(b, kind), "ko");
}

function nameForEntry(entry, kind) {
  return kind === "tab" ? entry.tab.name : entry.tag;
}

function tabStats(tabId) {
  const cards = tabId === "all" ? state.data.cards : state.data.cards.filter((card) => card.tabId === tabId);
  return {
    cards: cards.length,
    items: cards.reduce((sum, card) => sum + sortedItems(card.items).filter((item) => item.type !== "divider").length, 0)
  };
}

function tagStats() {
  return allTags(state.data).map((tag) => {
    const cards = state.data.cards.filter((card) => parseTags(card.tags).includes(tag));
    return {
      tag,
      cards: cards.length,
      items: cards.reduce((sum, card) => sum + sortedItems(card.items).filter((item) => item.type !== "divider").length, 0)
    };
  });
}

function renderTagManager() {
  const filters = managerFilters();
  const stats = filteredTagStats(filters);
  const pageState = clampManagerPage("tags", stats.length);
  const visibleStats = stats.slice(pageState.start, pageState.end);
  const allStats = tagStats();
  const selectedTags = parseSearchQuery(state.query).tags;
  const totalTaggedCards = new Set(state.data.cards.filter((card) => parseTags(card.tags).length).map((card) => card.id)).size;
  const totalLines = state.data.cards
    .filter((card) => parseTags(card.tags).length)
    .reduce((sum, card) => sum + sortedItems(card.items).filter((item) => item.type !== "divider").length, 0);
  return `
    <aside class="panel tag-manager-panel">
      <header class="panel-head">
        <h2>태그 관리</h2>
        <button type="button" data-action="open-panel" data-panel="tags">닫기</button>
      </header>
      <div class="tab-stats-summary">
        <strong>태그 ${allStats.length}</strong>
        <span>${totalTaggedCards} cards · ${totalLines} lines</span>
      </div>
      <div class="manager-tools tag-manager-tools">
        <input data-manager-field="tagQuery" value="${escapeAttr(filters.tagQuery)}" placeholder="태그 검색" />
        <select data-manager-field="tagSort" aria-label="태그 정렬">
          ${[
            ["name", "이름순"],
            ["cards", "카드 많은 순"],
            ["lines", "라인 많은 순"]
          ].map(([value, label]) => `<option value="${value}" ${filters.tagSort === value ? "selected" : ""}>${label}</option>`).join("")}
        </select>
      </div>
      <div class="tag-manager">
        ${visibleStats.length ? visibleStats.map((entry) => `
          <div class="tag-edit-row ${selectedTags.includes(entry.tag) ? "active" : ""}" data-action="manager-select-tag" data-tag="${escapeAttr(entry.tag)}" role="button" tabindex="0" title="#${escapeAttr(entry.tag)} 검색">
            <span class="tag-chip">#${escapeHtml(entry.tag)}</span>
            <small>${entry.cards} cards · ${entry.items} lines</small>
            <div class="manager-row-actions" data-action="noop">
              <button type="button" class="icon-button" data-action="tag-rename" data-tag="${escapeAttr(entry.tag)}" title="태그 이름 바꾸기" aria-label="태그 이름 바꾸기">${icon("pencil")}</button>
              <button type="button" class="icon-button danger" data-action="tag-delete" data-tag="${escapeAttr(entry.tag)}" title="태그 삭제" aria-label="태그 삭제">${icon("trash")}</button>
            </div>
          </div>
        `).join("") : `<p class="panel-note">아직 태그가 없습니다.</p>`}
      </div>
      ${renderManagerPager("tags", stats.length)}
    </aside>
  `;
}

function filteredTagStats(filters) {
  const query = filters.tagQuery.trim().replace(/^#/, "").toLocaleLowerCase();
  return tagStats()
    .filter((entry) => !query || entry.tag.toLocaleLowerCase().includes(query))
    .map((entry) => ({ ...entry, stats: { cards: entry.cards, items: entry.items } }))
    .sort((a, b) => sortManagerEntries(a, b, filters.tagSort, "tag"));
}

function renderEditor() {
  if (!state.editingCardId) return "";
  const card = state.data.cards.find((entry) => entry.id === state.editingCardId) || {
    title: "",
    tabId: defaultTabId(state),
    tags: [],
    description: ""
  };
  const draft = state.editorDraft || {
    title: card.title,
    tabId: card.tabId,
    tags: formatTags(card.tags),
    description: card.description,
    quickValues: ""
  };
  const isNew = state.editingCardId === "new";
  const tabField = `<label>탭<select name="tabId">${state.data.tabs.filter((tab) => tab.id !== "all").map((tab) => `<option value="${tab.id}" ${tab.id === draft.tabId ? "selected" : ""}>${escapeHtml(tab.name)}</option>`).join("")}</select></label>`;
  const lineSection = `
    <section class="editor-line-section">
      <div class="editor-line-head">
        <strong>줄 ${state.editorItems.length}</strong>
        <button type="button" class="compact" data-action="add-line">${icon("plus")} 빈 줄</button>
      </div>
      <div class="editor-lines">${state.editorItems.length ? state.editorItems.map(renderEditorLine).join("") : `<p class="panel-note">상세 줄이 필요하면 빈 줄을 추가하세요.</p>`}</div>
    </section>
  `;
  return `
    <aside class="panel editor ${isNew ? "new-card-editor" : ""}">
      <form id="card-form">
        <header class="panel-head">
          <h2>${isNew ? "새 카드" : "카드 수정"}</h2>
          <button type="button" data-action="close-editor">닫기</button>
        </header>
        <div class="editor-top-grid">
          <label>제목<input id="card-title" name="title" value="${escapeAttr(draft.title)}" placeholder="비워두면 첫 줄로 제목 생성" ${isNew ? "" : "required"} /></label>
          ${isNew ? "" : tabField}
        </div>
        <label>태그<input name="tags" data-tag-input value="${escapeAttr(draft.tags)}" placeholder="apikey, 비밀번호, prod" /></label>
        <div class="tag-preview" data-tag-preview>${renderTagPreview(draft.tags)}</div>
        ${isNew ? `<label>값<textarea name="quickValues" rows="3" placeholder="복사할 값을 붙여넣으세요&#10;비밀번호 = 예시값&#10;apikey example-key">${escapeHtml(draft.quickValues || "")}</textarea></label>` : ""}
        <details class="editor-details">
          <summary>설명 · 여러 줄</summary>
          ${isNew ? tabField : ""}
          <label>설명<textarea name="description" rows="2">${escapeHtml(draft.description)}</textarea></label>
          <div class="editor-import">
            <textarea id="paste-area" rows="2" aria-label="여러 줄 붙여넣기" placeholder="여러 줄을 붙여넣고 적용"></textarea>
            <button type="button" data-action="parse-paste">붙여넣기 적용</button>
          </div>
          ${isNew ? lineSection : ""}
        </details>
        ${isNew ? "" : lineSection}
        <div class="sticky-save"><button class="primary" type="submit">${isNew ? "카드 만들기" : "변경 저장"}</button></div>
      </form>
    </aside>
  `;
}

function renderEditorLine(item, index) {
  return `
    <div class="edit-line" data-id="${item.id}">
      <div class="edit-line-grid">
        <span class="edit-line-index">${index + 1}</span>
        <input data-field="label" value="${escapeAttr(item.label)}" placeholder="라벨(선택)" aria-label="라벨" />
        <textarea class="edit-line-value" data-field="value" rows="1" placeholder="복사할 값" aria-label="복사할 값" ${item.type === "divider" ? "readonly" : ""}>${escapeHtml(item.value)}</textarea>
        <select data-field="type">${ITEM_TYPES.map((type) => `<option value="${type}" ${type === item.type ? "selected" : ""}>${type}</option>`).join("")}</select>
        <label class="check secret-inline" title="secret"><input type="checkbox" data-field="secret" ${item.secret ? "checked" : ""} /><span>sec</span></label>
        <div class="edit-line-controls">
          <button type="button" class="icon-button" data-action="line-up" data-id="${item.id}" ${index === 0 ? "disabled" : ""} title="위로" aria-label="위로">${icon("arrowUp")}</button>
          <button type="button" class="icon-button" data-action="line-down" data-id="${item.id}" ${index === state.editorItems.length - 1 ? "disabled" : ""} title="아래로" aria-label="아래로">${icon("arrowDown")}</button>
          <button type="button" class="icon-button danger" data-action="line-delete" data-id="${item.id}" title="삭제" aria-label="삭제">${icon("trash")}</button>
        </div>
      </div>
    </div>
  `;
}

function renderTagPreview(input) {
  const tags = parseTags(input);
  if (!tags.length) return `<span class="tag-preview-empty">comma로 태그를 나눌 수 있습니다</span>`;
  return tags.map((tag) => `<span class="tag-preview-chip">#${escapeHtml(tag)}</span>`).join("");
}

function renderSettings() {
  const s = state.data.settings;
  return `
    <section class="panel settings settings-panel">
      <header class="panel-head">
        <h2>설정</h2>
        <button type="button" data-action="open-panel" data-panel="settings">닫기</button>
      </header>
      <section class="settings-section">
        <h3>동작</h3>
        <label class="check"><input type="checkbox" data-setting="rememberLastTab" ${s.rememberLastTab ? "checked" : ""} /> 마지막 탭 기억</label>
        <label class="check"><input type="checkbox" data-setting="autoClearClipboard" ${s.autoClearClipboard ? "checked" : ""} /> 복사 후 클립보드 자동 삭제</label>
        <label>클립보드 삭제 대기
          <select data-setting="clipboardClearSeconds" ${s.autoClearClipboard ? "" : "disabled"}>
            ${[10, 30, 60].map((v) => `<option value="${v}" ${Number(s.clipboardClearSeconds) === v ? "selected" : ""}>${v}초</option>`).join("")}
          </select>
        </label>
      </section>
      <section class="settings-section">
        <h3>보안 표시</h3>
        <label>비밀값 표시 시간
          <div class="suffix-input"><input type="number" min="3" max="120" data-setting="secretRevealSeconds" value="${escapeAttr(s.secretRevealSeconds)}" /><span>초</span></div>
        </label>
      </section>
      <section class="settings-section">
        <h3>데이터</h3>
        <div class="path-box">
          <span>저장 위치</span>
          <code>${escapeHtml(state.dataPath)}</code>
          <button type="button" class="icon-button" data-action="copy-path" title="경로 복사" aria-label="경로 복사">${state.lastCopiedKey === "settings:path" ? icon("check") : icon("copy")}</button>
        </div>
        <div class="backup-actions">
          <button type="button" class="backup-button" data-action="export">${icon("download")} 백업 내보내기</button>
          <label class="file-button backup-button" role="button" tabindex="0">${icon("upload")} 백업 가져오기<input id="import-file" type="file" accept="application/json,.json" /></label>
        </div>
        <p class="panel-note">가져오기는 현재 데이터를 백업한 뒤 JSON 데이터로 교체합니다.</p>
      </section>
    </section>
  `;
}

function renderEmpty() {
  return `
    <section class="empty">
      <h2>붙여넣으면 바로 복사할 수 있습니다.</h2>
      <p>여러 줄을 한 번에 넣고, 카드 preview에서 필요한 줄만 복사하세요.</p>
      <button type="button" class="primary" data-action="open-panel" data-panel="quick">빠른 입력</button>
    </section>
  `;
}


  return { render, renderTagPreview, tabNameForCard };
}

