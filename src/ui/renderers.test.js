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

  test("renders manager filters and row selection actions", () => {
    const data = createEmptyData();
    data.settings.acknowledgedPlainTextWarning = true;
    data.cards = [
      makeCard({
        title: "서버",
        tabId: "ssh",
        description: "",
        tags: ["server"],
        items: parseLines("ssh user@host")
      })
    ];
    const state = {
      data,
      activeTabId: "ssh",
      activeTabIds: ["ssh"],
      lastRealTabId: "ssh",
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
      dataPath: "",
      denseMode: true,
      viewMode: "cards",
      showTableAdd: false,
      tableSortAsc: true,
      duplicateConflict: null,
      managerPages: { tabs: 1, tags: 1 },
      managerFilters: { tabQuery: "ssh", tabVisibility: "lines", tabSort: "lines", tagQuery: "", tagSort: "name" }
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

    render();
    expect(app.innerHTML).toContain('data-manager-field="tabQuery"');
    expect(app.innerHTML).toContain('data-action="manager-select-tab"');
    expect(app.innerHTML).toContain("SSH/서버");

    state.activePanel = "tags";
    state.managerFilters = { ...state.managerFilters, tagQuery: "server", tagSort: "cards" };
    render();
    expect(app.innerHTML).toContain('data-manager-field="tagQuery"');
    expect(app.innerHTML).toContain('data-action="manager-select-tag"');
    expect(app.innerHTML).toContain("#server");
  });

  test("renders line editor history metadata for legacy lines", () => {
    const data = createEmptyData();
    data.settings.acknowledgedPlainTextWarning = true;
    data.cards = [
      {
        id: "card-legacy",
        tabId: "inbox",
        title: "기존 카드",
        description: "",
        tags: [],
        favorite: false,
        createdAt: "2026-05-05T01:02:00.000Z",
        updatedAt: "2026-05-05T02:03:00.000Z",
        items: [{ id: "line-legacy", label: "라벨", value: "값", type: "text", secret: false, order: 1, createdAt: "", updatedAt: "" }]
      }
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
      activePanel: "line-editor",
      editingCardId: null,
      editorDraft: null,
      editingLineKey: "card-legacy:line-legacy",
      lineEditDraft: { label: "라벨", value: "값", type: "text", secret: false },
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

    render();
    expect(app.innerHTML).toContain("line-history");
    expect(app.innerHTML).toContain("카드 생성");
    expect(app.innerHTML).toContain("2026-05-05");
    expect(app.innerHTML).toContain("기록 없음");
  });
});
