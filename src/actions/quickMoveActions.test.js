import { describe, expect, test } from "bun:test";
import { createEmptyData, DEFAULT_SPLIT_PATTERN, makeCard, parseLines } from "../domain.js";
import { clearQuickDraft, createEmptyDrafts } from "../state/drafts.js";
import { createLineMoveActions, moveLineBetweenCards } from "./lineMoveActions.js";
import { createQuickInputActions } from "./quickInputActions.js";

function makeState(data = createEmptyData()) {
  return {
    data,
    activePanel: "quick",
    activeTabId: "inbox",
    activeTabIds: ["inbox"],
    lastRealTabId: "inbox",
    query: "",
    selected: new Set(),
    expandedCards: new Set(),
    collapsedCards: new Set(),
    editingLineKey: null,
    lineEditDraft: null,
    movingLineKey: null,
    lineMoveDraft: null,
    drafts: createEmptyDrafts()
  };
}

function quickActions(state, overrides = {}) {
  const calls = [];
  return {
    calls,
    actions: createQuickInputActions({
      state,
      resolveDuplicatesBeforeAdd: () => false,
      scheduleSave: () => calls.push("save"),
      notify: (message) => calls.push(message),
      clearQuickDraft,
      render: () => calls.push("render"),
      ...overrides
    })
  };
}

describe("quick input actions", () => {
  test("creates a new card when no target card is selected", () => {
    const state = makeState();
    const { calls, actions } = quickActions(state);

    actions.submitQuickInput({ quickText: "hello world", quickTitle: "", quickTags: "api", targetCardId: "" });

    expect(state.data.cards).toHaveLength(1);
    expect(state.data.cards[0].title).toBe("hello world");
    expect(state.data.cards[0].tabId).toBe("inbox");
    expect(state.activePanel).toBeNull();
    expect(state.drafts.quick.targetCardId).toBe("");
    expect(calls).toContain("카드 생성됨");
  });

  test("adds pasted lines to the selected card and keeps order", () => {
    const data = createEmptyData();
    const card = makeCard({ title: "계정", tabId: "account", description: "", tags: [], items: parseLines("one") });
    data.cards = [card];
    const state = makeState(data);
    state.drafts.quick = { ...createEmptyDrafts().quick, title: "draft", tags: "api", text: "two\nthree", targetCardId: card.id };
    const { calls, actions } = quickActions(state);

    actions.submitQuickInput({ quickText: "two\nthree", targetCardId: card.id });

    expect(card.items.map((item) => item.order)).toEqual([1, 2, 3]);
    expect(card.items.map((item) => item.value)).toEqual(["one", "two", "three"]);
    expect(state.activeTabIds).toEqual(["account"]);
    expect(state.expandedCards.has(card.id)).toBe(true);
    expect(state.drafts.quick).toEqual(createEmptyDrafts().quick);
    expect(calls).toContain("계정/접속 · 계정 카드에 2줄 추가됨");
  });

  test("applies a representative label to quick input lines", () => {
    const state = makeState();
    const { actions } = quickActions(state);

    actions.submitQuickInput({ quickText: "first\nsecond", quickBaseLabel: "A", quickTitle: "", quickTags: "", targetCardId: "" });

    expect(state.data.cards[0].title).toBe("A");
    expect(state.data.cards[0].items.map((item) => item.label)).toEqual(["A.1", "A.2"]);
  });

  test("adds multiline blocks when quick input uses pattern splitting", () => {
    const data = createEmptyData();
    const card = makeCard({ title: "계정", tabId: "account", description: "", tags: [], items: parseLines("one") });
    data.cards = [card];
    const state = makeState(data);
    const { actions } = quickActions(state);

    actions.submitQuickInput({
      quickText: `alpha\nkept together\n${DEFAULT_SPLIT_PATTERN}\nbeta`,
      quickBaseLabel: "Block",
      quickSplitMode: "pattern",
      targetCardId: card.id
    });

    expect(card.items.map((item) => item.value)).toEqual(["one", "alpha\nkept together", "beta"]);
    expect(card.items.map((item) => item.label)).toEqual(["", "Block.1", "Block.2"]);
  });

  test("keeps quick draft when duplicate confirmation interrupts add", () => {
    const data = createEmptyData();
    const card = makeCard({ title: "계정", tabId: "account", description: "", tags: [], items: parseLines("one") });
    data.cards = [card];
    const state = makeState(data);
    state.drafts.quick = { ...createEmptyDrafts().quick, title: "draft", tags: "api", text: "one", targetCardId: card.id };
    const { actions } = quickActions(state, { resolveDuplicatesBeforeAdd: () => true });

    actions.submitQuickInput({ quickText: "one", targetCardId: card.id });

    expect(card.items).toHaveLength(1);
    expect(state.drafts.quick).toEqual({ ...createEmptyDrafts().quick, title: "draft", tags: "api", text: "one", targetCardId: card.id });
  });
});

describe("line move actions", () => {
  test("moves a line to another card while preserving identity and creation time", () => {
    const data = createEmptyData();
    const source = makeCard({ title: "원본", tabId: "inbox", description: "", tags: [], items: parseLines("alpha") });
    const target = makeCard({ title: "대상", tabId: "api", description: "", tags: [], items: parseLines("beta") });
    data.cards = [source, target];
    const line = source.items[0];
    const createdAt = line.createdAt;

    const result = moveLineBetweenCards(makeState(data), source.id, line.id, target.id, "2026-05-07T01:02:03.000Z");

    expect(result.target.id).toBe(target.id);
    expect(source.items).toHaveLength(0);
    expect(target.items).toHaveLength(2);
    expect(target.items[1].id).toBe(line.id);
    expect(target.items[1].createdAt).toBe(createdAt);
    expect(target.items[1].updatedAt).toBe("2026-05-07T01:02:03.000Z");
    expect(source.updatedAt).toBe("2026-05-07T01:02:03.000Z");
  });

  test("does not move when target is missing or the same card", () => {
    const data = createEmptyData();
    const source = makeCard({ title: "원본", tabId: "inbox", description: "", tags: [], items: parseLines("alpha") });
    data.cards = [source];
    const state = makeState(data);
    const calls = [];
    const actions = createLineMoveActions({
      state,
      scheduleSave: () => calls.push("save"),
      notify: (message) => calls.push(message),
      render: () => calls.push("render")
    });

    state.movingLineKey = `${source.id}:${source.items[0].id}`;
    state.lineMoveDraft = { targetCardId: source.id };
    actions.confirmLineMove();

    expect(source.items).toHaveLength(1);
    expect(calls).toContain("이동할 카드를 선택하세요");
    expect(calls).not.toContain("save");
  });
});
