import { normalizeSearchText, parseTags, sortedItems } from "../domain.js";
import { escapeAttr, escapeHtml } from "./utils.js";

function textTokens(value) {
  return normalizeSearchText(value)
    .split(/[\n\r\s/#@._:;,()[\]{}<>=+'"`|\\!?$%&*~^]+/u)
    .filter((token) => token.length >= 2);
}

function cardText(card, tabName = "") {
  return normalizeSearchText([
    card.title,
    card.description,
    tabName,
    parseTags(card.tags).join(" "),
    sortedItems(card.items).map((item) => `${item.label} ${item.group || ""} ${item.value}`).join("\n")
  ].join("\n"));
}

function addCandidate(map, tag, points, reason) {
  if (!tag || points <= 0) return;
  const entry = map.get(tag) || { tag, score: 0, reasons: new Set(), count: 0 };
  entry.score += points;
  entry.count += 1;
  entry.reasons.add(reason);
  map.set(tag, entry);
}

export function buildTagSuggestions(data, draft = {}, editingCardId = "") {
  const selected = new Set(parseTags(draft.tags));
  const tabsById = new Map(data.tabs.map((tab) => [tab.id, tab.name]));
  const draftText = [draft.title, draft.description, draft.quickValues].join("\n");
  const tokens = new Set(textTokens(draftText));
  const candidates = new Map();

  for (const card of data.cards || []) {
    if (card.id === editingCardId) continue;
    const tags = parseTags(card.tags).filter((tag) => !selected.has(tag));
    if (!tags.length) continue;
    const sameTab = card.tabId === draft.tabId;
    const haystack = cardText(card, tabsById.get(card.tabId));
    const overlap = [...tokens].filter((token) => haystack.includes(token)).length;
    for (const tag of tags) {
      addCandidate(candidates, tag, 1, "자주 사용");
      if (sameTab) addCandidate(candidates, tag, 6, "같은 탭");
      if (overlap) addCandidate(candidates, tag, Math.min(12, overlap * 4), "비슷한 카드");
    }
  }

  return [...candidates.values()]
    .sort((a, b) => b.score - a.score || b.count - a.count || a.tag.localeCompare(b.tag, "ko"))
    .slice(0, 8)
    .map((entry) => ({ ...entry, reason: [...entry.reasons][0] || "추천" }));
}

function renderSuggestionButtons(suggestions) {
  return `
      <span>추천 태그</span>
      ${suggestions.map((entry) => `
        <button type="button" data-tag-suggestion="${escapeAttr(entry.tag)}" title="${escapeAttr(entry.reason)}: #${entry.tag}">
          #${escapeHtml(entry.tag)}<small>${escapeHtml(entry.reason)}</small>
        </button>
      `).join("")}
  `;
}

export function renderTagSuggestions(state, draft) {
  const suggestions = buildTagSuggestions(state.data, draft, state.editingCardId);
  return `<div class="tag-suggestions" data-tag-suggestions aria-label="추천 태그" ${suggestions.length ? "" : "hidden"}>${renderSuggestionButtons(suggestions)}</div>`;
}

export function syncTagSuggestionPanel(form, state) {
  const panel = form?.querySelector("[data-tag-suggestions]");
  if (!panel) return;
  const suggestions = buildTagSuggestions(state.data, state.editorDraft || {}, state.editingCardId);
  panel.hidden = !suggestions.length;
  panel.innerHTML = suggestions.length ? renderSuggestionButtons(suggestions) : "";
}
