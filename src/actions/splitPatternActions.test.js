import { afterEach, describe, expect, test } from "bun:test";
import { DEFAULT_SPLIT_PATTERN } from "../domain.js";
import { createSplitPatternActions } from "./splitPatternActions.js";

const RealFormData = globalThis.FormData;

afterEach(() => {
  globalThis.FormData = RealFormData;
});

function fakeForm(pattern, field) {
  globalThis.FormData = class {
    get(name) {
      return name === "quickSplitPattern" ? pattern : "";
    }
  };
  return {
    querySelector(selector) {
      return selector === "[name='quickText'], [name='quickValues'], #paste-area" ? field : null;
    }
  };
}

describe("split pattern actions", () => {
  test("inserts the split pattern on its own line and returns focus", () => {
    const events = [];
    const field = {
      value: "안녕하세요",
      selectionStart: 5,
      selectionEnd: 5,
      dispatchEvent: (event) => events.push(event.type),
      focus: () => events.push("focus"),
      setSelectionRange: (start, end) => events.push(`cursor:${start}:${end}`)
    };
    const actions = createSplitPatternActions({ copyText: () => {}, notify: () => {} });

    actions.insertSplitPattern(fakeForm(DEFAULT_SPLIT_PATTERN, field));

    expect(field.value).toBe(`안녕하세요\n${DEFAULT_SPLIT_PATTERN}\n`);
    expect(events).toContain("input");
    expect(events).toContain("focus");
    expect(events).toContain(`cursor:${field.value.length}:${field.value.length}`);
  });

  test("prefers the textarea beside the clicked insert button", () => {
    const localField = {
      value: "local",
      selectionStart: 5,
      selectionEnd: 5,
      dispatchEvent: () => {},
      focus: () => {},
      setSelectionRange: () => {}
    };
    const fallbackField = { ...localField, value: "fallback" };
    const trigger = { closest: () => ({ querySelector: () => localField }) };
    const actions = createSplitPatternActions({ copyText: () => {}, notify: () => {} });

    actions.insertSplitPattern(fakeForm(DEFAULT_SPLIT_PATTERN, fallbackField), trigger);

    expect(localField.value).toBe(`local\n${DEFAULT_SPLIT_PATTERN}\n`);
    expect(fallbackField.value).toBe("fallback");
  });
});
