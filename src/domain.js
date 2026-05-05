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
  acknowledgedPlainTextWarning: false
};

export const ITEM_TYPES = ["text", "url", "command", "code", "divider", "note"];

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
  const text = raw
    .replace(/(^|[\s,])#([^\s,#]+)/g, (_match, prefix, tag) => {
      const normalized = normalizeTag(tag);
      if (normalized) tags.push(normalized);
      return prefix && prefix.trim() ? prefix : " ";
    })
    .replace(/[,\s]+/g, " ")
    .trim();
  return {
    tags: [...new Set(tags)],
    text
  };
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
    settings: { ...DEFAULT_SETTINGS, ...(data.settings || {}) }
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
  if (lower.startsWith("http://") || lower.startsWith("https://")) return "url";
  if (/^(ssh|curl|python|pip|npm|uvicorn)\b/i.test(value)) return "command";
  return "text";
}

export function parseLines(text) {
  const time = nowIso();
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
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
    const changed = ["label", "value", "type", "secret"].some((key) => item[key] !== previous[key]);
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

export function searchCards(data, activeTabId, query) {
  const parsed = parseSearchQuery(query);
  const q = normalizeSearchText(parsed.text);
  const tagQueries = parsed.tags;
  const activeTabs = normalizeActiveTabFilter(activeTabId);
  const tabsById = new Map(data.tabs.map((tab) => [tab.id, tab]));
  return data.cards.filter((card) => {
    const inTab = !activeTabs.length || activeTabs.includes(card.tabId);
    if (!inTab) return false;
    if (tagQueries.length) {
      const cardTags = parseTags(card.tags);
      if (!tagQueries.some((tag) => cardTags.includes(tag))) return false;
    }
    if (!q) return true;
    const tabName = tabsById.get(card.tabId)?.name || "";
    const rawHaystack = [
      card.title,
      card.description,
      tabName,
      ...parseTags(card.tags).map((tag) => `#${tag} ${tag}`),
      ...card.items.flatMap((item) => [item.label, item.value])
    ].join("\n");
    const haystack = normalizeSearchText(rawHaystack);
    return haystack.includes(q);
  });
}

export function normalizeActiveTabFilter(activeTabId) {
  if (Array.isArray(activeTabId)) return [...new Set(activeTabId.filter((id) => id && id !== "all"))];
  if (activeTabId instanceof Set) return normalizeActiveTabFilter([...activeTabId]);
  return activeTabId && activeTabId !== "all" ? [activeTabId] : [];
}

export function allTags(data) {
  return [...new Set((data.cards || []).flatMap((card) => parseTags(card.tags)))].sort((a, b) => a.localeCompare(b));
}
