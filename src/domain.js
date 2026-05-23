import MiniSearch from "minisearch";

export const DEFAULT_TABS = [
  { id: "all", name: "전체", order: 0, system: true },
  { id: "inbox", name: "Inbox", order: 1, system: true },
  { id: "account", name: "계정/접속", order: 2, system: false },
  { id: "ssh", name: "SSH/서버", order: 3, system: false },
  { id: "api", name: "API", order: 4, system: false },
  { id: "code", name: "코드", order: 5, system: false },
  { id: "prompt", name: "프롬프트", order: 6, system: false },
  { id: "sql", name: "SQL", order: 7, system: false },
  { id: "phrase", name: "업무문구", order: 8, system: false },
  { id: "etc", name: "기타", order: 9, system: false }
];

export const DEFAULT_SETTINGS = {
  rememberLastTab: true,
  lastTabId: "inbox",
  autoClearClipboard: false,
  clipboardClearSeconds: 30,
  secretRevealSeconds: 10,
  confirmBeforeDelete: true,
  cardDraftAutosave: true,
  lineContextMenu: true,
  rightClickCopy: false,
  lineClickSelect: false,
  cardEditorDraftSnapshot: null,
  fontSize: "normal",
  colorTheme: "warm",
  darkMode: false,
  minimizeToTray: false,
  launchOnStartup: false,
  acknowledgedPlainTextWarning: false,
  lockEnabled: false,
  lockPasswordHash: "",
  lockPasswordSalt: "",
  lockPasswordAlgorithm: "PBKDF2-SHA256",
  lockPasswordIterations: 210000,
  lockTimeoutMinutes: 60
};

export const ITEM_TYPES = ["text", "url", "command", "code", "image", "divider", "note"];
export const DEFAULT_SPLIT_PATTERN = "---LINE---";

export function createEmptyData() {
  return {
    version: "0.1",
    tabs: structuredClone(DEFAULT_TABS),
    cards: [],
    settings: { ...DEFAULT_SETTINGS }
  };
}

export function uid(prefix) {
  const bytes = crypto.getRandomValues(new Uint32Array(2));
  return `${prefix}-${Date.now().toString(36)}-${bytes[0].toString(36)}${bytes[1].toString(36)}`;
}

export function parseTags(input) {
  if (Array.isArray(input)) {
    return [...new Set(input.map((tag) => normalizeTag(tag)).filter(Boolean))];
  }
  return [...new Set(String(input || "")
    .split(/[\s,]+/)
    .map((tag) => normalizeTag(tag))
    .filter(Boolean))];
}

export function normalizeTag(tag) {
  return normalizeSearchText(tag)
    .trim()
    .replace(/^#+/, "");
}

export function formatTags(tags) {
  return parseTags(tags).join(", ");
}

export function parseSearchQuery(query) {
  const raw = String(query || "");
  const tags = [];
  const fields = { title: [], values: [], labels: [], groups: [], tags: [], tab: [], description: [] };
  const text = raw
    .replace(/(^|[\s,])#([^\s,#]+)/g, (_match, prefix, tag) => {
      const normalized = normalizeTag(tag);
      if (normalized) tags.push(normalized);
      return prefix && prefix.trim() ? prefix : " ";
    })
    .replace(/(^|[\s,])(title|제목|card|카드|value|값|label|라벨|group|묶음|set|세트|related|연계|tag|태그|tab|탭|desc|설명):([^\s,#]+)/gi, (_match, prefix, field, value) => {
      const key = searchFieldKey(field);
      const normalized = normalizeSearchText(value);
      if (key && normalized) fields[key].push(normalized);
      return prefix && prefix.trim() ? prefix : " ";
    })
    .replace(/[,\s]+/g, " ")
    .trim();
  return {
    tags: [...new Set(tags)],
    text,
    fields: Object.fromEntries(Object.entries(fields).map(([key, values]) => [key, [...new Set(values)]]))
  };
}

function searchFieldKey(field) {
  const key = normalizeSearchText(field);
  if (["title", "제목", "card", "카드"].includes(key)) return "title";
  if (["value", "값"].includes(key)) return "values";
  if (["label", "라벨"].includes(key)) return "labels";
  if (["group", "묶음", "set", "세트", "related", "연계"].includes(key)) return "groups";
  if (["tag", "태그"].includes(key)) return "tags";
  if (["tab", "탭"].includes(key)) return "tab";
  if (["desc", "설명"].includes(key)) return "description";
  return "";
}

const HANGUL_BASE = 0xac00;
const JUNGSEONG_COUNT = 21;
const JONGSEONG_COUNT = 28;
const CHOSEONG = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
const JUNGSEONG = ["ㅏ", "ㅐ", "ㅑ", "ㅒ", "ㅓ", "ㅔ", "ㅕ", "ㅖ", "ㅗ", "ㅘ", "ㅙ", "ㅚ", "ㅛ", "ㅜ", "ㅝ", "ㅞ", "ㅟ", "ㅠ", "ㅡ", "ㅢ", "ㅣ"];
const JONGSEONG = ["", "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ", "ㄺ", "ㄻ", "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ", "ㅁ", "ㅂ", "ㅄ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];

const CHOSEONG_INDEX = new Map(CHOSEONG.map((char, index) => [char, index]));
const JUNGSEONG_INDEX = new Map(JUNGSEONG.map((char, index) => [char, index]));
const JONGSEONG_INDEX = new Map(JONGSEONG.map((char, index) => [char, index]));

function composeCompatibilityHangul(input) {
  const chars = [...String(input || "")];
  let output = "";
  for (let index = 0; index < chars.length; index += 1) {
    const initial = CHOSEONG_INDEX.get(chars[index]);
    const vowel = JUNGSEONG_INDEX.get(chars[index + 1]);
    if (initial === undefined || vowel === undefined) {
      output += chars[index];
      continue;
    }

    let final = 0;
    const finalCandidate = JONGSEONG_INDEX.get(chars[index + 2]);
    const nextStartsSyllable = JUNGSEONG_INDEX.has(chars[index + 3]);
    if (finalCandidate && !nextStartsSyllable) {
      final = finalCandidate;
      index += 1;
    }

    output += String.fromCharCode(HANGUL_BASE + ((initial * JUNGSEONG_COUNT) + vowel) * JONGSEONG_COUNT + final);
    index += 1;
  }
  return output;
}

export function normalizeSearchText(value) {
  return composeCompatibilityHangul(value)
    .normalize("NFKC")
    .normalize("NFC")
    .toLocaleLowerCase()
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeLineValueInput(value) {
  return String(value || "").replace(/\r\n?/g, "\n");
}

export function nowIso() {
  return new Date().toISOString();
}

export function normalizeData(input) {
  const base = createEmptyData();
  const data = input && typeof input === "object" ? input : base;
  return {
    version: String(data.version || "0.1"),
    tabs: normalizeTabs(data.tabs),
    cards: Array.isArray(data.cards) ? data.cards.map(normalizeCard).filter(Boolean) : [],
    settings: normalizeSettings(data.settings)
  };
}

function normalizeSettings(settings) {
  const merged = { ...DEFAULT_SETTINGS, ...(settings || {}) };
  const timeout = Number(merged.lockTimeoutMinutes);
  const iterations = Number(merged.lockPasswordIterations);
  const hasPassword = Boolean(merged.lockPasswordHash && merged.lockPasswordSalt);
  const fontSize = ["small", "normal", "large"].includes(merged.fontSize) ? merged.fontSize : "normal";
  const colorTheme = ["warm", "sage", "sky", "rose", "slate"].includes(merged.colorTheme) ? merged.colorTheme : "warm";
  return {
    ...merged,
    rememberLastTab: Boolean(merged.rememberLastTab),
    autoClearClipboard: Boolean(merged.autoClearClipboard),
    confirmBeforeDelete: merged.confirmBeforeDelete !== false && merged.confirmBeforeDelete !== "false",
    cardDraftAutosave: merged.cardDraftAutosave !== false && merged.cardDraftAutosave !== "false",
    lineContextMenu: merged.lineContextMenu !== false && merged.lineContextMenu !== "false",
    rightClickCopy: Boolean(merged.rightClickCopy),
    lineClickSelect: Boolean(merged.lineClickSelect),
    fontSize,
    colorTheme,
    darkMode: Boolean(merged.darkMode),
    minimizeToTray: Boolean(merged.minimizeToTray),
    launchOnStartup: Boolean(merged.launchOnStartup),
    acknowledgedPlainTextWarning: Boolean(merged.acknowledgedPlainTextWarning),
    clipboardClearSeconds: Number.isFinite(Number(merged.clipboardClearSeconds)) ? Number(merged.clipboardClearSeconds) : 30,
    secretRevealSeconds: Number.isFinite(Number(merged.secretRevealSeconds)) ? Number(merged.secretRevealSeconds) : 10,
    lockEnabled: Boolean(merged.lockEnabled && hasPassword),
    lockPasswordHash: String(merged.lockPasswordHash || ""),
    lockPasswordSalt: String(merged.lockPasswordSalt || ""),
    lockPasswordAlgorithm: String(merged.lockPasswordAlgorithm || "PBKDF2-SHA256"),
    lockPasswordIterations: Number.isFinite(iterations) && iterations > 0 ? iterations : 210000,
    lockTimeoutMinutes: Number.isFinite(timeout) ? Math.min(Math.max(timeout, 1), 1440) : 60
  };
}

function normalizeTabs(tabs) {
  const byId = new Map();
  for (const tab of DEFAULT_TABS) byId.set(tab.id, { ...tab });
  if (Array.isArray(tabs)) {
    for (const tab of tabs) {
      if (!tab?.id || !tab?.name) continue;
      const existing = byId.get(tab.id);
      byId.set(tab.id, {
        id: String(tab.id),
        name: String(tab.name),
        order: Number.isFinite(Number(tab.order)) ? Number(tab.order) : byId.size,
        system: Boolean(existing?.system || tab.system)
      });
    }
  }
  return [...byId.values()].sort((a, b) => a.order - b.order).map((tab, index) => ({ ...tab, order: index }));
}

function normalizeCard(card) {
  if (!card?.id) return null;
  const createdAt = card.createdAt || nowIso();
  return {
    id: String(card.id),
    tabId: String(card.tabId || "inbox"),
    title: String(card.title || "제목 없는 카드"),
    description: String(card.description || ""),
    tags: parseTags(card.tags),
    favorite: Boolean(card.favorite),
    createdAt,
    updatedAt: card.updatedAt || createdAt,
    items: Array.isArray(card.items) ? card.items.map(normalizeLine).filter(Boolean) : []
  };
}

function normalizeLine(item, index) {
  if (!item?.id) return null;
  const type = ITEM_TYPES.includes(item.type) ? item.type : "text";
  return {
    id: String(item.id),
    label: String(item.label || ""),
    value: String(item.value || ""),
    group: String(item.group || item.groupId || item.relation || "").trim(),
    type,
    secret: Boolean(item.secret),
    order: Number.isFinite(Number(item.order)) ? Number(item.order) : index + 1,
    createdAt: String(item.createdAt || ""),
    updatedAt: String(item.updatedAt || item.createdAt || "")
  };
}

export function inferType(line) {
  const value = line.trim();
  const lower = value.toLowerCase();
  if (value === "---") return "divider";
  if (/^data:image\/[a-z0-9.+-]+;base64,/i.test(value) || /^https?:\/\/\S+\.(png|jpe?g|gif|webp|svg|avif)(?:[?#]\S*)?$/i.test(value)) return "image";
  if (lower.startsWith("http://") || lower.startsWith("https://")) return "url";
  if (/^(ssh|curl|python|pip|npm|uvicorn)\b/i.test(value)) return "command";
  return "text";
}

export function parseLines(text) {
  return makeItemsFromValues(splitPasteText(text, { splitMode: "line" }));
}

export function parsePasteItems(text, options = {}) {
  return makeItemsFromValues(splitPasteText(text, options));
}

export function applyBaseLabelToItems(items, baseLabel) {
  const base = String(baseLabel || "").trim();
  if (!base) return items;
  const numbered = sortedItems(items).filter((item) => item.type !== "divider").length > 1;
  let index = 0;
  return items.map((item) => {
    if (item.type === "divider") return item;
    index += 1;
    if (String(item.label || "").trim()) return item;
    return { ...item, label: numbered ? `${base}.${index}` : base };
  });
}

export function splitPasteText(text, options = {}) {
  const raw = String(text || "");
  if (options.splitMode !== "pattern") {
    return raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  const pattern = String(options.splitPattern || DEFAULT_SPLIT_PATTERN).trim();
  const trimmed = raw.trim();
  if (!pattern) return trimmed ? [trimmed] : [];

  const chunks = [];
  let current = [];
  for (const line of raw.replace(/\r\n/g, "\n").split("\n")) {
    if (line.trim() === pattern) {
      const value = current.join("\n").trim();
      if (value) chunks.push(value);
      current = [];
    } else {
      current.push(line);
    }
  }
  const value = current.join("\n").trim();
  if (value) chunks.push(value);
  return chunks;
}

function makeItemsFromValues(values) {
  const time = nowIso();
  return values
    .map((value, index) => {
      const parsed = parseLineParts(value);
      const type = inferType(parsed.value);
      return {
        id: uid("line"),
        label: parsed.label,
        value: parsed.value,
        type,
        secret: false,
        order: index + 1,
        createdAt: time,
        updatedAt: time
      };
    });
}

export function parseLineParts(line) {
  const raw = String(line || "").trim();
  if (!raw || raw === "---") return { label: "", value: raw };
  if (isStandaloneCopyValue(raw)) return { label: "", value: raw };

  const delimiterMatch = raw.match(/^(.{1,40}?)(?:\s*[:：=]\s*|\t+|\s{2,})(.+)$/);
  if (delimiterMatch) {
    return cleanParts(delimiterMatch[1], delimiterMatch[2], raw);
  }

  const knownPrefixMatch = raw.match(/^([A-Za-z][A-Za-z0-9_-]*|[가-힣A-Za-z0-9_/-]{2,16})\s+(.+)$/);
  if (knownPrefixMatch && looksLikeLabel(knownPrefixMatch[1], knownPrefixMatch[2])) {
    return cleanParts(knownPrefixMatch[1], knownPrefixMatch[2], raw);
  }

  return { label: "", value: raw };
}

function isStandaloneCopyValue(value) {
  return /^(https?:\/\/|ssh\b|curl\b|python\b|pip\b|npm\b|uvicorn\b)/i.test(value.trim());
}

function cleanParts(label, value, fallback) {
  const cleanLabel = String(label || "").trim().replace(/^[-*•#\s]+/, "").replace(/\s+$/, "");
  const cleanValue = String(value || "").trim();
  if (!cleanLabel || !cleanValue || cleanLabel === cleanValue) return { label: "", value: fallback };
  return { label: cleanLabel, value: cleanValue };
}

function looksLikeLabel(label, value) {
  const key = label.toLocaleLowerCase();
  const known = [
    "api", "apikey", "api_key", "key", "secret", "token", "bearer",
    "password", "pass", "pw", "id", "email", "url", "host", "user",
    "username", "account", "ssh", "port", "db", "database",
    "비밀번호", "패스워드", "암호", "토큰", "키", "apikey", "이메일",
    "메일", "계정", "아이디", "사용자", "주소", "호스트", "서버",
    "포트", "디비", "데이터베이스", "url"
  ];
  if (known.includes(key)) return true;
  if (/^(api[-_ ]?key|access[-_ ]?token|refresh[-_ ]?token)$/i.test(label)) return true;
  if (/^(https?:\/\/|ssh\b|curl\b|sk-|pk_|eyJ|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/i.test(value.trim())) return true;
  return false;
}

export function makeCard({ title, tabId, description, tags, items }) {
  const time = nowIso();
  return {
    id: uid("card"),
    tabId: tabId || "inbox",
    title: title?.trim() || "제목 없는 카드",
    description: description?.trim() || "",
    tags: parseTags(tags),
    favorite: false,
    createdAt: time,
    updatedAt: time,
    items: items.map((item, index) => stampLine(item, time, index + 1))
  };
}

export function stampLine(item, time = nowIso(), order = item.order) {
  return {
    ...item,
    order,
    createdAt: item.createdAt || time,
    updatedAt: item.updatedAt || item.createdAt || time
  };
}

export function mergeLineTimestamps(nextItems, previousItems, time = nowIso()) {
  const previousById = new Map((previousItems || []).map((item) => [item.id, item]));
  return nextItems.map((item, index) => {
    const previous = previousById.get(item.id);
    if (!previous) return stampLine(item, time, index + 1);
    const changed = ["label", "value", "group", "type", "secret"].some((key) => item[key] !== previous[key]);
    return {
      ...item,
      order: index + 1,
      createdAt: previous.createdAt || item.createdAt || "",
      updatedAt: changed ? time : (previous.updatedAt || item.updatedAt || previous.createdAt || "")
    };
  });
}

export function getBlocks(items) {
  const blocks = [];
  let current = [];
  for (const item of sortedItems(items)) {
    if (item.type === "divider") {
      if (current.length) blocks.push(current);
      current = [];
    } else {
      current.push(item);
    }
  }
  if (current.length) blocks.push(current);
  return blocks;
}

export function sortedItems(items) {
  return [...(items || [])].sort((a, b) => a.order - b.order);
}

export function copyTextForItems(items, includeLabels = false) {
  return sortedItems(items)
    .filter((item) => item.type !== "divider")
    .map((item) => lineCopyText(item, includeLabels))
    .join("\n");
}

export function copyTextForOrderedItems(items, includeLabels = false) {
  return [...(items || [])]
    .filter((item) => item.type !== "divider")
    .map((item) => lineCopyText(item, includeLabels))
    .join("\n");
}

function lineCopyText(item, includeLabels) {
  if (!includeLabels || !String(item.label || "").trim()) return item.value;
  return `${item.label}: ${item.value}`;
}

const SEARCH_FIELDS = ["title", "description", "tab", "tags", "groups", "labels", "values", "all"];
const SEARCH_BOOST = { title: 8, groups: 7, labels: 6, tags: 5, tab: 4, values: 3, description: 1.5, all: 0.5 };
const searchIndexCache = new WeakMap();

export function searchCards(data, activeTabId, query) {
  const parsed = parseSearchQuery(query);
  const q = normalizeSearchText(parsed.text);
  const tagQueries = parsed.tags;
  const activeTabs = normalizeActiveTabFilter(activeTabId);
  const tabsById = new Map(data.tabs.map((tab) => [tab.id, tab]));
  const scopedCards = data.cards.filter((card) => {
    const inTab = !activeTabs.length || activeTabs.includes(card.tabId);
    if (!inTab) return false;
    if (tagQueries.length) {
      const cardTags = parseTags(card.tags);
      if (!tagQueries.some((tag) => cardTags.includes(tag))) return false;
    }
    const tabName = tabsById.get(card.tabId)?.name || "";
    return matchesFieldFilters(card, parsed.fields, tabName);
  });

  if (!q) return scopedCards;

  const index = getSearchIndex(data, tabsById);
  const scopedIds = new Set(scopedCards.map((card) => card.id));
  const scored = new Map();
  const resultOptions = {
    prefix: true,
    fuzzy: (term) => term.length >= 5 ? 0.2 : false,
    combineWith: "AND",
    boost: SEARCH_BOOST,
    filter: (result) => scopedIds.has(result.cardId)
  };

  for (const result of index.search.search(q, resultOptions)) {
    const card = index.cardsById.get(result.cardId);
    if (card) scored.set(card.id, { card, score: result.score });
  }

  const tokens = searchTokens(q);
  for (const card of scopedCards) {
    const tabName = tabsById.get(card.tabId)?.name || "";
    const fallbackScore = scoreCardTextMatch(card, q, tokens, tabName);
    if (!fallbackScore) continue;
    const previous = scored.get(card.id);
    scored.set(card.id, { card, score: (previous?.score || 0) + fallbackScore });
  }

  return [...scored.values()]
    .sort((a, b) => b.score - a.score || compareCardsByRecency(a.card, b.card))
    .map(({ card }) => card);
}

export function searchTokens(text) {
  return tokenizeSearchText(text).map(processSearchTerm).filter(Boolean);
}

function getSearchIndex(data, tabsById) {
  const signature = searchIndexSignature(data);
  const cached = searchIndexCache.get(data);
  if (cached?.signature === signature) return cached;

  const docs = data.cards.map((card, index) => cardSearchDocument(card, tabsById, index));
  const search = new MiniSearch({
    fields: SEARCH_FIELDS,
    storeFields: ["cardId"],
    tokenize: tokenizeSearchText,
    processTerm: processSearchTerm,
    searchOptions: {
      boost: SEARCH_BOOST,
      prefix: true,
      combineWith: "AND"
    }
  });
  search.addAll(docs);
  const entry = {
    signature,
    search,
    cardsById: new Map(data.cards.map((card) => [card.id, card]))
  };
  searchIndexCache.set(data, entry);
  return entry;
}

function searchIndexSignature(data) {
  return [
    data.tabs.map((tab) => `${tab.id}:${tab.name}`).join("|"),
    data.cards.map((card) => [
      card.id,
      card.updatedAt,
      card.tabId,
      card.title,
      card.description,
      parseTags(card.tags).join(","),
      sortedItems(card.items).map((item) => `${item.id}:${item.updatedAt}:${item.order}:${item.label}:${item.value}:${item.group || ""}:${item.type}:${item.secret ? 1 : 0}`).join("~")
    ].join(":")).join("|")
  ].join("::");
}

function cardSearchDocument(card, tabsById, id) {
  const tab = tabsById.get(card.tabId)?.name || "";
  const tags = parseTags(card.tags).join(" ");
  const items = sortedItems(card.items).filter((item) => item.type !== "divider");
  const labels = items.map((item) => item.label).join("\n");
  const groups = items.map((item) => item.group).join("\n");
  const values = items.map((item) => item.value).join("\n");
  return {
    id,
    cardId: card.id,
    title: card.title,
    description: card.description,
    tab,
    tags,
    groups,
    labels,
    values,
    all: [card.title, card.description, tab, tags, groups, labels, values].join("\n")
  };
}

function tokenizeSearchText(text) {
  return normalizeSearchText(text)
    .split(/[\n\r\s/#@._:;,()[\]{}<>=+'"`|\\!?$%&*~^]+/u)
    .filter(Boolean);
}

function processSearchTerm(term) {
  return normalizeSearchText(term);
}

function matchesFieldFilters(card, fields = {}, tabName = "") {
  const items = sortedItems(card.items).filter((item) => item.type !== "divider");
  return fieldTermsMatch(card.title, fields.title)
    && fieldTermsMatch(card.description, fields.description)
    && fieldTermsMatch(parseTags(card.tags).join("\n"), fields.tags)
    && fieldTermsMatch(tabName, fields.tab)
    && fieldTermsMatch(items.map((item) => item.group).join("\n"), fields.groups)
    && fieldTermsMatch(items.map((item) => item.label).join("\n"), fields.labels)
    && fieldTermsMatch(items.map((item) => item.value).join("\n"), fields.values);
}

function fieldTermsMatch(value, terms = []) {
  if (!terms?.length) return true;
  const haystack = normalizeSearchText(value);
  return terms.every((term) => haystack.includes(term));
}

function scoreCardTextMatch(card, query, tokens, tabName) {
  const fields = [
    [card.title, 80],
    [sortedItems(card.items).map((item) => item.group).join("\n"), 70],
    [sortedItems(card.items).map((item) => item.label).join("\n"), 60],
    [parseTags(card.tags).join(" "), 50],
    [tabName, 40],
    [sortedItems(card.items).map((item) => item.value).join("\n"), 30],
    [card.description, 15]
  ];
  let score = 0;
  let anyWholeMatch = false;
  let allTokensSomewhere = !tokens.length;

  for (const [value, weight] of fields) {
    const text = normalizeSearchText(value);
    if (!text) continue;
    if (text === query) {
      score += weight * 6;
      anyWholeMatch = true;
    } else if (text.startsWith(query)) {
      score += weight * 4;
      anyWholeMatch = true;
    } else if (text.includes(query)) {
      score += weight * 3;
      anyWholeMatch = true;
    }
    const tokenHits = tokens.filter((token) => text.includes(token)).length;
    if (tokenHits) score += tokenHits * weight;
  }

  if (tokens.length) {
    const allText = normalizeSearchText(fields.map(([value]) => value).join("\n"));
    allTokensSomewhere = tokens.every((token) => allText.includes(token));
  }
  return anyWholeMatch || allTokensSomewhere ? score : 0;
}

function compareCardsByRecency(a, b) {
  if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
  return new Date(b.updatedAt) - new Date(a.updatedAt);
}

export function normalizeActiveTabFilter(activeTabId) {
  if (Array.isArray(activeTabId)) return [...new Set(activeTabId.filter((id) => id && id !== "all"))];
  if (activeTabId instanceof Set) return normalizeActiveTabFilter([...activeTabId]);
  return activeTabId && activeTabId !== "all" ? [activeTabId] : [];
}

export function allTags(data) {
  return [...new Set((data.cards || []).flatMap((card) => parseTags(card.tags)))].sort((a, b) => a.localeCompare(b));
}
