import {
  DEFAULT_SPLIT_PATTERN,
  ITEM_TYPES,
  allTags,
  formatTags,
  getBlocks,
  normalizeSearchText,
  parseSearchQuery,
  parseTags,
  searchCards,
  searchTokens,
  splitPasteText,
  sortedItems
} from "../domain.js";
import { isLockConfigured } from "../security/appLock.js";
import { renderLineMovePanel, renderQuickPastePanel } from "./destinationRenderers.js";
import { applyAppearanceSettings } from "./appearance.js";
import { groupCopyKey, relatedLineItems, renderCopySetHeader, renderLineLabelHtml } from "./copySetRenderers.js";
import { renderEditableCell as renderCell } from "./editableCell.js";
import { icon } from "./icons.js";
import { renderLineContextMenu } from "./lineContextMenu.js";
import { renderLineEditorModal } from "./lineEditorRenderer.js";
import { renderLineValueHtml } from "./lineValueView.js";
import { renderTabManagerPanel, renderTagManagerPanel } from "./managerPanels.js";
import { renderDataSettingsPanel } from "./dataSettingsPanel.js";
import { renderPatternInsertButton, renderSplitPatternTools } from "./splitPatternControls.js";
import { renderQuickActionsSettings } from "./settingsQuickActions.js";
import { resultMetaLabel, searchMatchReasons } from "./searchFeedback.js";
import { renderTagSuggestions } from "./tagSuggestions.js";
import { escapeAttr, escapeHtml } from "./utils.js";
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

let lastFocusKey = "";

function focusAfterRender(key) {
  if (!key || lastFocusKey === key) return;
  lastFocusKey = key;
  queueMicrotask(() => {
    if (typeof document === "undefined") return;
    const selector = key === "lock"
      ? "#unlock-password"
      : state.activePanel === "quick"
        ? "[name='quickText']"
        : state.activePanel === "settings"
          ? ".settings-panel input, .settings-panel button"
          : state.activePanel === "line-editor"
            ? "[data-line-edit-value]"
            : state.activePanel === "line-move"
              ? "[data-line-move-query]"
            : "#card-title";
    document.querySelector(selector)?.focus();
  });
}

function render() {
  applyAppearanceSettings(state.data?.settings);
  if (state.lock?.locked) {
    app.innerHTML = renderLockScreen();
    bindEvents();
    focusAfterRender("lock");
    return;
  }

  const parsedSearch = parseSearchQuery(state.query);
  const hasRankedSearch = Boolean(parsedSearch.text.trim());
  const cards = searchCards(state.data, activeTabFilter(state), state.query);
  if (!hasRankedSearch) {
    cards.sort((a, b) => {
      if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });
  }

  app.innerHTML = `
    <main class="shell ${state.activePanel ? "has-panel" : ""} ${state.viewMode !== "table" && state.denseMode ? "dense" : ""}">
      <section class="workspace">
        ${renderWarning()}
        <header class="toolbar">
          <div class="brand">
            <strong>LineMemo</strong>
            <span>Lite</span>
          </div>
          <div class="toolbar-actions">
            <button type="button" class="primary primary-action" data-action="open-panel" data-panel="quick" title="빠른 입력" aria-label="빠른 입력">${icon("input")}<span class="primary-action-text">빠른 입력</span></button>
            <button type="button" class="icon-button new-card-button" data-action="new-card" title="빈 카드 만들기" aria-label="빈 카드 만들기">${icon("plus")}</button>
            ${renderViewSwitch(cards)}
            <div class="utility-actions" role="group" aria-label="관리">
              <button type="button" class="icon-button" data-action="lock-now" title="잠금" aria-label="잠금">${icon("lock")}</button>
              <button type="button" class="icon-button ${state.activePanel === "tabs" ? "active-toggle" : ""}" data-action="open-panel" data-panel="tabs" title="탭/카드 관리" aria-label="탭/카드 관리 열기">${icon("folder")}</button>
              <button type="button" class="icon-button ${state.activePanel === "tags" ? "active-toggle" : ""}" data-action="open-panel" data-panel="tags" title="태그 관리" aria-label="태그 관리 열기">${icon("tag")}</button>
              <button type="button" class="icon-button ${state.activePanel === "settings" ? "active-toggle" : ""}" data-action="open-panel" data-panel="settings" title="설정" aria-label="설정 열기">${icon("settings")}</button>
            </div>
          </div>
          <input id="search" class="search" placeholder="카드명, 값, 라벨 또는 #태그 검색" title="카드명, 설명, 탭, 태그, 라벨, 값까지 검색합니다. 값:ssh, 제목:서버처럼 필드 검색도 가능합니다" aria-label="카드명, 설명, 탭, 태그, 라벨, 값 검색" value="${escapeAttr(state.query)}" />
        </header>
        <div class="workbench">
          ${renderScopeRail()}
          <section class="content-panel">
            <div class="filter-bar">
              ${renderTagFilters()}
              <div class="list-meta" title="${escapeAttr(resultMetaLabel(cards.length, state.data.cards.length, Boolean(state.query.trim()) || !isAllTabsActive(state)))}">${escapeHtml(resultMetaLabel(cards.length, state.data.cards.length, Boolean(state.query.trim()) || !isAllTabsActive(state)))}</div>
            </div>
            <section class="content">
              <div class="cards">
                ${cards.length ? (state.viewMode === "table" ? renderTableView(cards) : cards.map(renderCard).join("")) : renderEmpty()}
              </div>
            </section>
          </section>
        </div>
        ${renderSelectionBar(cards)}
        ${renderModalPanel()}
        ${renderDuplicateConflict()}
        ${renderDeleteConfirm()}
        ${renderLineContextMenu(state)}
      </section>
      ${state.toast ? `<div class="toast">${escapeHtml(state.toast)}</div>` : ""}
    </main>
  `;
  bindEvents();
  focusAfterRender(state.activePanel ? `${state.activePanel}:${state.editingCardId || state.editingLineKey || ""}` : "");
}

function renderViewSwitch(cards = []) {
  const tableMode = state.viewMode === "table";
  const denseCard = state.denseMode;
  const allCollapsed = cards.length > 0 && cards.every((card) => state.collapsedCards.has(card.id));
  return `
    <div class="view-group">
      <span>보기</span>
      <div class="view-switch" role="group" aria-label="보기 방식">
        <button type="button" class="view-card-button ${tableMode ? "" : "active-toggle"}" data-action="set-view" data-mode="cards" title="카드 보기" aria-label="카드 보기" aria-pressed="${!tableMode}">${icon("cards")}<span>카드</span></button>
        <button type="button" class="view-table-button ${tableMode ? "active-toggle" : ""}" data-action="set-view" data-mode="table" title="표 보기" aria-label="표 보기" aria-pressed="${tableMode}">${icon("table")}<span>표</span></button>
      </div>
      ${tableMode ? "" : `
        <button type="button" class="card-tool-toggle density-subtoggle ${denseCard ? "active-toggle" : ""}" data-action="toggle-density" title="카드 줄을 더 촘촘하게 표시" aria-label="카드 압축 표시" aria-pressed="${denseCard}">${icon("compact")}<span>압축</span></button>
        <button type="button" class="card-tool-toggle collapse-all-toggle" data-action="toggle-collapse-all" title="${allCollapsed ? "전체 펼치기" : "전체 접기"}" aria-label="${allCollapsed ? "전체 펼치기" : "전체 접기"}">${icon(allCollapsed ? "chevronDown" : "chevronRight")}<span>${allCollapsed ? "펼침" : "접기"}</span></button>
      `}
    </div>
  `;
}

function renderLockScreen() {
  const reason = state.lock?.reason === "timeout" ? "오래 열려 있지 않아 다시 잠겼습니다." : "비밀번호를 입력해 메모를 여세요.";
  return `
    <main class="lock-shell">
      <section class="lock-card" role="dialog" aria-modal="true" aria-label="LineMemo 잠금 해제">
        <div class="lock-mark">${icon("lock")}</div>
        <div class="lock-copy">
          <strong>LineMemo 잠김</strong>
          <p>${escapeHtml(reason)}</p>
        </div>
        <form id="unlock-form" class="lock-form">
          <label>비밀번호
            <input id="unlock-password" name="password" type="password" autocomplete="current-password" required />
          </label>
          ${state.lock?.unlockError ? `<p class="form-error">${escapeHtml(state.lock.unlockError)}</p>` : ""}
          <button type="submit" class="primary">잠금 해제</button>
        </form>
        <p class="lock-note">앱 화면 잠금입니다. 저장된 JSON 파일은 암호화하지 않습니다.</p>
      </section>
    </main>
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
      <button type="button" data-action="group-selected">세트 지정</button>
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

  if (!rows.length) return `<section class="line-table ${showTabColumn ? "with-tabs" : "single-tab"}">${renderTableHead(showTabColumn)}<div class="table-scroll-body"></div>${renderTableQuickAdd(cards, showTabColumn)}</section><section class="empty compact-empty"><h2>표시할 줄이 없습니다.</h2></section>`;
  return `
    <section class="line-table ${showTabColumn ? "with-tabs" : "single-tab"}">
      ${renderTableHead(showTabColumn)}
      <div class="table-scroll-body">${renderTableRows(rows, showTabColumn)}</div>
      ${renderTableQuickAdd(cards, showTabColumn)}
    </section>
  `;
}

function renderTableRows(rows, showTabColumn) {
  const seenSets = new Set();
  return rows.map(({ card, item }) => `${renderCopySetHeader(card, item, seenSets, "table")}${renderTableRow(card, item, showTabColumn)}`).join("");
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
  const valueHtml = renderLineValueHtml(item, { revealed, expandable: false });
  const groupItems = relatedLineItems(card, item);
  const groupKey = groupCopyKey(card, item);
  return `
    <div class="table-row ${item.secret ? "secret" : ""} ${selected ? "selected" : ""} ${groupItems.length > 1 ? "grouped-row" : ""} type-${escapeAttr(item.type || "text")}" data-line-row data-card="${card.id}" data-id="${item.id}">
      ${showTabColumn ? renderEditableCell({ card, field: "tabId", className: "tab-badge", value: card.tabId, display: tabNameForCard(card) }) : ""}
      ${renderEditableCell({ card, field: "title", tag: "strong", value: card.title, display: card.title })}
      ${renderEditableCell({ card, item, field: "label", value: item.label || "", displayHtml: renderLineLabelHtml(card, item) })}
      ${renderEditableCell({ card, item, field: "value", tag: "div", className: "line-value table-line-value", value: item.value, displayHtml: valueHtml })}
      <div class="table-actions">
        <input type="checkbox" title="선택" data-action="select-line" data-card="${card.id}" data-id="${item.id}" ${selected ? "checked" : ""} />
        ${groupItems.length > 1 ? `<button type="button" class="tiny icon-button group-copy ${state.lastCopiedKey === groupKey ? "copied" : ""}" data-action="copy-line-group" data-card="${card.id}" data-id="${item.id}" title="세트 ${escapeAttr(item.group)} ${groupItems.length}줄 복사" aria-label="세트 복사">${copyIcon(groupKey)}</button>` : ""}
        <button type="button" class="tiny icon-button" data-action="edit-line-detail" data-card="${card.id}" data-id="${item.id}" title="줄 상세 수정" aria-label="줄 상세 수정">${icon("pencil")}</button>
        <button type="button" class="tiny icon-button" data-action="move-line" data-card="${card.id}" data-id="${item.id}" title="줄 이동" aria-label="줄 이동">${icon("move")}</button>
        <button type="button" class="tiny icon-button copy-line ${state.lastCopiedKey === `line:${card.id}:${item.id}` ? "copied" : ""}" data-action="copy-line" data-card="${card.id}" data-id="${item.id}" title="줄 복사" aria-label="줄 복사">${copyIcon(`line:${card.id}:${item.id}`)}</button>
        <button type="button" class="tiny icon-button delete-line-button" data-action="delete-line" data-card="${card.id}" data-id="${item.id}" title="줄 삭제" aria-label="줄 삭제">${icon("trash")}</button>
      </div>
    </div>
  `;
}

function renderTableQuickAdd(cards, showTabColumn) {
  const targetCards = cards;
  if (!targetCards.length) return "";
  const draft = state.drafts?.tableAdd || {};
  const selectedCardId = targetCards.some((card) => card.id === draft.cardId) ? draft.cardId : targetCards[0].id;
  if (!state.showTableAdd) {
    return `
      <div class="table-add-footer">
        <button type="button" class="table-add-trigger" data-action="toggle-table-add" title="행 추가" aria-label="행 추가">${icon("plus")} 행 추가</button>
      </div>
    `;
  }
  return `
    <form id="table-add-row" class="table-add-row ${showTabColumn ? "with-tabs" : "single-tab"}" data-table-quick-add>
      <select name="cardId" data-draft="tableAdd" data-draft-field="cardId" aria-label="카드 선택">
        ${targetCards.map((card) => `<option value="${card.id}" ${card.id === selectedCardId ? "selected" : ""}>${escapeHtml(tabNameForCard(card))} · ${escapeHtml(card.title)}</option>`).join("")}
      </select>
      <input class="optional-label" name="lineLabel" data-draft="tableAdd" data-draft-field="lineLabel" value="${escapeAttr(draft.lineLabel || "")}" placeholder="라벨(선택)" autocomplete="off" />
      <textarea name="lineValue" data-draft="tableAdd" data-draft-field="lineValue" rows="2" placeholder="값 붙여넣기" autocomplete="off">${escapeHtml(draft.lineValue || "")}</textarea>
      <div class="table-add-actions">
        <label class="secret-toggle"><input type="checkbox" name="lineSecret" data-draft="tableAdd" data-draft-field="lineSecret" ${draft.lineSecret ? "checked" : ""} /> secret</label>
        <button class="primary icon-button" type="submit" title="줄 추가" aria-label="줄 추가">${icon("plus")}</button>
        <button class="icon-button" type="button" data-action="toggle-table-add" title="행 추가 닫기" aria-label="행 추가 닫기">${icon("chevronDown")}</button>
      </div>
    </form>
  `;
}

function renderWarning() {
  if (state.data.settings.acknowledgedPlainTextWarning) return "";
  return `
    <section class="warning">
      <span><strong>로컬 평문 저장</strong> · 데이터는 이 PC에만 저장되지만 파일은 암호화되지 않습니다. 화면 숨김과 앱 잠금은 보안 저장소가 아닙니다.</span>
      <button type="button" data-action="ack-warning">이해했습니다</button>
    </section>
  `;
}

function tabStatsFor(tabId) {
  const cards = tabId === "all" ? state.data.cards : state.data.cards.filter((card) => card.tabId === tabId);
  return {
    cards: cards.length,
    lines: cards.reduce((sum, card) => sum + sortedItems(card.items).filter((item) => item.type !== "divider").length, 0)
  };
}

function tagStatsFor(tag) {
  const cards = state.data.cards.filter((card) => parseTags(card.tags).includes(tag));
  return {
    cards: cards.length,
    lines: cards.reduce((sum, card) => sum + sortedItems(card.items).filter((item) => item.type !== "divider").length, 0)
  };
}

function renderScopeRail() {
  const activeStats = tabStatsFor(isAllTabsActive(state) ? "all" : selectedTabIds(state).at(-1));
  const activeName = isAllTabsActive(state)
    ? "전체"
    : state.data.tabs.find((tab) => tab.id === selectedTabIds(state).at(-1))?.name || "Inbox";
  return `
    <div class="scope-area">
      <details class="scope-menu">
        <summary>
          <span>범위</span>
          <strong>${escapeHtml(activeName)}</strong>
          <em>${activeStats.cards}카드 · ${activeStats.lines}줄</em>
        </summary>
        <nav class="scope-list scope-menu-list" aria-label="카드 범위">
          ${state.data.tabs.map(renderTab).join("")}
        </nav>
      </details>
      <aside class="scope-rail" aria-label="카드 범위">
        <div class="scope-rail-head">
          <span>탭</span>
          <button type="button" class="icon-button ${state.activePanel === "tabs" ? "active-toggle" : ""}" data-action="open-panel" data-panel="tabs" title="탭 관리" aria-label="탭 관리 열기">${icon("folder")}</button>
        </div>
        <nav class="scope-list">
          ${state.data.tabs.map(renderTab).join("")}
        </nav>
      </aside>
    </div>
  `;
}

function renderTab(tab) {
  const active = isTabActive(state, tab.id) ? "active" : "";
  const stats = tabStatsFor(tab.id);
  return `
    <button type="button" class="tab scope-tab ${active}" data-action="tab" data-id="${tab.id}" aria-pressed="${active ? "true" : "false"}" title="${escapeAttr(`${tab.name} · ${stats.cards}카드 · ${stats.lines}줄`)}">
      <span class="scope-tab-name">${escapeHtml(tab.name)}</span>
      <span class="scope-count">${stats.cards}</span>
      <small>${stats.lines}줄</small>
    </button>
  `;
}

function renderTagFilters() {
  const tags = allTags(state.data).map((tag) => ({ tag, stats: tagStatsFor(tag) }));
  if (!tags.length) return "";
  const selectedTags = parseSearchQuery(state.query).tags;
  const selected = tags.filter((entry) => selectedTags.includes(entry.tag));
  const rest = tags
    .filter((entry) => !selectedTags.includes(entry.tag))
    .sort((a, b) => b.stats.cards - a.stats.cards || a.tag.localeCompare(b.tag, "ko"));
  const limit = Math.max(8, 12 - selected.length);
  const visible = [...selected, ...rest.slice(0, limit)];
  const hidden = tags.length - visible.length;
  return `
    <nav class="tag-filters" aria-label="태그 필터">
      ${visible.map(({ tag, stats }) => `<button type="button" class="tag-filter ${selectedTags.includes(tag) ? "active" : ""}" data-action="search-tag" data-tag="${escapeAttr(tag)}" title="#${escapeAttr(tag)} · ${stats.cards}카드 · ${stats.lines}줄"><span>#${escapeHtml(tag)}</span><small>${stats.cards}</small></button>`).join("")}
      ${hidden > 0 ? `<button type="button" class="tag-filter tag-more" data-action="open-panel" data-panel="tags" title="태그 관리에서 ${hidden}개 더 보기"><span>+${hidden}</span><small>관리</small></button>` : ""}
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
  const hasCardFooter = true;
  const matchReasons = searchMatchReasons(card, state.query, tabNameForCard(card));
  const quickLineOpen = isQuickLineOpen(card.id);
  const hasQuickLineDraft = quickLineDraftHasValue(state.drafts?.quickLines?.[card.id]);
  return `
    <article class="card ${isCollapsed ? "collapsed" : ""}">
      <header class="card-head">
        <div class="card-title">
          <h2><button type="button" class="collapse-toggle" data-action="toggle-collapse" data-id="${card.id}" title="${isCollapsed ? "펼치기" : "접기"}" aria-label="${isCollapsed ? "펼치기" : "접기"}">${icon(isCollapsed ? "chevronRight" : "chevronDown")}</button>${card.favorite ? `<span class="pin-mark" title="상단 고정">${icon("pin")}</span>` : ""}${renderEditableCell({ card, field: "title", className: "card-title-text", value: card.title, display: card.title })}</h2>
          ${card.description ? `<p>${escapeHtml(card.description)}</p>` : ""}
          <div class="card-meta">${renderEditableCell({ card, field: "tabId", className: "tab-badge", value: card.tabId, display: tabNameForCard(card) })}${renderCardCounts(card, blocks)}${renderCardTags(card)}</div>
          ${matchReasons.length ? `<div class="match-reasons">${matchReasons.map((reason) => `<span>${escapeHtml(reason)}</span>`).join("")}</div>` : ""}
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
              <button type="button" data-action="copy-card-title" data-id="${card.id}">제목 포함 복사</button>
              <button type="button" data-action="copy-card-markdown" data-id="${card.id}">마크다운 복사</button>
            </div>
          </details>
        </div>
      </header>
      ${isCollapsed ? "" : `
        <div class="preview-list">
          ${visibleItems.length ? renderPreviewItems(card, visibleItems) : renderEmptyCardPreview(card)}
        </div>
        ${hasCardFooter ? `<footer class="card-foot">
          <div class="card-foot-left">
            ${remaining > 0 ? `<button type="button" class="text-button" data-action="toggle-expand" data-id="${card.id}">${state.expandedCards.has(card.id) ? "접기" : `+ ${remaining}줄 펼치기`}</button>` : `<span class="card-foot-summary">${lineCount}줄${blocks.length > 1 ? ` · ${blocks.length}블록` : ""}</span>`}
            <button type="button" class="text-button add-line-trigger" data-action="toggle-quick-line" data-card="${card.id}">${quickLineOpen ? "줄 추가 닫기" : hasQuickLineDraft ? "입력 이어서" : "+ 줄 추가"}</button>
          </div>
          <div class="block-actions">
            ${blocks.length > 1 ? blocks.map((block, index) => `<button type="button" data-action="copy-block" data-card="${card.id}" data-index="${index}" title="블록 ${index + 1} 복사">블록 ${index + 1} · ${block.filter((item) => item.type !== "divider").length}줄</button>`).join("") : ""}
          </div>
        </footer>` : ""}
        ${renderQuickLineForm(card)}
      `}
    </article>
  `;
}

function renderCardCounts(card, blocks) {
  const lines = sortedItems(card.items).filter((item) => item.type !== "divider");
  const secretCount = lines.filter((item) => item.secret).length;
  return `
    <span class="card-count" title="${lines.length}줄${blocks.length > 1 ? ` · ${blocks.length}블록` : ""}${secretCount ? ` · secret ${secretCount}` : ""}">
      ${lines.length}줄${blocks.length > 1 ? ` · ${blocks.length}블록` : ""}${secretCount ? ` · secret ${secretCount}` : ""}
    </span>
  `;
}

function quickLineDraftHasValue(draft = {}) {
  return Boolean(String(draft.lineValue || "").trim() || String(draft.lineLabel || "").trim() || draft.lineSecret);
}

function renderCardTags(card) {
  const tags = parseTags(card.tags);
  if (!tags.length) return "";
  return `<div class="card-tags">${tags.map((tag) => `<button type="button" class="tag-chip" data-action="search-tag" data-tag="${escapeAttr(tag)}">#${escapeHtml(tag)}</button>`).join("")}</div>`;
}

function renderPreviewItems(card, items) {
  const seenSets = new Set();
  return items.map((item) => `${renderCopySetHeader(card, item, seenSets)}${renderPreviewLine(card, item)}`).join("");
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
  const matchedRelated = relatedItemsForActiveQuery(card, items);
  if (matchedRelated.length) return matchedRelated;
  let count = 0;
  const result = [];
  for (const item of items) {
    if (item.type !== "divider") count += 1;
    if (count > 5) break;
    result.push(item);
  }
  return result;
}

function relatedItemsForActiveQuery(card, items) {
  const lineItems = items.filter((item) => item.type !== "divider");
  if (!lineItems.length) return [];
  const matched = lineItems.filter((item) => itemMatchesActiveQuery(item));
  if (!matched.length) return [];
  const visibleIds = new Set(matched.map((item) => item.id));
  for (const item of matched) {
    for (const related of relatedLineItems(card, item)) visibleIds.add(related.id);
  }
  return items.filter((item) => visibleIds.has(item.id));
}

function itemMatchesActiveQuery(item) {
  const parsed = parseSearchQuery(state.query);
  const q = normalizeSearchText(parsed.text);
  if (parsed.fields.groups.length && includesAnyNormalized(item.group, parsed.fields.groups)) return true;
  if (parsed.fields.labels.length && includesAnyNormalized(item.label, parsed.fields.labels)) return true;
  if (parsed.fields.values.length && includesAnyNormalized(item.value, parsed.fields.values)) return true;
  if (!q) return false;
  const tokens = searchTokens(q);
  const text = normalizeSearchText([item.group, item.label, item.value, item.type].join("\n"));
  return text.includes(q) || tokens.some((token) => text.includes(token));
}

function includesAnyNormalized(value, terms = []) {
  const text = normalizeSearchText(value);
  return terms.some((term) => text.includes(term));
}

function renderPreviewLine(card, item) {
  if (item.type === "divider") return `<div class="preview-divider"></div>`;
  const revealed = !item.secret || state.revealed.has(item.id);
  const valueHtml = renderLineValueHtml(item, { revealed, expandable: true });
  const groupItems = relatedLineItems(card, item);
  const groupKey = groupCopyKey(card, item);
  return `
    <div class="preview-row ${item.secret ? "secret" : ""} ${state.selected.has(`${card.id}:${item.id}`) ? "selected" : ""} ${groupItems.length > 1 ? "grouped-row" : ""} type-${escapeAttr(item.type || "text")}" data-line-row data-card="${card.id}" data-id="${item.id}">
      <input type="checkbox" title="선택" data-action="select-line" data-card="${card.id}" data-id="${item.id}" ${state.selected.has(`${card.id}:${item.id}`) ? "checked" : ""} />
      ${renderEditableCell({ card, item, field: "label", className: "line-label", value: item.label || "", displayHtml: renderLineLabelHtml(card, item) })}
      ${renderEditableCell({ card, item, field: "value", tag: "div", className: "line-value", value: item.value, displayHtml: valueHtml })}
      <div class="preview-actions">
        ${groupItems.length > 1 ? `<button type="button" class="tiny icon-button group-copy ${state.lastCopiedKey === groupKey ? "copied" : ""}" data-action="copy-line-group" data-card="${card.id}" data-id="${item.id}" title="세트 ${escapeAttr(item.group)} ${groupItems.length}줄 복사" aria-label="세트 복사">${copyIcon(groupKey)}</button>` : ""}
        <button type="button" class="tiny icon-button" data-action="edit-line-detail" data-card="${card.id}" data-id="${item.id}" title="줄 상세 수정" aria-label="줄 상세 수정">${icon("pencil")}</button>
        <button type="button" class="tiny icon-button" data-action="move-line" data-card="${card.id}" data-id="${item.id}" title="줄 이동" aria-label="줄 이동">${icon("move")}</button>
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
          <textarea data-line-edit-value data-line-edit-field="value" rows="2" placeholder="값" ${draft.type === "divider" ? "readonly" : ""}>${escapeHtml(draft.value || "")}</textarea>
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
      <textarea data-line-edit-value data-line-edit-field="value" rows="2" placeholder="값" ${draft.type === "divider" ? "readonly" : ""}>${escapeHtml(draft.value || "")}</textarea>
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
  const draft = state.drafts?.quickLines?.[card.id] || {};
  if (!isQuickLineOpen(card.id)) return "";
  return `
    <form class="quick-line-form" data-quick-line-form data-card="${card.id}">
      <textarea name="lineValue" data-draft="quickLine" data-draft-field="lineValue" rows="2" placeholder="값 붙여넣기" autocomplete="off">${escapeHtml(draft.lineValue || "")}</textarea>
      <input class="optional-label" name="lineLabel" data-draft="quickLine" data-draft-field="lineLabel" value="${escapeAttr(draft.lineLabel || "")}" placeholder="라벨(선택)" autocomplete="off" />
      <label class="secret-toggle"><input type="checkbox" name="lineSecret" data-draft="quickLine" data-draft-field="lineSecret" ${draft.lineSecret ? "checked" : ""} /> secret</label>
      <button class="icon-button" type="button" data-action="toggle-quick-line" data-card="${card.id}" title="줄 추가 닫기" aria-label="줄 추가 닫기">${icon("chevronDown")}</button>
      <button class="icon-button" type="submit" title="줄 추가" aria-label="줄 추가">${icon("plus")}</button>
    </form>
  `;
}

function isQuickLineOpen(cardId) {
  return state.activeQuickLineCardId === cardId;
}

function renderActivePanel() {
  if (state.activePanel === "quick") return renderQuickPastePanel(state, renderTagPreview);
  if (state.activePanel === "tabs") return renderTabManager();
  if (state.activePanel === "tags") return renderTagManager();
  if (state.activePanel === "settings") return renderSettings();
  if (state.activePanel === "editor") return renderEditor();
  if (state.activePanel === "line-editor") return renderLineEditorModal(state, tabNameForCard);
  if (state.activePanel === "line-move") return renderLineMovePanel(state);
  return "";
}

function renderModalPanel() {
  const panel = renderActivePanel();
  if (!panel) return "";
  const labels = { quick: "빠른 입력", tabs: "탭/카드 관리", tags: "태그 관리", settings: "설정", editor: "카드 편집", "line-editor": "줄 편집", "line-move": "줄 이동" };
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

function renderDeleteConfirm() {
  const pending = state.deleteConfirm;
  if (!pending) return "";
  const mutedUntil = Number(state.deleteConfirmMutedUntil || 0);
  const mutedActive = mutedUntil > Date.now();
  return `
    <div class="modal-backdrop delete-confirm-backdrop">
      <aside class="panel delete-confirm-panel" role="dialog" aria-modal="true" aria-label="삭제 확인">
        <header class="panel-head">
          <div>
            <h2>삭제할까요?</h2>
            <p class="panel-note">${escapeHtml(pending.message || "선택한 항목을 삭제합니다.")}</p>
          </div>
          <button type="button" data-action="delete-confirm-cancel">닫기</button>
        </header>
        ${pending.detail ? `<p class="delete-confirm-detail">${escapeHtml(pending.detail)}</p>` : ""}
        ${mutedActive ? `<p class="delete-confirm-muted">잠시 삭제 확인을 건너뛰는 중입니다.</p>` : ""}
        <label class="delete-confirm-skip"><input type="checkbox" name="skipDeleteConfirm" /> 5분 동안 다시 묻지 않기</label>
        <footer class="delete-confirm-actions">
          <button type="button" data-action="delete-confirm-cancel">취소</button>
          <button type="button" class="danger delete-confirm-delete" data-action="delete-confirm-now">삭제</button>
        </footer>
      </aside>
    </div>
  `;
}

function renderTabManager() {
  return renderTabManagerPanel({ state, clampManagerPage, renderManagerPager });
}

function renderTagManager() {
  return renderTagManagerPanel({ state, clampManagerPage, renderManagerPager });
}

function draftLineSummary(text, splitMode = "line", splitPattern = DEFAULT_SPLIT_PATTERN) {
  const lines = splitPasteText(text, { splitMode, splitPattern });
  if (!lines.length) return { count: 0, title: "첫 줄", sample: "붙여넣은 줄 없음" };
  const first = lines[0].slice(0, 44);
  return {
    count: lines.length,
    title: first,
    sample: lines.find((line) => /[:：=]|\s{2,}/.test(line)) || "비밀번호 = 예시값"
  };
}

function renderNewCardHelp(summary, splitMode) {
  return `
    <div class="new-card-help" aria-label="새 카드 입력 도움말">
      <div><strong>${summary.count}</strong><span>${splitMode === "pattern" ? "붙여넣은 항목" : "붙여넣은 줄"}</span></div>
      <div><strong>${escapeHtml(summary.title)}</strong><span>제목이 비어 있으면 첫 줄 사용</span></div>
      <div><strong>${escapeHtml(summary.sample)}</strong><span>라벨은 : 또는 = 로 자동 인식</span></div>
    </div>
  `;
}

function renderPasteOptions(draft) {
  const splitMode = draft.quickSplitMode === "pattern" ? "pattern" : "line";
  const splitPattern = draft.quickSplitPattern || DEFAULT_SPLIT_PATTERN;
  const patternTools = splitMode === "pattern" ? renderSplitPatternTools(splitPattern, "", state.lastCopiedKey === "split-pattern") : "";
  return `
    <section class="paste-options ${splitMode === "pattern" ? "has-pattern" : "line-mode"}" aria-label="붙여넣기 분할 옵션">
      <label>분할 방식
        <select name="quickSplitMode">
          <option value="line" ${splitMode === "line" ? "selected" : ""}>줄마다 나누기</option>
          <option value="pattern" ${splitMode === "pattern" ? "selected" : ""}>패턴으로 나누기</option>
        </select>
      </label>
      ${patternTools}
    </section>
  `;
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
    quickValues: "",
    quickSplitMode: "line",
    quickSplitPattern: DEFAULT_SPLIT_PATTERN
  };
  const isNew = state.editingCardId === "new";
  const splitMode = draft.quickSplitMode === "pattern" ? "pattern" : "line";
  const splitPattern = draft.quickSplitPattern || DEFAULT_SPLIT_PATTERN;
  const summary = draftLineSummary(draft.quickValues, splitMode, splitPattern);
  const tabField = `<label>탭<select name="tabId">${state.data.tabs.filter((tab) => tab.id !== "all").map((tab) => `<option value="${tab.id}" ${tab.id === draft.tabId ? "selected" : ""}>${escapeHtml(tab.name)}</option>`).join("")}</select></label>`;
  const lineSection = `
    <section class="editor-line-section">
      <div class="editor-line-head">
        <strong>줄 ${state.editorItems.length}</strong>
        <button type="button" class="compact" data-action="add-line">${icon("plus")} 빈 줄</button>
      </div>
      <div class="editor-lines">${state.editorItems.length ? state.editorItems.map(renderEditorLine).join("") : `<p class="panel-note">붙여넣기만으로도 카드 생성 가능. 필요한 경우에만 빈 줄을 추가하세요.</p>`}</div>
    </section>
  `;
  return `
    <aside class="panel editor ${isNew ? "new-card-editor" : ""}">
      <form id="card-form">
        <header class="panel-head">
          <h2>${isNew ? "새 카드" : "카드 수정"}</h2>
          <button type="button" data-action="close-editor">닫기</button>
        </header>
        <div class="editor-meta-grid">
          <label>제목<input id="card-title" name="title" value="${escapeAttr(draft.title)}" placeholder="비우면 첫 줄로 제목 생성" ${isNew ? "" : "required"} /></label>
          ${tabField}
          <label>태그<input name="tags" data-tag-input value="${escapeAttr(draft.tags)}" placeholder="apikey, 비밀번호, prod" autocomplete="off" /></label>
        </div>
        <div class="tag-preview" data-tag-preview>${renderTagPreview(draft.tags)}</div>
        ${renderTagSuggestions(state, draft)}
        ${renderPasteOptions(draft)}
        ${isNew ? `
          <section class="new-card-value-panel">
            <div class="primary-value-field field-shell"><div class="field-label-row"><label for="quick-values">복사할 값</label>${splitMode === "pattern" ? renderPatternInsertButton() : ""}</div>
              <textarea id="quick-values" name="quickValues" rows="7" placeholder="${splitMode === "pattern" ? `여러 줄 블록을 붙여넣으세요&#10;${escapeAttr(splitPattern)}&#10;다음 블록` : "한 줄 또는 여러 줄을 붙여넣으세요&#10;비밀번호 = 예시값&#10;apikey example-key"}">${escapeHtml(draft.quickValues || "")}</textarea>
            </div>
            ${renderNewCardHelp(summary, splitMode)}
          </section>
        ` : ""}
        <details class="editor-details">
          <summary>설명과 줄 세부 편집</summary>
          <label class="editor-description-field">설명<textarea name="description" rows="2">${escapeHtml(draft.description)}</textarea></label>
          <section class="editor-import" aria-label="여러 줄 붙여넣기">
            <div class="editor-import-head">
              <strong>여러 줄 가져오기</strong>
              <button type="button" class="compact" data-action="parse-paste">붙여넣기 적용</button>
            </div>
            <textarea id="paste-area" rows="3" aria-label="여러 줄 붙여넣기" placeholder="여러 줄을 붙여넣으면 아래 상세 줄로 변환됩니다"></textarea>
          </section>
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
  const locked = isLockConfigured(s);
  const desktop = state.desktopIntegration || {};
  const active = ["behavior", "quick-actions", "appearance", "system", "help", "security", "data"].includes(state.settingsTab) ? state.settingsTab : "behavior";
  const tabButton = (id, label) => `<button type="button" class="${active === id ? "active" : ""}" data-action="settings-tab" data-tab="${id}" aria-pressed="${active === id}">${label}</button>`;
  return `
    <section class="panel settings settings-panel">
      <header class="panel-head">
        <h2>설정</h2>
        <button type="button" data-action="open-panel" data-panel="settings">닫기</button>
      </header>
      <nav class="settings-tabs" aria-label="설정 그룹">
        ${tabButton("behavior", "동작")}
        ${tabButton("quick-actions", "빠른작업")}
        ${tabButton("appearance", "화면")}
        ${tabButton("system", "시스템")}
        ${tabButton("help", "도움말")}
        ${tabButton("security", "보안")}
        ${tabButton("data", "데이터")}
      </nav>
      <div class="settings-tab-body">
      ${active === "behavior" ? `
      <section class="settings-section">
        <h3>동작</h3>
        <label class="check"><input type="checkbox" data-setting="rememberLastTab" ${s.rememberLastTab ? "checked" : ""} /> 마지막 탭 기억</label>
        <label class="check"><input type="checkbox" data-setting="confirmBeforeDelete" ${s.confirmBeforeDelete ? "checked" : ""} /> 삭제 전 확인</label>
        <label class="check"><input type="checkbox" data-setting="autoClearClipboard" ${s.autoClearClipboard ? "checked" : ""} /> 복사 후 클립보드 자동 삭제</label>
        <label>클립보드 삭제 대기
          <select data-setting="clipboardClearSeconds" ${s.autoClearClipboard ? "" : "disabled"}>
            ${[10, 30, 60].map((v) => `<option value="${v}" ${Number(s.clipboardClearSeconds) === v ? "selected" : ""}>${v}초</option>`).join("")}
          </select>
        </label>
      </section>
      ` : ""}
      ${active === "quick-actions" ? renderQuickActionsSettings(s) : ""}
      ${active === "appearance" ? `
      <section class="settings-section">
        <h3>화면</h3>
        <label>글씨 크기
          <select data-setting="fontSize" data-setting-type="string">
            ${[["small", "작게"], ["normal", "보통"], ["large", "크게"]].map(([value, label]) => `<option value="${value}" ${s.fontSize === value ? "selected" : ""}>${label}</option>`).join("")}
          </select>
        </label>
        <label>배경 색상
          <select data-setting="colorTheme" data-setting-type="string">
            ${[["warm", "따뜻한 기본"], ["sage", "세이지"], ["sky", "스카이"], ["rose", "로즈"], ["slate", "슬레이트"]].map(([value, label]) => `<option value="${value}" ${s.colorTheme === value ? "selected" : ""}>${label}</option>`).join("")}
          </select>
        </label>
        <label class="check"><input type="checkbox" data-setting="darkMode" ${s.darkMode ? "checked" : ""} /> 다크 모드</label>
        <div class="theme-preview-strip" aria-label="색상 미리보기">
          ${["warm", "sage", "sky", "rose", "slate"].map((theme) => `<span class="theme-dot theme-${theme} ${s.colorTheme === theme ? "active" : ""}"></span>`).join("")}
        </div>
      </section>
      ` : ""}
      ${active === "system" ? `
      <section class="settings-section">
        <h3>Windows</h3>
        <label class="check"><input type="checkbox" data-setting="minimizeToTray" ${s.minimizeToTray ? "checked" : ""} /> 닫기 버튼을 누르면 트레이로 숨김</label>
        <label class="check"><input type="checkbox" data-setting="launchOnStartup" ${s.launchOnStartup ? "checked" : ""} /> 컴퓨터를 켤 때 자동 실행</label>
        <p class="panel-note">${desktop.available === false ? "브라우저 미리보기에서는 Windows 통합 기능이 동작하지 않습니다." : "트레이 아이콘에서 앱을 다시 열거나 완전히 종료할 수 있습니다."}</p>
        ${desktop.error ? `<p class="form-error">${escapeHtml(desktop.error)}</p>` : ""}
      </section>
      ` : ""}
      ${active === "help" ? `
      <section class="settings-section guidance-section">
        <h3>빠른 사용법</h3>
        <div class="guide-list">
          <div><strong>새 카드</strong><span>값을 먼저 붙여넣고 제목은 비워두면 첫 줄로 자동 생성됩니다.</span></div>
          <div><strong>행 추가</strong><span>표 보기에서 현재 카드에 한 줄을 바로 추가하고 입력칸은 계속 열어둡니다.</span></div>
          <div><strong>세트</strong><span>같이 쓰는 줄을 묶어 전체, 탭 구분, 다음 값 순서로 복사합니다.</span></div>
          <div><strong>secret</strong><span>화면에서만 숨깁니다. 저장 파일 자체는 암호화하지 않습니다.</span></div>
          <div><strong>중복 경고</strong><span>같은 값이 있으면 기존 위치로 이동하거나 그래도 추가할 수 있습니다.</span></div>
          <div><strong>앱 잠금</strong><span>비밀번호로 화면을 잠급니다. JSON 파일 보호는 Windows 계정 보안에 따릅니다.</span></div>
        </div>
      </section>
      <section class="settings-section shortcut-section">
        <h3>단축키</h3>
        <div class="shortcut-grid">
          ${[
            ["Ctrl+N", "새 카드"],
            ["Ctrl+Shift+N", "빠른 입력"],
            ["Ctrl+Shift+A", "표 행 추가"],
            ["Ctrl+Shift+L", "앱 잠금"],
            ["Alt+1 / 2", "카드 · 표 보기"],
            ["Ctrl+Enter", "현재 폼 제출"],
            ["Ctrl+S", "편집 저장"],
            ["Ctrl+C", "선택 줄 복사"],
            ["Escape", "편집/패널 닫기"]
          ].map(([key, label]) => `<div><kbd>${escapeHtml(key)}</kbd><span>${escapeHtml(label)}</span></div>`).join("")}
        </div>
      </section>
      ` : ""}
      ${active === "security" ? `
      <section class="settings-section">
        <h3>보안 표시</h3>
        <label>비밀값 표시 시간
          <div class="suffix-input"><input type="number" min="3" max="120" data-setting="secretRevealSeconds" value="${escapeAttr(s.secretRevealSeconds)}" /><span>초</span></div>
        </label>
      </section>
      <section class="settings-section lock-settings-section">
        <h3>앱 잠금</h3>
        <p class="panel-note">앱을 열 때 비밀번호를 묻는 화면 잠금입니다. 저장된 JSON 파일은 암호화하지 않습니다.</p>
        <label>자동 재잠금
          <select data-setting="lockTimeoutMinutes">
            ${[
              [1, "1분"],
              [5, "5분"],
              [15, "15분"],
              [60, "1시간"],
              [240, "4시간"]
            ].map(([value, label]) => `<option value="${value}" ${Number(s.lockTimeoutMinutes) === value ? "selected" : ""}>${label}</option>`).join("")}
          </select>
        </label>
        ${locked ? `
          <div class="lock-status"><span>${icon("shield")}</span><strong>잠금 켜짐</strong><button type="button" data-action="lock-now">${icon("lock")} 지금 잠그기</button></div>
          <form id="lock-password-form" class="password-form">
            <label>현재 비밀번호<input name="currentPassword" type="password" autocomplete="current-password" required /></label>
            <label>새 비밀번호<input name="newPassword" type="password" autocomplete="new-password" minlength="4" required /></label>
            <label>새 비밀번호 확인<input name="confirmPassword" type="password" autocomplete="new-password" minlength="4" required /></label>
            <button type="submit" class="primary">비밀번호 변경</button>
          </form>
          <form id="lock-remove-form" class="password-form compact-password-form">
            <label>현재 비밀번호<input name="currentPassword" type="password" autocomplete="current-password" required /></label>
            <button type="submit">잠금 끄기</button>
          </form>
        ` : `
          <form id="lock-password-form" class="password-form">
            <label>새 비밀번호<input name="newPassword" type="password" autocomplete="new-password" minlength="4" required /></label>
            <label>새 비밀번호 확인<input name="confirmPassword" type="password" autocomplete="new-password" minlength="4" required /></label>
            <button type="submit" class="primary">잠금 켜기</button>
          </form>
        `}
      </section>
      ` : ""}
      ${active === "data" ? renderDataSettingsPanel(state) : ""}
      </div>
    </section>
  `;
}

function renderEmpty() {
  return `
    <section class="empty">
      <h2>반복해서 쓰는 문구를 카드로 저장하세요.</h2>
      <p>첫 카드를 만들면 카드명, 값, 라벨 또는 #태그로 다시 찾아 필요한 줄만 바로 복사할 수 있습니다.</p>
      <p>비밀번호 관리자가 아니라 로컬 평문 메모입니다. 이메일 서명, 코드 스니펫, 요청 템플릿처럼 반복 문구부터 넣어보세요.</p>
      <button type="button" class="primary" data-action="open-panel" data-panel="quick">빠른 입력</button>
    </section>
  `;
}


  return { render, renderTagPreview, tabNameForCard };
}

