import { describe, expect, test } from "bun:test";
import { createCopyActions } from "./copyActions.js";

function makeCopyHarness() {
  const calls = { writes: [], notices: [], renders: 0 };
  const state = {
    lastCopiedKey: "",
    lastCopiedText: "",
    data: { settings: { autoClearClipboard: false, clipboardClearSeconds: 30 } }
  };
  const actions = createCopyActions({
    state,
    feedbackMs: 1,
    writeText: async (value) => calls.writes.push(value),
    readText: async () => calls.writes.at(-1) || "",
    notify: (message) => calls.notices.push(message),
    render: () => { calls.renders += 1; }
  });
  return { actions, calls, state };
}

describe("copy actions", () => {
  test("keeps legacy copy feedback keys working", async () => {
    const { actions, calls, state } = makeCopyHarness();

    await actions.copyText("C:/data.json", "settings:path");

    expect(calls.writes).toEqual(["C:/data.json"]);
    expect(calls.notices).toContain("복사됨");
    expect(state.lastCopiedKey).toBe("settings:path");
    expect(state.lastCopiedText).toBe("C:/data.json");
  });

  test("shows structured line feedback without storing secret text in state", async () => {
    const { actions, calls, state } = makeCopyHarness();

    await actions.copyText("hidden-token", { key: "line:card-1:line-1", type: "line", label: "A.1", secret: true });

    expect(calls.writes).toEqual(["hidden-token"]);
    expect(calls.notices).toContain("[라인] A.1 복사됨 · 민감값");
    expect(state.lastCopiedKey).toBe("line:card-1:line-1");
    expect(state.lastCopiedText).toBe("");
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(state.lastCopiedKey).toBe("");
    expect(calls.renders).toBe(1);
  });

  test("formats card, block, and selected copy feedback", async () => {
    const { actions, calls } = makeCopyHarness();

    await actions.copyText("one\ntwo", { key: "card:1", type: "card", title: "계정", count: 2 });
    await actions.copyText("one", { key: "card:1", type: "block", count: 1 });
    await actions.copyText("a\tb", { key: "group:1:tab", type: "group-tab", label: "로그인", count: 2 });
    await actions.copyText("one\ntwo", { key: "selection", type: "selected", count: 2, includeLabels: true });

    expect(calls.notices).toEqual([
      "[카드] 계정 · 2줄 복사됨",
      "[블록] 1줄 복사됨",
      "[세트] 로그인 · 탭 구분 복사됨",
      "[선택] 2줄 복사됨 · 라벨 포함"
    ]);
  });

  test("keeps composite secret copies out of transient state", async () => {
    const { actions, calls, state } = makeCopyHarness();

    await actions.copyText("email\nsecret-password", { key: "card:secret", type: "card", title: "계정", count: 2, secret: true });

    expect(calls.writes).toEqual(["email\nsecret-password"]);
    expect(calls.notices).toContain("[카드] 계정 · 2줄 복사됨 · 민감값");
    expect(state.lastCopiedKey).toBe("card:secret");
    expect(state.lastCopiedText).toBe("");
  });
});
