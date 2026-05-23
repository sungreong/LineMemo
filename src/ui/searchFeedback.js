import { normalizeSearchText, parseSearchQuery, parseTags, searchTokens } from "../domain.js";

const MAX_REASONS = 2;

export function resultMetaLabel(visible, total, scoped = false) {
  if (!total) return "아직 카드 없음";
  if (scoped) return `${visible} / ${total} 결과`;
  if (visible === total) return `${total}개 카드`;
  return `${visible} / ${total} 결과`;
}

export function searchMatchReasons(card, query, tabName = "") {
  const parsed = parseSearchQuery(query);
  const q = normalizeSearchText(parsed.text);
  const tokens = searchTokens(q);
  const reasons = [];
  const add = (reason) => {
    if (!reasons.includes(reason) && reasons.length < MAX_REASONS) reasons.push(reason);
  };

  if (parsed.tags.length) {
      const cardTags = parseTags(card.tags);
      if (parsed.tags.some((tag) => cardTags.includes(tag))) add("#태그 일치");
  }
  if (parsed.fields.title.length && includesAnySearch(card.title, parsed.fields.title)) add("카드명 조건");
  if (parsed.fields.description.length && includesAnySearch(card.description, parsed.fields.description)) add("설명 조건");
  if (parsed.fields.tab.length && includesAnySearch(tabName, parsed.fields.tab)) add("탭 조건");
  if (parsed.fields.tags.length && parseTags(card.tags).some((tag) => includesAnySearch(tag, parsed.fields.tags))) add("#태그 조건");
  if (parsed.fields.groups.length && card.items?.some((item) => includesAnySearch(item.group, parsed.fields.groups))) add("세트 조건");
  if (parsed.fields.labels.length && card.items?.some((item) => includesAnySearch(item.label, parsed.fields.labels))) add("라벨 조건");
  if (parsed.fields.values.length && card.items?.some((item) => includesAnySearch(item.value, parsed.fields.values))) add("값 조건");
  if (!q) return reasons;

  if (includesSearch(card.title, q, tokens)) add("카드명 일치");
  if (includesSearch(card.description, q, tokens)) add("설명 일치");
  if (includesSearch(tabName, q, tokens)) add("탭 일치");
  if (parseTags(card.tags).some((tag) => includesSearch(tag, q, tokens))) add("#태그 일치");
  if (card.items?.some((item) => includesSearch(item.group, q, tokens))) add("세트 일치");
  if (card.items?.some((item) => includesSearch(item.label, q, tokens))) add("라벨 일치");
  if (card.items?.some((item) => includesSearch(item.value, q, tokens))) add("값 일치");
  return reasons;
}

function includesSearch(value, query, tokens = []) {
  const text = normalizeSearchText(value);
  return text.includes(query) || tokens.some((token) => text.includes(token));
}

function includesAnySearch(value, terms = []) {
  const text = normalizeSearchText(value);
  return terms.some((term) => text.includes(term));
}
