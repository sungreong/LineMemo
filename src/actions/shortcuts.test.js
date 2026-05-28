import { afterEach, describe, expect, test } from "bun:test";
import { bindKeyboardShortcuts, isTextEntryTarget } from "./shortcuts.js";

const previousDocument = globalThis.document;

afterEach(() => {
  globalThis.document = previousDocument;
});

function bindForTest(overrides = {}) {
  const listeners = {};
  globalThis.document = {
    activeElement: null,
    addEventListener(type, listener) {
      listeners[type] = listener;
    },
    querySelector() {
      return { focus() {}, requestSubmit() {} };
    }
  };
  const calls = [];
  const deps = {
    state: { lock: { locked: false }, editingCellKey: null, editingLineKey: null, editingCardId: null, activePanel: null },
    startNewCard: () => calls.push("new-card"),
    openPanel: (panel) => calls.push(`panel:${panel}`),
    setViewMode: (mode) => calls.push(`view:${mode}`),
    focusTableAdd: () => calls.push("table-add"),
    lockApp: () => calls.push("lock"),
    cancelCellEdit: () => calls.push("cancel-cell"),
    cancelLineEdit: () => calls.push("cancel-line"),
    closeEditor: () => calls.push("close-editor"),
    saveCellEdit: () => calls.push("save-cell"),
    saveLineEdit: () => calls.push("save-line"),
    scheduleSave: () => calls.push("save"),
    notify: () => calls.push("notify"),
    selectedItemsInView: () => [],
    copySelectedInView: () => calls.push("copy-selected"),
    ...overrides
  };
  bindKeyboardShortcuts(deps);
  return { calls, keydown: listeners.keydown, deps };
}

function keyEvent(patch) {
  return {
    key: "",
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    target: { closest: () => null },
    preventDefault() {
      this.prevented = true;
    },
    ...patch
  };
}

describe("shortcut input guard", () => {
  test("detects text-entry targets", () => {
    expect(isTextEntryTarget({ closest: (selector) => selector.includes("input") })).toBe(true);
    expect(isTextEntryTarget({ closest: () => null })).toBe(false);
  });

  test("does not steal Ctrl+C from inputs", () => {
    const event = keyEvent({
      key: "c",
      ctrlKey: true,
      target: { closest: () => true }
    });
    const { calls, keydown } = bindForTest({ selectedItemsInView: () => [{ id: "line" }] });
    keydown(event);
    expect(calls).toEqual([]);
    expect(event.prevented).toBeUndefined();
  });
});

describe("global shortcuts", () => {
  test("routes new lock/table/view shortcuts", () => {
    const { calls, keydown } = bindForTest();
    keydown(keyEvent({ key: "L", ctrlKey: true, shiftKey: true }));
    keydown(keyEvent({ key: "A", ctrlKey: true, shiftKey: true }));
    keydown(keyEvent({ key: "2", altKey: true }));
    expect(calls).toEqual(["lock", "table-add", "view:table"]);
  });

  test("Ctrl+S commits active cell edits before generic save", () => {
    const { calls, keydown, deps } = bindForTest();
    deps.state.editingCellKey = "card|line|value";
    keydown(keyEvent({ key: "s", ctrlKey: true }));
    expect(calls).toEqual(["save-cell"]);
  });

  test("Escape closes the selected-row move panel", () => {
    const { calls, keydown, deps } = bindForTest({
      cancelSelectionMove: () => calls.push("cancel-selection-move")
    });
    deps.state.activePanel = "selection-move";
    const event = keyEvent({ key: "Escape" });

    keydown(event);

    expect(calls).toEqual(["cancel-selection-move"]);
    expect(event.prevented).toBe(true);
  });
});
