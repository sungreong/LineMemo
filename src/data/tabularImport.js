import { ITEM_TYPES, normalizeData, normalizeDateOnly, nowIso, parseTags, uid } from "../domain.js";

const COLUMN_ALIASES = {
  "탭": "tab",
  "카드": "title",
  "제목": "title",
  "태그": "tags",
  "설명": "description",
  "라벨": "label",
  "값": "value",
  "내용": "value",
  "타입": "type",
  "유형": "type",
  "비밀": "secret",
  "유효기간": "expiresAt",
  "만료일": "expiresAt",
  "묶음": "group",
  "세트": "group"
};

function headerKey(value) {
  const key = String(value || "").replace(/^\uFEFF/, "").trim().toLocaleLowerCase();
  return COLUMN_ALIASES[key] || key;
}

function detectDelimiter(text) {
  const header = String(text || "").split(/\r?\n/, 1)[0] || "";
  const counts = [[",", 0], ["\t", 0], [";", 0]];
  for (const entry of counts) entry[1] = header.split(entry[0]).length - 1;
  return counts.sort((a, b) => b[1] - a[1])[0][0] || ",";
}

export function parseDelimitedRows(text, delimiter = detectDelimiter(text)) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const input = String(text || "").replace(/\r\n?/g, "\n");

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      row.push(cell);
      cell = "";
    } else if (char === "\n" && !quoted) {
      row.push(cell);
      if (row.some((value) => String(value).trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some((value) => String(value).trim())) rows.push(row);
  return rows;
}

function importTabId(name, tabs) {
  const label = String(name || "Inbox").trim() || "Inbox";
  const match = tabs.find((tab) => [tab.id, tab.name].some((value) => String(value).toLocaleLowerCase() === label.toLocaleLowerCase()));
  if (match) return match.id;

  const slug = label.toLocaleLowerCase().replace(/[^a-z0-9가-힣]+/g, "-").replace(/^-+|-+$/g, "");
  const base = slug ? `import-${slug}` : uid("tab");
  let id = base;
  let suffix = 2;
  while (tabs.some((tab) => tab.id === id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }
  tabs.push({ id, name: label, order: tabs.length, system: false });
  return id;
}

function isSecret(value) {
  return ["true", "1", "yes", "y", "secret", "비밀", "예"].includes(String(value || "").trim().toLocaleLowerCase());
}

export function mergeTabularImport(data, text) {
  const normalized = normalizeData(data);
  const rows = parseDelimitedRows(text);
  if (rows.length < 2) throw new Error("첫 줄은 헤더, 다음 줄부터 데이터가 필요합니다.");

  const headers = rows[0].map(headerKey);
  if (!headers.includes("title") || !headers.includes("value")) {
    throw new Error("title, value 컬럼은 반드시 필요합니다.");
  }

  const tabs = normalized.tabs.map((tab) => ({ ...tab }));
  const importedCards = [];
  const byCard = new Map();
  const timestamp = nowIso();
  let lineCount = 0;

  for (const values of rows.slice(1)) {
    const record = Object.fromEntries(headers.map((key, index) => [key, String(values[index] || "").trim()]));
    if (!Object.values(record).some(Boolean)) continue;
    const title = record.title || record.label || "가져온 카드";
    const value = record.value || "";
    const type = ITEM_TYPES.includes(record.type) ? record.type : "text";
    if (type !== "divider" && !value && !record.label) continue;

    const tabId = importTabId(record.tab, tabs);
    const tags = parseTags(record.tags);
    const cardKey = [tabId, title, tags.join(","), record.description || ""].join("\u001f");
    let card = byCard.get(cardKey);
    if (!card) {
      card = {
        id: uid("card"),
        tabId,
        title,
        description: record.description || "",
        tags,
        favorite: false,
        createdAt: timestamp,
        updatedAt: timestamp,
        items: []
      };
      byCard.set(cardKey, card);
      importedCards.push(card);
    }

    card.items.push({
      id: uid("line"),
      label: record.label || "",
      value,
      type,
      secret: isSecret(record.secret),
      expiresAt: normalizeDateOnly(record.expiresAt || record.validUntil || record.expiryDate),
      group: record.group || "",
      order: card.items.length + 1,
      createdAt: timestamp,
      updatedAt: timestamp
    });
    lineCount += 1;
  }

  if (!lineCount) throw new Error("추가할 줄을 찾지 못했습니다.");
  return {
    data: normalizeData({ ...normalized, tabs, cards: [...normalized.cards, ...importedCards] }),
    cardCount: importedCards.length,
    lineCount
  };
}
