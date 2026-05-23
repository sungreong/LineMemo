import { describe, expect, test } from "bun:test";
import {
  copyTextForItems,
  copyTextForOrderedItems,
  createEmptyData,
  DEFAULT_SPLIT_PATTERN,
  getBlocks,
  mergeLineTimestamps,
  normalizeData,
  normalizeSearchText,
  parsePasteItems,
  parseLineParts,
  parseLines,
  parseSearchQuery,
  parseTags,
  searchCards
} from "./domain.js";

const EMPTY_SEARCH_FIELDS = {
  title: [],
  values: [],
  labels: [],
  groups: [],
  tags: [],
  tab: [],
  description: []
};

describe("parseLines", () => {
  test("splits non-empty lines and infers divider, url, command, and text", () => {
    const items = parseLines("hello\n\n---\nhttps://example.com\nhttps://example.com/photo.png\nssh user@host\nnpm run dev");
    expect(items.map((item) => item.type)).toEqual(["text", "divider", "url", "image", "command", "command"]);
    expect(items[1].value).toBe("---");
    expect(items.every((item) => item.createdAt && item.updatedAt)).toBe(true);
  });

  test("detects label and copy value from common one-line patterns", () => {
    expect(parseLineParts("이메일 diglocas@gmail.com")).toEqual({ label: "이메일", value: "diglocas@gmail.com" });
    expect(parseLineParts("apikey: sk-test")).toEqual({ label: "apikey", value: "sk-test" });
    expect(parseLineParts("비밀번호 = hunter2")).toEqual({ label: "비밀번호", value: "hunter2" });
    expect(parseLineParts("diglocas@gmail.com")).toEqual({ label: "", value: "diglocas@gmail.com" });

    const items = parseLines("이메일 diglocas@gmail.com\napikey: sk-test");
    expect(items.map((item) => [item.label, item.value])).toEqual([
      ["이메일", "diglocas@gmail.com"],
      ["apikey", "sk-test"]
    ]);
  });

  test("can keep multiline blocks together when splitting by pattern", () => {
    const items = parsePasteItems(`alpha\nkept together\n${DEFAULT_SPLIT_PATTERN}\nbeta`, { splitMode: "pattern" });
    expect(items).toHaveLength(2);
    expect(items.map((item) => item.value)).toEqual(["alpha\nkept together", "beta"]);
    expect(items.map((item) => item.type)).toEqual(["text", "text"]);
  });

  test("supports a custom standalone split pattern", () => {
    const items = parsePasteItems("alpha\n+++MEMO+++\nbeta", { splitMode: "pattern", splitPattern: "+++MEMO+++" });
    expect(items.map((item) => item.value)).toEqual(["alpha", "beta"]);
  });
});

describe("copyTextForItems", () => {
  test("copies values in order and skips dividers", () => {
    const items = [
      { id: "b", label: "B", value: "second", type: "text", order: 2 },
      { id: "d", label: "", value: "---", type: "divider", order: 3 },
      { id: "a", label: "A", value: "first", type: "text", order: 1 }
    ];
    expect(copyTextForItems(items)).toBe("first\nsecond");
    expect(copyTextForItems(items, true)).toBe("A: first\nB: second");
    expect(copyTextForOrderedItems(items)).toBe("second\nfirst");
  });
});

describe("line timestamps", () => {
  test("normalizes legacy lines without inventing dates", () => {
    const data = normalizeData({
      cards: [{ id: "card", items: [{ id: "line", value: "old", order: 1 }] }]
    });
    expect(data.cards[0].items[0].createdAt).toBe("");
    expect(data.cards[0].items[0].updatedAt).toBe("");
    expect(data.cards[0].items[0].group).toBe("");
  });

  test("updates only changed lines when merging editor items", () => {
    const previous = [
      { id: "a", label: "A", value: "same", group: "계정", type: "text", secret: false, order: 1, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
      { id: "b", label: "B", value: "old", group: "", type: "text", secret: false, order: 2, createdAt: "", updatedAt: "" }
    ];
    const next = [
      { ...previous[0] },
      { ...previous[1], value: "new" }
    ];
    const merged = mergeLineTimestamps(next, previous, "2026-05-05T10:30:00.000Z");
    expect(merged[0].updatedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(merged[1].createdAt).toBe("");
    expect(merged[1].updatedAt).toBe("2026-05-05T10:30:00.000Z");
  });
});

describe("getBlocks", () => {
  test("splits by divider items", () => {
    const items = parseLines("one\n---\ntwo\nthree");
    expect(getBlocks(items).map((block) => block.map((item) => item.value))).toEqual([["one"], ["two", "three"]]);
  });
});

describe("searchCards", () => {
  test("filters by active tab and searches card and line text", () => {
    const data = createEmptyData();
    data.cards = [
      {
        id: "card-1",
        tabId: "ssh",
        title: "서버 접속",
        description: "",
        tags: ["prod", "password"],
        favorite: false,
        createdAt: "",
        updatedAt: "",
        items: [{ id: "line-1", label: "터널링", value: "ssh user@host", type: "command", secret: false, order: 1 }]
      },
      {
        id: "card-2",
        tabId: "api",
        title: "API",
        description: "",
        tags: ["apikey"],
        favorite: false,
        createdAt: "",
        updatedAt: "",
        items: [{ id: "line-2", label: "URL", value: "https://example.com", type: "url", secret: false, order: 1 }]
      }
    ];

    expect(searchCards(data, "all", "ssh")).toHaveLength(1);
    expect(searchCards(data, ["ssh", "api"], "")).toHaveLength(2);
    expect(searchCards(data, "api", "ssh")).toHaveLength(0);
    expect(searchCards(data, "api", "example")).toHaveLength(1);
    expect(searchCards(data, "all", "#apikey")).toHaveLength(1);
    expect(searchCards(data, "all", "password")).toHaveLength(1);
  });

  test("supports OR tag filters with optional text query", () => {
    const data = createEmptyData();
    data.cards = [
      {
        id: "card-news",
        tabId: "ssh",
        title: "서버 접속",
        description: "",
        tags: ["뉴스모니터링"],
        favorite: false,
        createdAt: "",
        updatedAt: "",
        items: [{ id: "line-news", label: "command", value: "ssh user@host", type: "command", secret: false, order: 1 }]
      },
      {
        id: "card-api",
        tabId: "api",
        title: "API 키",
        description: "",
        tags: ["api"],
        favorite: false,
        createdAt: "",
        updatedAt: "",
        items: [{ id: "line-api", label: "token", value: "sk-test", type: "text", secret: true, order: 1 }]
      },
      {
        id: "card-card",
        tabId: "account",
        title: "카드 정보",
        description: "",
        tags: ["롯데카드"],
        favorite: false,
        createdAt: "",
        updatedAt: "",
        items: [{ id: "line-card", label: "번호", value: "1234", type: "text", secret: false, order: 1 }]
      }
    ];

    expect(searchCards(data, "all", "#뉴스모니터링 #api").map((card) => card.id)).toEqual(["card-news", "card-api"]);
    expect(searchCards(data, "all", "#뉴스모니터링 ssh").map((card) => card.id)).toEqual(["card-news"]);
    expect(searchCards(data, "all", "#api ssh")).toHaveLength(0);
  });

  test("normalizes Korean search text before matching", () => {
    const data = createEmptyData();
    data.cards = [
      {
        id: "card-passport",
        tabId: "account",
        title: "여권 정보",
        description: "",
        tags: ["신분증"],
        favorite: false,
        createdAt: "",
        updatedAt: "",
        items: [{ id: "line-passport", label: "번호", value: "M12345678", type: "text", secret: false, order: 1 }]
      }
    ];

    expect(searchCards(data, "all", "여권").map((card) => card.id)).toEqual(["card-passport"]);
    expect(searchCards(data, "all", "여권").map((card) => card.id)).toEqual(["card-passport"]);
    expect(searchCards(data, "all", "ㅇㅕㄱㅝㄴ").map((card) => card.id)).toEqual(["card-passport"]);
    expect(searchCards(data, "all", "  여권  ").map((card) => card.id)).toEqual(["card-passport"]);
  });

  test("searches title, labels, values, tags, and tab names with field filters", () => {
    const data = createEmptyData();
    data.cards = [
      {
        id: "card-server",
        tabId: "ssh",
        title: "서버연동",
        description: "N8N 인증 정보",
        tags: ["서버", "연동"],
        favorite: false,
        createdAt: "",
        updatedAt: "2026-01-01T00:00:00.000Z",
        items: [
          { id: "line-tenant", label: "TenantId", value: "25f6ff02-1ae0-4719-a2b7", group: "MS Graph", type: "text", secret: false, order: 1 },
          { id: "line-secret", label: "ClientSecret", value: "secret-value", group: "MS Graph", type: "text", secret: true, order: 2 }
        ]
      },
      {
        id: "card-news",
        tabId: "api",
        title: "n8n 뉴스 브리핑",
        description: "",
        tags: ["뉴스모니터링"],
        favorite: false,
        createdAt: "",
        updatedAt: "2026-01-02T00:00:00.000Z",
        items: [
          { id: "line-email", label: "담당자", value: "digiloca@lottecard.co.kr", type: "text", secret: false, order: 1 }
        ]
      }
    ];

    expect(searchCards(data, "all", "제목:n8n").map((card) => card.id)).toEqual(["card-news"]);
    expect(searchCards(data, "all", "label:tenant").map((card) => card.id)).toEqual(["card-server"]);
    expect(searchCards(data, "all", "값:digiloca").map((card) => card.id)).toEqual(["card-news"]);
    expect(searchCards(data, "all", "묶음:graph").map((card) => card.id)).toEqual(["card-server"]);
    expect(searchCards(data, "all", "태그:서버").map((card) => card.id)).toEqual(["card-server"]);
    expect(searchCards(data, "all", "tab:api").map((card) => card.id)).toEqual(["card-news"]);
    expect(searchCards(data, "all", "tenant 25f6").map((card) => card.id)).toEqual(["card-server"]);
    expect(searchCards(data, "all", "digiloca lottecard").map((card) => card.id)).toEqual(["card-news"]);
  });

  test("ranks card names and labels ahead of lower value-only matches", () => {
    const data = createEmptyData();
    data.cards = [
      {
        id: "card-value",
        tabId: "api",
        title: "서버 환경",
        description: "",
        tags: [],
        favorite: false,
        createdAt: "",
        updatedAt: "2026-01-03T00:00:00.000Z",
        items: [{ id: "line-value", label: "메모", value: "api api api api", type: "text", secret: false, order: 1 }]
      },
      {
        id: "card-title",
        tabId: "api",
        title: "API 키",
        description: "",
        tags: [],
        favorite: false,
        createdAt: "",
        updatedAt: "2026-01-01T00:00:00.000Z",
        items: [{ id: "line-title", label: "값", value: "secret", type: "text", secret: true, order: 1 }]
      }
    ];

    expect(searchCards(data, "all", "api").map((card) => card.id)).toEqual(["card-title", "card-value"]);
  });
});

describe("parseTags", () => {
  test("normalizes comma, whitespace, hash prefixes, and duplicates", () => {
    expect(parseTags("APIKey, #비밀번호 apikey  prod")).toEqual(["apikey", "비밀번호", "prod"]);
  });
});

describe("parseSearchQuery", () => {
  test("extracts multiple tags and preserves text", () => {
    expect(parseSearchQuery("#뉴스 #api ssh")).toEqual({ tags: ["뉴스", "api"], text: "ssh", fields: EMPTY_SEARCH_FIELDS });
    expect(parseSearchQuery("ssh #뉴스, #api #뉴스")).toEqual({ tags: ["뉴스", "api"], text: "ssh", fields: EMPTY_SEARCH_FIELDS });
  });

  test("extracts scoped field filters from the same search box", () => {
    expect(parseSearchQuery("제목:n8n 값:digiloca label:tenant 묶음:graph ssh")).toEqual({
      tags: [],
      text: "ssh",
      fields: {
        ...EMPTY_SEARCH_FIELDS,
        title: ["n8n"],
        values: ["digiloca"],
        labels: ["tenant"],
        groups: ["graph"]
      }
    });
  });
});

describe("normalizeSearchText", () => {
  test("composes Hangul variants into the same searchable form", () => {
    expect(normalizeSearchText("여권")).toBe("여권");
    expect(normalizeSearchText("ㅇㅕㄱㅝㄴ")).toBe("여권");
    expect(normalizeSearchText("  Passport\u200b  ")).toBe("passport");
  });
});
