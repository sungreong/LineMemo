import { describe, expect, test } from "bun:test";
import { createEmptyData, makeCard, parseLines } from "../domain.js";
import { createRenderers } from "./renderers.js";

describe("createRenderers", () => {
  test("fails fast when a renderer dependency is missing", () => {
    expect(() => createRenderers({ app: {}, state: {} })).toThrow("Missing renderer dependency: bindEvents");
  });

  test("renders editable cells without ReferenceError", () => {
    const data = createEmptyData();
    data.settings.acknowledgedPlainTextWarning = true;
    data.cards = [
      makeCard({
        title: "서버 접속",
        tabId: "ssh",
        description: "",
        tags: ["뉴스모니터링"],
        items: parseLines("command: ssh user@host")
      })
    ];
    const app = { innerHTML: "" };
    const state = {
      data,
      activeTabId: "all",
      query: "",
      selected: new Set(),
      revealed: new Set(),
      expandedCards: new Set(),
      collapsedCards: new Set(),
      activePanel: null,
      editingCardId: null,
      editorDraft: null,
      editingLineKey: null,
      lineEditDraft: null,
      editingCellKey: null,
      cellEditValue: "",
      editorItems: [],
      toast: "",
      lastCopiedKey: "",
      dataPath: "",
      denseMode: true,
      viewMode: "cards",
      showTableAdd: false,
      tableSortAsc: true,
      duplicateConflict: null,
      managerPages: { tabs: 1, tags: 1 }
    };
    const { render } = createRenderers({
      app,
      state,
      bindEvents: () => {},
      clampManagerPage: () => ({ page: 1, pageCount: 1, start: 0, end: 5 }),
      renderManagerPager: () => "",
      selectedItemsForCard: () => []
    });

    expect(() => render()).not.toThrow();
    expect(app.innerHTML).toContain("서버 접속");
    expect(app.innerHTML).toContain("toolbar-actions");
    expect(app.innerHTML).toContain("preview-actions");
    expect(app.innerHTML).toContain('type="button" class="icon-button');
    expect(app.innerHTML).toContain('aria-label="Tabs 열기"');
  });

  test("renders toolbar panels as dialogs", () => {
    const data = createEmptyData();
    data.settings.acknowledgedPlainTextWarning = true;
    const state = {
      data,
      activeTabId: "all",
      query: "",
      selected: new Set(),
      revealed: new Set(),
      expandedCards: new Set(),
      collapsedCards: new Set(),
      activePanel: "tabs",
      editingCardId: null,
      editorDraft: null,
      editingLineKey: null,
      lineEditDraft: null,
      editingCellKey: null,
      cellEditValue: "",
      editorItems: [],
      toast: "",
      lastCopiedKey: "",
      dataPath: "C:\\data.json",
      denseMode: true,
      viewMode: "cards",
      showTableAdd: false,
      tableSortAsc: true,
      duplicateConflict: null,
      managerPages: { tabs: 1, tags: 1 }
    };
    const app = { innerHTML: "" };
    const { render } = createRenderers({
      app,
      state,
      bindEvents: () => {},
      clampManagerPage: () => ({ page: 1, pageCount: 1, start: 0, end: 5 }),
      renderManagerPager: () => "",
      selectedItemsForCard: () => []
    });

    for (const panel of ["tabs", "tags", "settings"]) {
      state.activePanel = panel;
      render();
      expect(app.innerHTML).toContain('role="dialog"');
      expect(app.innerHTML).toContain('aria-modal="true"');
    }
  });
});
