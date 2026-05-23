import { describe, expect, test } from "bun:test";
import { createEmptyData, makeCard, parseLines, sortedItems } from "../domain.js";
import { createSelectionActions } from "./selectionActions.js";

function stateWithCard(card, patch = {}) {
  return {
    data: { ...createEmptyData(), cards: [card] },
    activeTabId: "all",
    activeTabIds: [],
    query: "",
    selected: new Set(),
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
});
