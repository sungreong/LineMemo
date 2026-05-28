import { DEFAULT_SPLIT_PATTERN, normalizeSearchText, sortedItems } from "../domain.js";
import { defaultTabId } from "../state/tabs.js";
import { icon } from "./icons.js";
import { renderQuickPastePreview } from "./quickPastePreview.js";
import { renderPatternInsertButton, renderSplitPatternTools } from "./splitPatternControls.js";
import { escapeAttr, escapeHtml } from "./utils.js";

function realTabs(state) {
  return state.data.tabs.filter((tab) => tab.id !== "all");
}

function tabName(state, tabId) {
  return state.data.tabs.find((tab) => tab.id === tabId)?.name || "Inbox";
}

function cardPath(state, card) {
  const cardName = /카드$/u.test(card.title) ? card.title : `${card.title} 카드`;
  return `${tabName(state, card.tabId)} 탭 · ${cardName}`;
}

function cardLineCount(card) {
  return sortedItems(card.items).filter((item) => item.type !== "divider").length;
}

function tabStats(state, tabId, excludeCardId = "") {
  const cards = state.data.cards.filter((card) => card.tabId === tabId && card.id !== excludeCardId);
  return {
    cards: cards.length,
    lines: cards.reduce((sum, card) => sum + cardLineCount(card), 0)
  };
}

function countLabel(stats) {
  return `${stats.cards}카드 · ${stats.lines}줄`;
}

export function renderCardTargetOptions(state, options = {}) {
  const { selectedId = "", excludeCardId = "", includeNew = false, newLabel = "새 카드로 저장 (기본)", query = "" } = options;
  const needle = normalizeSearchText(query);
  const groups = realTabs(state)
    .map((tab) => ({
      tab,
      cards: state.data.cards.filter((card) => {
        if (card.tabId !== tab.id || card.id === excludeCardId) return false;
        return !needle || normalizeSearchText(`${tab.name} ${card.title} ${card.description || ""}`).includes(needle);
      })
    }))
    .filter((group) => group.cards.length);
  const defaultStats = tabStats(state, defaultTabId(state), excludeCardId);
  const newOption = includeNew ? `<option value="" ${selectedId ? "" : "selected"}>${escapeHtml(`${newLabel} · 현재 탭 ${countLabel(defaultStats)}`)}</option>` : "";
  const cardOptions = groups.map(({ tab, cards }) => `
    <optgroup label="${escapeAttr(`${tab.name} 탭 · ${countLabel({ cards: cards.length, lines: cards.reduce((sum, card) => sum + cardLineCount(card), 0) })}`)}">
      ${cards.map((card) => `<option value="${card.id}" ${card.id === selectedId ? "selected" : ""}>${escapeHtml(`${card.title} · ${cardLineCount(card)}줄`)}</option>`).join("")}
    </optgroup>
  `).join("");
  return newOption + cardOptions;
}

function targetCards(state, sourceId, query) {
  const needle = normalizeSearchText(query);
  return state.data.cards.filter((card) => {
    if (card.id === sourceId) return false;
    const tab = tabName(state, card.tabId);
    return !needle || normalizeSearchText(`${tab} ${card.title} ${card.description || ""}`).includes(needle);
  });
}

function moveLineTitle(item) {
  return item.label || item.type || "값";
}

export function renderQuickPastePanel(state, renderTagPreview) {
  const draft = state.drafts?.quick || {};
  const splitMode = draft.splitMode === "pattern" ? "pattern" : "line";
  const splitPattern = draft.splitPattern || DEFAULT_SPLIT_PATTERN;
  const target = state.data.cards.find((card) => card.id === draft.targetCardId);
  const targetTab = target ? tabName(state, target.tabId) : tabName(state, defaultTabId(state));
  const destination = target ? cardPath(state, target) : `${targetTab} 탭 · 새 카드`;
  const defaultStats = tabStats(state, defaultTabId(state));
  const splitNote = splitMode === "pattern"
    ? `분리 기준(${splitPattern})으로 항목을 나눕니다.`
    : "빈 줄을 제외하고 한 줄씩 저장합니다.";
  const patternTools = splitMode === "pattern"
    ? renderSplitPatternTools(splitPattern, 'data-draft="quick" data-draft-field="splitPattern"', state.lastCopiedKey === "split-pattern")
    : "";
  const insertButton = splitMode === "pattern" ? renderPatternInsertButton() : "";
  return `
    <aside class="panel quick-panel">
      <form id="quick-form">
        <header class="panel-head">
          <h2>빠른 입력</h2>
          <button type="button" data-action="open-panel" data-panel="quick">닫기</button>
        </header>
        <section class="quick-destination" aria-label="저장 위치">
          <span>저장 위치</span>
          <strong>${escapeHtml(destination)}</strong>
          <small>${target ? `현재 ${cardLineCount(target)}줄 있음 · 붙여넣은 줄이 선택한 카드 맨 아래에 추가됩니다.` : `${targetTab} 탭 현재 ${countLabel(defaultStats)} · 카드를 선택하지 않으면 새 카드로 저장됩니다.`}</small>
        </section>
        <label class="quick-target-field">카드 선택
          <select name="targetCardId" data-draft="quick" data-draft-field="targetCardId" data-draft-render="true">
            ${renderCardTargetOptions(state, { selectedId: target?.id || "", includeNew: true })}
          </select>
        </label>
        <div class="quick-options-stack ${splitMode === "pattern" ? "has-pattern" : "line-mode"}">
          <div class="quick-options-row">
            <label class="option-field">분할 방식
              <select name="quickSplitMode" data-draft="quick" data-draft-field="splitMode" data-draft-render="true">
                <option value="line" ${splitMode === "line" ? "selected" : ""}>줄마다 나누기</option>
                <option value="pattern" ${splitMode === "pattern" ? "selected" : ""}>패턴으로 나누기</option>
              </select>
            </label>
            <label class="option-field">대표 이름
              <input name="quickBaseLabel" data-draft="quick" data-draft-field="baseLabel" value="${escapeAttr(draft.baseLabel || "")}" placeholder="A, 서버, 계정" />
            </label>
            <label class="option-field">세트 이름
              <input name="quickGroup" data-draft="quick" data-draft-field="group" value="${escapeAttr(draft.group || "")}" placeholder="예: 로그인 묶음" />
            </label>
            <label class="option-field">유효기간
              <input type="date" name="quickExpiresAt" data-draft="quick" data-draft-field="expiresAt" value="${escapeAttr(draft.expiresAt || "")}" />
            </label>
          </div>
          ${patternTools}
        </div>
        <p class="quick-parse-note">${escapeHtml(splitNote)}</p>
        ${target ? "" : `
          <div class="quick-card-meta-row">
            <label>제목<input name="quickTitle" data-draft="quick" data-draft-field="title" value="${escapeAttr(draft.title || "")}" placeholder="비워두면 첫 줄로 제목 생성" /></label>
            <label>태그<input name="quickTags" data-tag-input data-draft="quick" data-draft-field="tags" value="${escapeAttr(draft.tags || "")}" placeholder="apikey, 비밀번호, prod" /></label>
          </div>
          <div class="tag-preview" data-tag-preview>${renderTagPreview(draft.tags || "")}</div>
        `}
        <div class="field-shell"><div class="field-label-row"><label for="quick-text">내용</label>${insertButton}</div><textarea id="quick-text" name="quickText" data-draft="quick" data-draft-field="text" rows="9" placeholder="${splitMode === "pattern" ? `여러 줄 블록을 붙여넣으세요&#10;${escapeAttr(splitPattern)}&#10;다음 블록` : "여러 줄을 붙여넣으세요&#10;비밀번호 = 예시값&#10;--- 한 줄은 카드 안 구분선입니다"}" required>${escapeHtml(draft.text || "")}</textarea></div>
        ${renderQuickPastePreview(draft)}
        <div class="sticky-actions"><button class="primary" type="submit">${target ? "줄 추가" : "카드 만들기"}</button></div>
      </form>
    </aside>
  `;
}

export function renderLineMovePanel(state) {
  const [sourceCardId, lineId] = String(state.movingLineKey || "").split(":");
  const source = state.data.cards.find((card) => card.id === sourceCardId);
  const item = source?.items.find((line) => line.id === lineId);
  if (!source || !item) return "";
  const query = state.lineMoveDraft?.targetQuery || "";
  const targets = targetCards(state, source.id, query);
  const selectedId = targets.some((card) => card.id === state.lineMoveDraft?.targetCardId) ? state.lineMoveDraft.targetCardId : targets[0]?.id || "";
  const target = state.data.cards.find((card) => card.id === selectedId);
  const targetCount = state.data.cards.filter((card) => card.id !== source.id).length;
  const value = item.secret && !state.revealed.has(item.id) ? "********" : item.value;
  const sourceTitle = cardPath(state, source);
  const targetTitle = target ? cardPath(state, target) : "대상 카드 없음";
  const lineTitle = moveLineTitle(item);
  return `
    <aside class="panel line-move-panel">
      <header class="panel-head">
        <div>
          <h2>줄 이동</h2>
          <p class="panel-note">선택한 줄을 다른 카드 맨 아래로 옮깁니다.</p>
        </div>
        <button type="button" data-action="cancel-line-move">닫기</button>
      </header>
      <div class="line-move-flow" aria-label="이동 흐름">
        <section title="${escapeAttr(sourceTitle)}"><span>From</span><strong>${escapeHtml(sourceTitle)}</strong></section>
        <div class="line-move-arrow">${icon("move")}</div>
        <section title="${escapeAttr(targetTitle)}"><span>To</span><strong>${escapeHtml(targetTitle)}</strong></section>
      </div>
      <div class="line-move-preview" title="${escapeAttr(`${lineTitle}: ${value}`)}">
        <span>${escapeHtml(lineTitle)}</span>
        <code>${escapeHtml(value)}</code>
      </div>
      ${targetCount ? `
        <label class="line-move-search">대상 카드 검색
          <input data-line-move-query value="${escapeAttr(query)}" placeholder="카드명 또는 탭 검색" autocomplete="off" />
        </label>
        <label>이동할 카드
          <select name="targetCardId" data-line-move-target ${targets.length ? "" : "disabled"}>
            ${renderCardTargetOptions(state, { selectedId, excludeCardId: source.id, query })}
          </select>
        </label>
        ${targets.length ? "" : `<p class="panel-note">검색 조건에 맞는 대상 카드가 없습니다.</p>`}
      ` : `<p class="panel-note">이동할 다른 카드가 없습니다. 새 카드를 만든 뒤 다시 시도하세요.</p>`}
      <div class="line-move-actions">
        <button type="button" data-action="cancel-line-move">취소</button>
        <button type="button" class="primary" data-action="confirm-line-move" ${selectedId ? "" : "disabled"}>${icon("move")} 이동</button>
      </div>
    </aside>
  `;
}

export function renderSelectionMovePanel(state) {
  const draft = state.selectionMoveDraft || {};
  const mode = draft.mode === "new-card" ? "new-card" : "card";
  const query = draft.targetQuery || "";
  const targets = targetCards(state, "", query);
  const selectedId = targets.some((card) => card.id === draft.targetCardId) ? draft.targetCardId : targets[0]?.id || "";
  const target = state.data.cards.find((card) => card.id === selectedId);
  const tabs = realTabs(state);
  const selectedTabId = tabs.some((tab) => tab.id === draft.targetTabId) ? draft.targetTabId : defaultTabId(state);
  const targetTitle = target ? cardPath(state, target) : "대상 카드 없음";
  const count = Number(draft.count || state.selected?.size || 0);
  const sourceCount = Number(draft.sourceCount || 0);
  return `
    <aside class="panel line-move-panel selection-move-panel">
      <header class="panel-head">
        <div>
          <h2>선택 줄 이동</h2>
          <p class="panel-note">${count}줄${sourceCount ? ` · ${sourceCount}개 카드에서 선택됨` : ""}</p>
        </div>
        <button type="button" data-action="cancel-selection-move">닫기</button>
      </header>
      <label class="selection-move-mode">이동 방식
        <select data-selection-move-mode>
          <option value="card" ${mode === "card" ? "selected" : ""}>기존 카드로 이동</option>
          <option value="new-card" ${mode === "new-card" ? "selected" : ""}>탭에 새 카드로 이동</option>
        </select>
      </label>
      ${mode === "card" ? `
        <div class="line-move-flow" aria-label="이동 흐름">
          <section><span>From</span><strong>${count}줄 선택</strong></section>
          <div class="line-move-arrow">${icon("move")}</div>
          <section title="${escapeAttr(targetTitle)}"><span>To</span><strong>${escapeHtml(targetTitle)}</strong></section>
        </div>
        <label class="line-move-search">대상 카드 검색
          <input data-selection-move-query value="${escapeAttr(query)}" placeholder="카드명 또는 탭 검색" autocomplete="off" />
        </label>
        <label>이동할 카드
          <select name="targetCardId" data-selection-move-target ${targets.length ? "" : "disabled"}>
            ${renderCardTargetOptions(state, { selectedId, query })}
          </select>
        </label>
        ${targets.length ? `<p class="panel-note">대상 카드에 이미 있는 선택 줄은 그대로 두고, 다른 카드의 선택 줄만 합칩니다.</p>` : `<p class="panel-note">검색 조건에 맞는 대상 카드가 없습니다.</p>`}
      ` : `
        <div class="selection-move-grid">
          <label>이동할 탭
            <select data-selection-move-tab>
              ${tabs.map((tab) => `<option value="${tab.id}" ${tab.id === selectedTabId ? "selected" : ""}>${escapeHtml(tab.name)}</option>`).join("")}
            </select>
          </label>
          <label>새 카드 제목
            <input data-selection-move-title value="${escapeAttr(draft.targetTitle || "")}" placeholder="비우면 선택 줄로 제목 생성" />
          </label>
        </div>
        <p class="panel-note">선택한 줄을 빼서 새 카드로 만들고, 선택한 탭에 저장합니다.</p>
      `}
      <div class="line-move-actions">
        <button type="button" data-action="cancel-selection-move">취소</button>
        <button type="button" class="primary" data-action="confirm-selection-move" ${mode === "card" && !selectedId ? "disabled" : ""}>${icon("move")} 이동</button>
      </div>
    </aside>
  `;
}
