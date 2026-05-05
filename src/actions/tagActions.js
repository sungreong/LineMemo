import { normalizeTag, nowIso, parseSearchQuery, parseTags } from "../domain.js";

function composeSearchQuery(text, tags) {
  return [String(text || "").trim(), ...tags.map((tag) => `#${tag}`)].filter(Boolean).join(" ");
}

export function createTagActions({ state, scheduleSave, notify, render, tagStats, clampManagerPage }) {
  function selectManagerTag(tag) {
    const normalized = normalizeTag(tag);
    if (!normalized) return;
    const parsed = parseSearchQuery(state.query);
    state.query = composeSearchQuery(parsed.text, [normalized]);
    state.activePanel = null;
    render();
  }

  function toggleTagQuery(tag) {
    const normalized = normalizeTag(tag);
    if (!normalized) return;
    const parsed = parseSearchQuery(state.query);
    const tags = parsed.tags.includes(normalized)
      ? parsed.tags.filter((entry) => entry !== normalized)
      : [...parsed.tags, normalized];
    state.query = composeSearchQuery(parsed.text, tags);
    render();
  }

  function renameTag(oldTag) {
    const next = prompt("태그 이름 변경", oldTag);
    const newTag = parseTags(next)[0];
    if (!newTag || newTag === oldTag) return;
    state.data.cards.forEach((card) => {
      const tags = parseTags(card.tags);
      if (!tags.includes(oldTag)) return;
      card.tags = parseTags(tags.map((tag) => (tag === oldTag ? newTag : tag)));
      card.updatedAt = nowIso();
    });
    const parsed = parseSearchQuery(state.query);
    if (parsed.tags.includes(oldTag)) {
      state.query = composeSearchQuery(parsed.text, parsed.tags.map((tag) => (tag === oldTag ? newTag : tag)));
    }
    clampManagerPage("tags", tagStats().length);
    scheduleSave();
    notify("태그 변경됨");
    render();
  }

  function deleteTag(tag) {
    if (!confirm(`#${tag} 태그를 모든 카드에서 제거할까요?`)) return;
    state.data.cards.forEach((card) => {
      const tags = parseTags(card.tags);
      if (!tags.includes(tag)) return;
      card.tags = tags.filter((entry) => entry !== tag);
      card.updatedAt = nowIso();
    });
    const parsed = parseSearchQuery(state.query);
    if (parsed.tags.includes(tag)) {
      state.query = composeSearchQuery(parsed.text, parsed.tags.filter((entry) => entry !== tag));
    }
    clampManagerPage("tags", tagStats().length);
    scheduleSave();
    notify("태그 삭제됨");
    render();
  }

  return { selectManagerTag, toggleTagQuery, renameTag, deleteTag };
}
