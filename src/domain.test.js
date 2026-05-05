import { describe, expect, test } from "bun:test";
import { copyTextForItems, createEmptyData, getBlocks, parseLineParts, parseLines, parseSearchQuery, parseTags, searchCards } from "./domain.js";

describe("parseLines", () => {
  test("splits non-empty lines and infers divider, url, command, and text", () => {
    const items = parseLines("hello\n\n---\nhttps://example.com\nssh user@host\nnpm run dev");
    expect(items.map((item) => item.type)).toEqual(["text", "divider", "url", "command", "command"]);
    expect(items[1].value).toBe("---");
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
});

describe("parseTags", () => {
  test("normalizes comma, whitespace, hash prefixes, and duplicates", () => {
    expect(parseTags("APIKey, #비밀번호 apikey  prod")).toEqual(["apikey", "비밀번호", "prod"]);
  });
});

describe("parseSearchQuery", () => {
  test("extracts multiple tags and preserves text", () => {
    expect(parseSearchQuery("#뉴스 #api ssh")).toEqual({ tags: ["뉴스", "api"], text: "ssh" });
    expect(parseSearchQuery("ssh #뉴스, #api #뉴스")).toEqual({ tags: ["뉴스", "api"], text: "ssh" });
  });
});
