import { describe, expect, test } from "bun:test";
import { createViewActions } from "./viewActions.js";

describe("view actions", () => {
  test("toggles visible copy sets as a group", () => {
    const state = { viewMode: "table", denseMode: true, collapsedSets: {} };
    let renders = 0;
    const { toggleVisibleSetCollapse } = createViewActions({ state, render: () => { renders += 1; } });

    toggleVisibleSetCollapse(["set:a", "set:b", "set:a"]);
    expect(state.collapsedSets).toEqual({ "set:a": true, "set:b": true });
    expect(renders).toBe(1);

    toggleVisibleSetCollapse(["set:a", "set:b"]);
    expect(state.collapsedSets).toEqual({});
    expect(renders).toBe(2);
  });
});
