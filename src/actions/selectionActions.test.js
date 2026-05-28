import { describe, expect, test } from "bun:test";
import { createEmptyData, makeCard, parseLines, sortedItems } from "../domain.js";
import { createSelectionActions } from "./selectionActions.js";

function stateWithCard(card, patch = {}) {
  return stateWithCards([card], patch);
}

function stateWithCards(cards, patch = {}) {
  return {
    data: { ...createEmptyData(), cards },
    activeTabId: "all",
    activeTabIds: [],
    lastRealTabId: "inbox",
    query: "",
    selected: new Set(),
    expandedCards: new Set(),
    collapsedCards: new Set(),
    activePanel: null,
    selectionMoveDraft: null,
    viewMode: "table",
    tableSortAsc: true,
    ...patch
  };
}

describe("selection actions", () => {
  test("assigns a line group to selected rows in the current view", () => {
    const card = makeCard({
      title: "계정",
      tabId: "account",
      description: "",
      tags: [],
      items: parseLines("gitlab user\ngitlab비번 pass\ngitlab-token token")
    });
    const [user, pass] = sortedItems(card.items);
    const state = stateWithCard(card);
    state.selected.add(`${card.id}:${user.id}`);
    state.selected.add(`${card.id}:${pass.id}`);
    const calls = [];
    const actions = createSelectionActions({
      state,
      copyText: async () => {},
      selectedItemsForCard: () => [],
      render: () => calls.push("render"),
      scheduleSave: () => calls.push("save"),
      notify: (message) => calls.push(message)
    });

    expect(actions.groupSelectedInView("gitlab")).toBe(true);
    expect(user.group).toBe("gitlab");
    expect(pass.group).toBe("gitlab");
    expect(calls).toContain("save");
    expect(calls).toContain("render");
    expect(calls).toContain("2줄을 'gitlab' 세트로 지정함");
  });

  test("requires at least two lines before creating a group", () => {
    const card = makeCard({ title: "계정", tabId: "account", description: "", tags: [], items: parseLines("one") });
    const [line] = sortedItems(card.items);
    const state = stateWithCard(card);
    state.selected.add(`${card.id}:${line.id}`);
    const calls = [];
    const actions = createSelectionActions({
      state,
      copyText: async () => {},
      selectedItemsForCard: () => [],
      render: () => calls.push("render"),
      scheduleSave: () => calls.push("save"),
      notify: (message) => calls.push(message)
    });

    expect(actions.groupSelectedInView("solo")).toBe(false);
    expect(line.group || "").toBe("");
    expect(calls).toEqual(["세트로 묶을 줄을 2개 이상 선택하세요"]);
  });

  test("marks selected copy as sensitive when any selected line is secret", async () => {
    const card = makeCard({
      title: "계정",
      tabId: "account",
      description: "",
      tags: [],
      items: parseLines("email user@example.com\npassword hidden")
    });
    const [email, password] = sortedItems(card.items);
    password.secret = true;
    const state = stateWithCard(card);
    state.selected.add(`${card.id}:${email.id}`);
    state.selected.add(`${card.id}:${password.id}`);
    const calls = [];
    const actions = createSelectionActions({
      state,
      copyText: async (text, feedback) => calls.push({ text, feedback }),
      selectedItemsForCard: () => [],
      render: () => {},
      scheduleSave: () => {}
    });

    await actions.copySelectedInView(false);

    expect(calls[0].text).toContain("hidden");
    expect(calls[0].feedback.secret).toBe(true);
  });

  test("moves selected rows to another existing card", () => {
    const source = makeCard({ title: "원본", tabId: "inbox", description: "", tags: [], items: parseLines("alpha\nbeta\nstay") });
    const target = makeCard({ title: "대상", tabId: "api", description: "", tags: [], items: parseLines("existing") });
    const [alpha, beta] = sortedItems(source.items);
    const state = stateWithCards([source, target]);
    state.selected.add(`${source.id}:${alpha.id}`);
    state.selected.add(`${source.id}:${beta.id}`);
    const calls = [];
    const actions = createSelectionActions({
      state,
      copyText: async () => {},
      selectedItemsForCard: () => [],
      render: () => calls.push("render"),
      scheduleSave: () => calls.push("save"),
      notify: (message) => calls.push(message)
    });

    expect(actions.startSelectionMove()).toBe(true);
    expect(state.activePanel).toBe("selection-move");
    expect(state.selectionMoveDraft.targetCardId).toBe(target.id);
    expect(actions.confirmSelectionMove()).toBe(true);

    expect(source.items.map((item) => item.value)).toEqual(["stay"]);
    expect(target.items.map((item) => item.value)).toEqual(["existing", "alpha", "beta"]);
    expect(target.items.map((item) => item.order)).toEqual([1, 2, 3]);
    expect(state.selected.size).toBe(0);
    expect(state.activePanel).toBeNull();
    expect(state.activeTabIds).toEqual(["api"]);
    expect(state.expandedCards.has(target.id)).toBe(true);
    expect(calls).toContain("save");
    expect(calls).toContain("API · 대상 카드로 2줄 이동됨");
  });

  test("moves selected rows into a new card on another tab", () => {
    const source = makeCard({ title: "원본", tabId: "inbox", description: "", tags: [], items: parseLines("alpha\nbeta\nstay") });
    const [alpha, beta] = sortedItems(source.items);
    const state = stateWithCards([source]);
    state.selected.add(`${source.id}:${alpha.id}`);
    state.selected.add(`${source.id}:${beta.id}`);
    const calls = [];
    const actions = createSelectionActions({
      state,
      copyText: async () => {},
      selectedItemsForCard: () => [],
      render: () => calls.push("render"),
      scheduleSave: () => calls.push("save"),
      notify: (message) => calls.push(message)
    });

    actions.startSelectionMove();
    actions.updateSelectionMoveMode("new-card");
    actions.updateSelectionMoveTab("api");
    actions.updateSelectionMoveTitle("옮긴 카드");

    expect(actions.confirmSelectionMove()).toBe(true);
    const movedCard = state.data.cards[0];
    expect(movedCard.title).toBe("옮긴 카드");
    expect(movedCard.tabId).toBe("api");
    expect(movedCard.items.map((item) => item.value)).toEqual(["alpha", "beta"]);
    expect(source.items.map((item) => item.value)).toEqual(["stay"]);
    expect(state.selected.size).toBe(0);
    expect(state.activeTabIds).toEqual(["api"]);
    expect(calls).toContain("save");
    expect(calls).toContain("API · 옮긴 카드로 2줄 이동됨");
  });
});
