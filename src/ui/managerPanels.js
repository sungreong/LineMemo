import { allTags, parseSearchQuery, parseTags, sortedItems } from "../domain.js";
import { icon } from "./icons.js";
import { escapeAttr, escapeHtml } from "./utils.js";
import { isTabActive } from "../state/tabs.js";

function managerFilters(state) {
  return { tabQuery: "", tabVisibility: "all", tabSort: "order", tagQuery: "", tagSort: "name", ...(state.managerFilters || {}) };
}

function tabStats(state, tabId) {
  const cards = tabId === "all" ? state.data.cards : state.data.cards.filter((card) => card.tabId === tabId);
  return { cards: cards.length, items: cards.reduce((sum, card) => sum + sortedItems(card.items).filter((item) => item.type !== "divider").length, 0) };
}

function cardsForTab(state, tabId) {
  return tabId === "all" ? state.data.cards : state.data.cards.filter((card) => card.tabId === tabId);
}

function cardLineCount(card) {
  return sortedItems(card.items).filter((item) => item.type !== "divider").length;
}

function renderCardList(cards, emptyText) {
  const visible = [...cards]
    .sort((a, b) => (Date.parse(b.updatedAt || b.createdAt || "") || 0) - (Date.parse(a.updatedAt || a.createdAt || "") || 0))
    .slice(0, 8);
  if (!visible.length) return `<p class="panel-note">${escapeHtml(emptyText)}</p>`;
  return `
    <div class="manager-card-list">
      <h4>최근 카드</h4>
      ${visible.map((card) => `<button type="button" class="manager-card-row" data-action="edit-card" data-id="${card.id}" title="${escapeAttr(card.title)}"><strong>${escapeHtml(card.title)}</strong><span>${cardLineCount(card)}줄</span></button>`).join("")}
    </div>
  `;
}

function tagStats(state) {
  return allTags(state.data).map((tag) => {
    const cards = state.data.cards.filter((card) => parseTags(card.tags).includes(tag));
    return { tag, cards: cards.length, items: cards.reduce((sum, card) => sum + sortedItems(card.items).filter((item) => item.type !== "divider").length, 0) };
  });
}

function tabUpdatedAt(state, tabId) {
  const cards = tabId === "all" ? state.data.cards : state.data.cards.filter((card) => card.tabId === tabId);
  return Math.max(0, ...cards.map((card) => Date.parse(card.updatedAt || card.createdAt || "") || 0));
}

function nameForEntry(entry, kind) {
  return kind === "tab" ? entry.tab.name : entry.tag;
}

function sortManagerEntries(a, b, sort, kind) {
  if (sort === "updated") return b.updatedAt - a.updatedAt;
  if (sort === "cards") return b.stats.cards - a.stats.cards || nameForEntry(a, kind).localeCompare(nameForEntry(b, kind), "ko");
  if (sort === "lines") return b.stats.items - a.stats.items || nameForEntry(a, kind).localeCompare(nameForEntry(b, kind), "ko");
  if (sort === "name") return nameForEntry(a, kind).localeCompare(nameForEntry(b, kind), "ko");
  return kind === "tab" ? a.tab.order - b.tab.order : nameForEntry(a, kind).localeCompare(nameForEntry(b, kind), "ko");
}

function filteredTabEntries(state, filters) {
  const query = filters.tabQuery.trim().toLocaleLowerCase();
  return state.data.tabs
    .map((tab) => ({ tab, stats: tabStats(state, tab.id), updatedAt: tabUpdatedAt(state, tab.id) }))
    .filter(({ tab, stats }) => {
      if (query && !tab.name.toLocaleLowerCase().includes(query)) return false;
      if (filters.tabVisibility === "cards" && stats.cards <= 0) return false;
      if (filters.tabVisibility === "lines" && stats.items <= 0) return false;
      if (filters.tabVisibility === "empty" && (stats.cards > 0 || stats.items > 0)) return false;
      return true;
    })
    .sort((a, b) => sortManagerEntries(a, b, filters.tabSort, "tab"));
}

function filteredTagStats(state, filters) {
  const query = filters.tagQuery.trim().replace(/^#/, "").toLocaleLowerCase();
  return tagStats(state)
    .filter((entry) => !query || entry.tag.toLocaleLowerCase().includes(query))
    .map((entry) => ({ ...entry, stats: { cards: entry.cards, items: entry.items } }))
    .sort((a, b) => sortManagerEntries(a, b, filters.tagSort, "tag"));
}

function tabBadges(state, tab, stats) {
  return [tab.system ? "시스템" : "", stats.cards || stats.items ? "" : "비어 있음", isTabActive(state, tab.id) ? "현재 선택" : "", tab.system ? "삭제 불가" : ""].filter(Boolean);
}

function renderTabDetail(state, entry) {
  if (!entry) return `<section class="manager-detail empty-detail"><h3>탭을 선택하세요</h3><p class="panel-note">왼쪽 목록에서 탭을 고르면 상태와 작업이 여기에 모입니다.</p></section>`;
  const { tab, stats } = entry;
  const cards = cardsForTab(state, tab.id);
  const badges = tabBadges(state, tab, stats);
  const deleteTitle = tab.system ? "시스템 탭은 삭제할 수 없습니다" : `${stats.cards}개 카드가 Inbox로 이동됩니다`;
  return `
    <section class="manager-detail">
      <span class="manager-detail-kicker">선택한 탭</span>
      <h3>${escapeHtml(tab.name)}</h3>
      <p>${stats.cards}카드 · ${stats.items}줄</p>
      <div class="manager-state-badges">${badges.map((badge) => `<span>${escapeHtml(badge)}</span>`).join("")}</div>
      <div class="manager-detail-actions">
        <button type="button" data-action="manager-select-tab" data-id="${tab.id}">탭 보기</button>
        <button type="button" class="icon-button" data-action="tab-up" data-id="${tab.id}" title="위로" aria-label="위로" ${tab.system ? "disabled" : ""}>${icon("arrowUp")}</button>
        <button type="button" class="icon-button" data-action="tab-down" data-id="${tab.id}" title="아래로" aria-label="아래로" ${tab.system ? "disabled" : ""}>${icon("arrowDown")}</button>
        <button type="button" data-action="tab-rename" data-id="${tab.id}" ${tab.system ? "disabled" : ""}>이름 수정</button>
        <button type="button" class="danger" data-action="tab-delete" data-id="${tab.id}" title="${escapeAttr(deleteTitle)}" ${tab.system ? "disabled" : ""}>삭제</button>
      </div>
      ${renderCardList(cards, "이 탭에는 아직 카드가 없습니다.")}
      <p class="panel-note">${escapeHtml(deleteTitle)}</p>
    </section>
  `;
}

export function renderTabManagerPanel({ state, clampManagerPage, renderManagerPager }) {
  const filters = managerFilters(state);
  const entries = filteredTabEntries(state, filters);
  const pageState = clampManagerPage("tabs", entries.length);
  const visibleTabs = entries.slice(pageState.start, pageState.end);
  const totalStats = tabStats(state, "all");
  const focused = entries.find(({ tab }) => tab.id === state.managerFocusTabId) || entries.find(({ tab }) => isTabActive(state, tab.id)) || entries[0];
  return `
    <aside class="panel tab-manager-panel">
      <header class="panel-head"><h2>탭/카드 관리</h2><div class="manager-head-actions"><button type="button" class="compact primary" data-action="new-tab">${icon("plus")} 탭</button><button type="button" data-action="open-panel" data-panel="tabs">닫기</button></div></header>
      <div class="manager-tools"><input data-manager-field="tabQuery" value="${escapeAttr(filters.tabQuery)}" placeholder="탭 검색" /><select data-manager-field="tabVisibility" aria-label="탭 필터">${[["all", "전체"], ["cards", "카드 있음"], ["lines", "라인 있음"], ["empty", "빈 탭"]].map(([value, label]) => `<option value="${value}" ${filters.tabVisibility === value ? "selected" : ""}>${label}</option>`).join("")}</select><select data-manager-field="tabSort" aria-label="탭 정렬">${[["order", "기본 순서"], ["updated", "최근 업데이트"], ["cards", "카드 많은 순"], ["lines", "라인 많은 순"], ["name", "이름순"]].map(([value, label]) => `<option value="${value}" ${filters.tabSort === value ? "selected" : ""}>${label}</option>`).join("")}</select></div>
      <div class="manager-shell">
        <section class="manager-list-pane"><div class="tab-stats-summary"><strong>전체</strong><span>${totalStats.cards}카드 · ${totalStats.items}줄</span></div><div class="tab-manager manager-list">${visibleTabs.length ? visibleTabs.map(({ tab, stats }) => `<button type="button" class="manager-list-row ${focused?.tab.id === tab.id ? "active" : ""} ${isTabActive(state, tab.id) ? "current" : ""}" data-action="manager-focus-tab" data-id="${tab.id}" title="${escapeAttr(tab.name)}"><span><strong>${escapeHtml(tab.name)}</strong><em>${tabBadges(state, tab, stats).map(escapeHtml).join(" · ")}</em></span><small>${stats.cards}카드 · ${stats.items}줄</small></button>`).join("") : `<p class="panel-note">조건에 맞는 탭이 없습니다.</p>`}</div>${renderManagerPager("tabs", entries.length)}</section>
        ${renderTabDetail(state, focused)}
      </div>
    </aside>
  `;
}

function renderTagDetail(state, entry) {
  if (!entry) return `<section class="manager-detail empty-detail"><h3>태그를 선택하세요</h3><p class="panel-note">왼쪽 목록에서 태그를 고르면 영향 범위와 작업이 여기에 모입니다.</p></section>`;
  const cards = state.data.cards.filter((card) => parseTags(card.tags).includes(entry.tag));
  return `
    <section class="manager-detail">
      <span class="manager-detail-kicker">선택한 태그</span>
      <h3>#${escapeHtml(entry.tag)}</h3>
      <p>${entry.cards}카드 · ${entry.items}줄</p>
      <div class="manager-state-badges"><span>${entry.cards}개 카드에서 변경됨</span></div>
      <div class="manager-detail-actions">
        <button type="button" data-action="manager-select-tag" data-tag="${escapeAttr(entry.tag)}">태그로 보기</button>
        <button type="button" data-action="tag-rename" data-tag="${escapeAttr(entry.tag)}">이름 수정</button>
        <button type="button" class="danger" data-action="tag-delete" data-tag="${escapeAttr(entry.tag)}">삭제</button>
      </div>
      ${renderCardList(cards, "이 태그가 붙은 카드가 없습니다.")}
      <p class="panel-note">삭제하면 ${entry.cards}개 카드에서 이 태그만 제거됩니다.</p>
    </section>
  `;
}

export function renderTagManagerPanel({ state, clampManagerPage, renderManagerPager }) {
  const filters = managerFilters(state);
  const stats = filteredTagStats(state, filters);
  const pageState = clampManagerPage("tags", stats.length);
  const visibleStats = stats.slice(pageState.start, pageState.end);
  const selectedTags = parseSearchQuery(state.query).tags;
  const focused = stats.find((entry) => entry.tag === state.managerFocusTag) || stats.find((entry) => selectedTags.includes(entry.tag)) || stats[0];
  const totalTaggedCards = new Set(state.data.cards.filter((card) => parseTags(card.tags).length).map((card) => card.id)).size;
  const totalLines = state.data.cards.filter((card) => parseTags(card.tags).length).reduce((sum, card) => sum + sortedItems(card.items).filter((item) => item.type !== "divider").length, 0);
  return `
    <aside class="panel tag-manager-panel">
      <header class="panel-head"><h2>태그 관리</h2><button type="button" data-action="open-panel" data-panel="tags">닫기</button></header>
      <div class="manager-tools tag-manager-tools"><input data-manager-field="tagQuery" value="${escapeAttr(filters.tagQuery)}" placeholder="태그 검색" /><select data-manager-field="tagSort" aria-label="태그 정렬">${[["name", "이름순"], ["cards", "카드 많은 순"], ["lines", "라인 많은 순"]].map(([value, label]) => `<option value="${value}" ${filters.tagSort === value ? "selected" : ""}>${label}</option>`).join("")}</select></div>
      <div class="manager-shell">
        <section class="manager-list-pane"><div class="tab-stats-summary"><strong>태그 ${stats.length}</strong><span>${totalTaggedCards}카드 · ${totalLines}줄</span></div><div class="tag-manager manager-list">${visibleStats.length ? visibleStats.map((entry) => `<button type="button" class="manager-list-row ${focused?.tag === entry.tag ? "active" : ""} ${selectedTags.includes(entry.tag) ? "current" : ""}" data-action="manager-focus-tag" data-tag="${escapeAttr(entry.tag)}" title="#${escapeAttr(entry.tag)}"><span><strong>#${escapeHtml(entry.tag)}</strong><em>${entry.cards}개 카드에서 변경됨</em></span><small>${entry.cards}카드 · ${entry.items}줄</small></button>`).join("") : `<p class="panel-note">조건에 맞는 태그가 없습니다.</p>`}</div>${renderManagerPager("tags", stats.length)}</section>
        ${renderTagDetail(state, focused)}
      </div>
    </aside>
  `;
}
