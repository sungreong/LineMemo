import { describe, expect, test } from "bun:test";
import { createEmptyData, DEFAULT_SPLIT_PATTERN, makeCard, parseLines } from "../domain.js";
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
    expect(app.innerHTML).toContain('aria-label="탭 관리 열기"');
    expect(app.innerHTML).toContain('class="view-group"');
    expect(app.innerHTML).toContain("density-subtoggle active-toggle");
    expect(app.innerHTML).toContain("<span>압축</span>");
    expect(app.innerHTML).toContain('data-action="toggle-collapse-all"');
    expect(app.innerHTML).toContain("<span>접기</span>");

    state.viewMode = "table";
    render();
    expect(app.innerHTML).not.toContain("density-subtoggle");
    expect(app.innerHTML).not.toContain('data-action="toggle-collapse-all"');
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

  test("renders search affordance, first-run copy, and storage notice", () => {
    const data = createEmptyData();
    const app = { innerHTML: "" };
    const { render } = createRenderers({
      app,
      state: makeRendererState(data),
      bindEvents: () => {},
      clampManagerPage: () => ({ page: 1, pageCount: 1, start: 0, end: 5 }),
      renderManagerPager: () => "",
      selectedItemsForCard: () => []
    });

    render();

    expect(app.innerHTML).toContain('placeholder="카드명, 값, 라벨 또는 #태그 검색"');
    expect(app.innerHTML).toContain('title="카드명, 설명, 탭, 태그, 라벨, 값까지 검색합니다. 값:ssh, 제목:서버처럼 필드 검색도 가능합니다"');
    expect(app.innerHTML).toContain('aria-label="카드명, 설명, 탭, 태그, 라벨, 값 검색"');
    expect(app.innerHTML).toContain('title="빈 카드 만들기"');
    expect(app.innerHTML).toContain("아직 카드 없음");
    expect(app.innerHTML).toContain("반복해서 쓰는 문구를 카드로 저장하세요.");
    expect(app.innerHTML).toContain("카드명, 값, 라벨 또는 #태그로 다시 찾아");
    expect(app.innerHTML).toContain("로컬 평문 저장");
    expect(app.innerHTML).toContain("화면 숨김과 앱 잠금은 보안 저장소가 아닙니다.");
    expect(app.innerHTML).toContain("이해했습니다");
  });

  test("renders compact search match reasons", () => {
    const data = createEmptyData();
    data.settings.acknowledgedPlainTextWarning = true;
    data.cards = [
      makeCard({
        title: "서버 접속",
        tabId: "ssh",
        description: "",
        tags: ["prod"],
        items: parseLines("command: ssh user@host")
      })
    ];
    const app = { innerHTML: "" };
    const state = makeRendererState(data, { query: "서버" });
    const { render } = createRenderers({
      app,
      state,
      bindEvents: () => {},
      clampManagerPage: () => ({ page: 1, pageCount: 1, start: 0, end: 5 }),
      renderManagerPager: () => "",
      selectedItemsForCard: () => []
    });

    render();
    expect(app.innerHTML).toContain("카드명 일치");
    expect(app.innerHTML).toContain("1 / 1 결과");

    state.query = "ssh";
    render();
    expect(app.innerHTML).toContain("값 일치");

    state.query = "#prod";
    render();
    expect(app.innerHTML).toContain("#태그 일치");
  });

  test("renders scalable tag counts and compact type-specific line viewers", () => {
    const data = createEmptyData();
    data.settings.acknowledgedPlainTextWarning = true;
    data.cards = [
      makeCard({
        title: "LangChain",
        tabId: "code",
        description: "",
        tags: ["코드", "복붙", "api", "apikey", "팀즈", "서버", "연동", "프롬프트", "sql", "url", "image", "python", "n8n", "테스트"],
        items: [
          { id: "line-code", label: "Streaming", value: "from langchain_openai import ChatOpenAI\nllm = ChatOpenAI(\n    temperature=0,\n)", group: "ChatOpenAI", type: "code", secret: false, order: 1 },
          { id: "line-image", label: "diagram", value: "https://example.com/diagram.png", group: "ChatOpenAI", type: "image", secret: false, order: 2 }
        ]
      })
    ];
    const app = { innerHTML: "" };
    const state = makeRendererState(data, { activeTabId: "code", activeTabIds: ["code"] });
    const { render } = createRenderers({
      app,
      state,
      bindEvents: () => {},
      clampManagerPage: () => ({ page: 1, pageCount: 1, start: 0, end: 5 }),
      renderManagerPager: () => "",
      selectedItemsForCard: () => []
    });

    render();
    expect(app.innerHTML).toContain("<small>1</small>");
    expect(app.innerHTML).toContain("태그 관리에서");
    expect(app.innerHTML).toContain("line-value-details");
    expect(app.innerHTML).toContain('class="line-type-pill">code</span>');
    expect(app.innerHTML).toContain("4줄");
    expect(app.innerHTML).toContain('class="line-type-pill">img</span>');
    expect(app.innerHTML).toContain('src="https://example.com/diagram.png"');
    expect(app.innerHTML).toContain("ChatOpenAI · 2");
    expect(app.innerHTML).toContain('data-action="copy-line-group"');

    state.query = "Streaming";
    render();
    expect(app.innerHTML).toContain("diagram");

    state.query = "";
    state.viewMode = "table";
    render();
    expect(app.innerHTML).toContain("grouped-row");
    expect(app.innerHTML).toContain("ChatOpenAI · 2");
  });

  test("does not leak secret values through hidden cell titles", () => {
    const data = createEmptyData();
    data.settings.acknowledgedPlainTextWarning = true;
    data.cards = [
      makeCard({
        title: "계정",
        tabId: "account",
        description: "",
        tags: [],
        items: [{ id: "line-secret", label: "비밀번호", value: "real-password", type: "text", secret: true, order: 1 }]
      })
    ];
    const app = { innerHTML: "" };
    const state = makeRendererState(data, { activeTabId: "account", activeTabIds: ["account"], viewMode: "table" });
    const { render } = createRenderers({
      app,
      state,
      bindEvents: () => {},
      clampManagerPage: () => ({ page: 1, pageCount: 1, start: 0, end: 5 }),
      renderManagerPager: () => "",
      selectedItemsForCard: () => []
    });

    render();
    expect(app.innerHTML).toContain("********");
    expect(app.innerHTML).not.toContain("real-password");
    expect(app.innerHTML).toContain('title="********"');

    state.revealed.add("line-secret");
    render();
    expect(app.innerHTML).toContain("real-password");
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
    expect(app.innerHTML).toContain('data-action="manager-focus-tab"');
    expect(app.innerHTML).toContain('data-action="manager-select-tab"');
    expect(app.innerHTML).toContain("tab-manager-panel");
    expect(app.innerHTML).toContain("manager-shell");
    expect(app.innerHTML).toContain("선택한 탭");
    expect(app.innerHTML).toContain("현재 선택");
    expect(app.innerHTML).toContain("manager-card-row");
    expect(app.innerHTML).toContain("SSH/서버");

    state.activePanel = "tags";
    state.managerFilters = { ...state.managerFilters, tagQuery: "server", tagSort: "cards" };
    render();
    expect(app.innerHTML).toContain('data-manager-field="tagQuery"');
    expect(app.innerHTML).toContain('data-action="manager-focus-tag"');
    expect(app.innerHTML).toContain('data-action="manager-select-tag"');
    expect(app.innerHTML).toContain("#server");
    expect(app.innerHTML).toContain("1개 카드에서 변경됨");
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
      lineEditDraft: { label: "라벨", value: "값", type: "text", secret: false, expiresAt: "2026-12-31" },
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
    expect(app.innerHTML).toContain("line-history-details");
    expect(app.innerHTML).toContain('data-line-edit-field="group"');
    expect(app.innerHTML).toContain("예: MS Graph 인증");
    expect(app.innerHTML).toContain("기록 보기");
    expect(app.innerHTML).not.toContain("<details class=\"line-history-details\" open");
    expect(app.innerHTML).toContain('rows="9"');
    expect(app.innerHTML).toContain("유효기간");
    expect(app.innerHTML).toContain("2026-12-31");
    expect(app.innerHTML).toContain("카드 생성");
    expect(app.innerHTML).toContain("2026-05-05");
    expect(app.innerHTML).toContain("기록 없음");
  });

  test("renders lock screen without leaking card values", () => {
    const data = createEmptyData();
    data.cards = [makeCard({ title: "비밀 카드", tabId: "inbox", description: "", tags: [], items: parseLines("token: should-not-render") })];
    const app = { innerHTML: "" };
    const { render } = createRenderers({
      app,
      state: makeRendererState(data, { lock: { locked: true, reason: "timeout", unlockError: "" } }),
      bindEvents: () => {},
      clampManagerPage: () => ({ page: 1, pageCount: 1, start: 0, end: 5 }),
      renderManagerPager: () => "",
      selectedItemsForCard: () => []
    });

    render();
    expect(app.innerHTML).toContain("LineMemo 잠김");
    expect(app.innerHTML).not.toContain("should-not-render");
  });

  test("renders lock settings and preserved input drafts", () => {
    const data = createEmptyData();
    data.cards = [makeCard({ title: "계정", tabId: "account", description: "", tags: [], items: parseLines("email user@example.com") })];
    const app = { innerHTML: "" };
    const state = makeRendererState(data, {
      activeTabId: "account",
      activeTabIds: ["account"],
      activePanel: "settings",
      settingsTab: "security",
      viewMode: "table",
      showTableAdd: true,
      drafts: {
        quick: { title: "드래프트", tags: "api", text: "one\ntwo", targetCardId: "", baseLabel: "", expiresAt: "", splitMode: "line", splitPattern: DEFAULT_SPLIT_PATTERN },
        tableAdd: { cardId: data.cards[0].id, lineLabel: "pw", lineValue: "typed-value", lineExpiresAt: "2026-12-31" },
        quickLines: {}
      }
    });
    const { render } = createRenderers({
      app,
      state,
      bindEvents: () => {},
      clampManagerPage: () => ({ page: 1, pageCount: 1, start: 0, end: 5 }),
      renderManagerPager: () => "",
      selectedItemsForCard: () => []
    });

    render();
    expect(app.innerHTML).toContain("앱 잠금");
    expect(app.innerHTML).toContain("잠금 켜기");
    state.activePanel = null;
    render();
    expect(app.innerHTML).toContain('name="lineValue"');
    expect(app.innerHTML).toContain(">typed-value</textarea>");
    expect(app.innerHTML).toContain('name="lineExpiresAt"');
    expect(app.innerHTML).toContain("2026-12-31");
    state.activePanel = "quick";
    render();
    expect(app.innerHTML).toContain("one\ntwo");
    startNewCardState(state);
    render();
    expect(app.innerHTML).toContain("new-card-help");
    expect(app.innerHTML).toContain("붙여넣은 줄");
    expect(app.innerHTML).toContain("제목이 비어 있으면 첫 줄 사용");
    expect(app.innerHTML).toContain("라벨은 : 또는 = 로 자동 인식");
    expect(app.innerHTML).toContain("설명과 줄 세부 편집");
    expect(app.innerHTML).toContain("paste-options");
    expect(app.innerHTML).toContain('name="quickSplitMode"');
    expect(app.innerHTML).toContain("editor-import-head");
    expect(app.innerHTML).toContain("여러 줄 가져오기");
    expect(app.innerHTML).toContain("여러 줄을 붙여넣으면 아래 상세 줄로 변환됩니다");
    expect(app.innerHTML).toContain("붙여넣기만으로도 카드 생성 가능");
    expect(app.innerHTML).not.toContain('name="quickSplitPattern"');
    expect(app.innerHTML).not.toContain('data-action="insert-split-pattern"');
    state.editorDraft.quickSplitMode = "pattern";
    state.editorDraft.quickSplitPattern = DEFAULT_SPLIT_PATTERN;
    render();
    expect(app.innerHTML).toContain('name="quickSplitPattern"');
    expect(app.innerHTML).toContain('data-action="copy-split-pattern"');
    expect(app.innerHTML).toContain('data-action="insert-split-pattern"');
    expect(app.innerHTML).toContain("패턴 넣기");
  });

  test("renders multiline values in textarea editors", () => {
    const data = createEmptyData();
    const card = makeCard({
      title: "Snippet",
      tabId: "code",
      description: "",
      tags: [],
      items: [{ id: "line-code", label: "python", value: "def run():\n    return 1", type: "text", secret: false, order: 1 }]
    });
    data.cards = [card];
    const app = { innerHTML: "" };
    const state = makeRendererState(data, {
      activeTabId: "code",
      activeTabIds: ["code"],
      viewMode: "table",
      showTableAdd: true,
      drafts: {
        quick: { title: "", tags: "", text: "", targetCardId: "", baseLabel: "", expiresAt: "", splitMode: "line", splitPattern: DEFAULT_SPLIT_PATTERN },
        tableAdd: { cardId: card.id, lineLabel: "", lineValue: "alpha\n  beta", lineExpiresAt: "" },
        quickLines: {}
      }
    });
    const { render } = createRenderers({
      app,
      state,
      bindEvents: () => {},
      clampManagerPage: () => ({ page: 1, pageCount: 1, start: 0, end: 5 }),
      renderManagerPager: () => "",
      selectedItemsForCard: () => []
    });

    render();
    expect(app.innerHTML).toContain('<textarea name="lineValue"');
    expect(app.innerHTML).toContain("alpha\n  beta</textarea>");
    expect(app.innerHTML).toContain("def run():\n    return 1");

    state.editingCellKey = `${card.id}|line-code|value`;
    state.cellEditValue = "first\n  second";
    render();
    expect(app.innerHTML).toContain('<textarea class="cell-edit-input');
    expect(app.innerHTML).toContain("first\n  second</textarea>");
  });

  test("renders settings guidance and keyboard shortcuts", () => {
    const data = createEmptyData();
    const app = { innerHTML: "" };
    const { render } = createRenderers({
      app,
      state: makeRendererState(data, { activePanel: "settings", settingsTab: "help" }),
      bindEvents: () => {},
      clampManagerPage: () => ({ page: 1, pageCount: 1, start: 0, end: 5 }),
      renderManagerPager: () => "",
      selectedItemsForCard: () => []
    });

    render();
    expect(app.innerHTML).toContain("settings-tabs");
    expect(app.innerHTML).toContain('data-tab="behavior"');
    expect(app.innerHTML).toContain('data-tab="help"');
    expect(app.innerHTML).not.toContain("저장 위치");
    expect(app.innerHTML).toContain("빠른 사용법");
    expect(app.innerHTML).toContain("새 카드");
    expect(app.innerHTML).toContain("단축키");
    for (const key of ["Ctrl+N", "Ctrl+Shift+N", "Ctrl+Shift+A", "Ctrl+Shift+L", "Alt+1 / 2", "Ctrl+Enter", "Ctrl+S", "Ctrl+C", "Escape"]) {
      expect(app.innerHTML).toContain(key);
    }
  });

  test("renders save confirmation setting", () => {
    const data = createEmptyData();
    const app = { innerHTML: "" };
    const { render } = createRenderers({
      app,
      state: makeRendererState(data, { activePanel: "settings", settingsTab: "behavior" }),
      bindEvents: () => {},
      clampManagerPage: () => ({ page: 1, pageCount: 1, start: 0, end: 5 }),
      renderManagerPager: () => "",
      selectedItemsForCard: () => []
    });

    render();
    expect(app.innerHTML).toContain('data-setting="confirmBeforeSave"');
    expect(app.innerHTML).toContain("저장 전 확인");
  });

  test("renders configurable data path controls", () => {
    const data = createEmptyData();
    const app = { innerHTML: "" };
    const { render } = createRenderers({
      app,
      state: makeRendererState(data, {
        activePanel: "settings",
        settingsTab: "data",
        dataPath: "D:\\LineMemo\\data.json",
        storagePath: { path: "D:\\LineMemo\\data.json", defaultPath: "C:\\data.json", custom: true }
      }),
      bindEvents: () => {},
      clampManagerPage: () => ({ page: 1, pageCount: 1, start: 0, end: 5 }),
      renderManagerPager: () => "",
      selectedItemsForCard: () => []
    });

    render();
    expect(app.innerHTML).toContain("사용자 지정");
    expect(app.innerHTML).toContain('data-action="set-data-path"');
    expect(app.innerHTML).toContain('data-action="reset-data-path"');
    expect(app.innerHTML).not.toContain('data-action="reset-data-path" disabled');
  });

  test("renders quick input destination choices and target-card mode", () => {
    const data = createEmptyData();
    data.cards = [makeCard({ title: "계정 카드", tabId: "account", description: "", tags: [], items: parseLines("email user@example.com") })];
    const app = { innerHTML: "" };
    const state = makeRendererState(data, { activePanel: "quick", activeTabId: "inbox", activeTabIds: ["inbox"] });
    const { render } = createRenderers({
      app,
      state,
      bindEvents: () => {},
      clampManagerPage: () => ({ page: 1, pageCount: 1, start: 0, end: 5 }),
      renderManagerPager: () => "",
      selectedItemsForCard: () => []
    });

    render();
    expect(app.innerHTML).toContain("quick-destination");
    expect(app.innerHTML).toContain("저장 위치");
    expect(app.innerHTML).toContain("Inbox 탭 · 새 카드");
    expect(app.innerHTML).toContain("새 카드로 저장 (기본)");
    expect(app.innerHTML).toContain("현재 탭 0카드 · 0줄");
    expect(app.innerHTML).toContain("계정/접속 탭 · 1카드 · 1줄");
    expect(app.innerHTML).toContain("계정 카드 · 1줄");
    expect(app.innerHTML).toContain('name="quickTitle"');
    expect(app.innerHTML).toContain('name="quickBaseLabel"');
    expect(app.innerHTML).toContain('name="quickSplitMode"');
    expect(app.innerHTML).not.toContain('name="quickSplitPattern"');
    expect(app.innerHTML).not.toContain('data-action="insert-split-pattern"');
    expect(app.innerHTML).not.toContain(DEFAULT_SPLIT_PATTERN);

    state.drafts.quick.splitMode = "pattern";
    render();
    expect(app.innerHTML).toContain('name="quickSplitPattern"');
    expect(app.innerHTML).toContain(DEFAULT_SPLIT_PATTERN);
    expect(app.innerHTML).toContain('data-action="copy-split-pattern"');
    expect(app.innerHTML).toContain('data-action="insert-split-pattern"');
    expect(app.innerHTML).toContain("분리 기준");
    expect(app.innerHTML).toContain("패턴 넣기");
    expect(app.innerHTML).toContain('for="quick-text"');

    state.drafts.quick.targetCardId = data.cards[0].id;
    render();
    expect(app.innerHTML).toContain("계정/접속 탭 · 계정 카드");
    expect(app.innerHTML).toContain("현재 1줄 있음");
    expect(app.innerHTML).toContain("줄 추가");
    expect(app.innerHTML).not.toContain('name="quickTitle"');
  });

  test("renders line move action and target-card modal", () => {
    const data = createEmptyData();
    const source = makeCard({ title: "원본", tabId: "inbox", description: "", tags: [], items: parseLines("token source") });
    const target = makeCard({ title: "대상", tabId: "api", description: "", tags: [], items: parseLines("key target") });
    data.cards = [source, target];
    const app = { innerHTML: "" };
    const state = makeRendererState(data, { expandedCards: new Set([source.id]) });
    const { render } = createRenderers({
      app,
      state,
      bindEvents: () => {},
      clampManagerPage: () => ({ page: 1, pageCount: 1, start: 0, end: 5 }),
      renderManagerPager: () => "",
      selectedItemsForCard: () => []
    });

    render();
    expect(app.innerHTML).toContain('data-action="move-line"');
    expect(app.innerHTML).toContain('aria-label="줄 이동"');

    state.activePanel = "line-move";
    state.movingLineKey = `${source.id}:${source.items[0].id}`;
    state.lineMoveDraft = { targetCardId: target.id };
    render();
    expect(app.innerHTML).toContain("줄 이동");
    expect(app.innerHTML).toContain("line-move-flow");
    expect(app.innerHTML).toContain("From");
    expect(app.innerHTML).toContain("To");
    expect(app.innerHTML).toContain('data-line-move-query');
    expect(app.innerHTML).toContain("카드명 또는 탭 검색");
    expect(app.innerHTML).toContain("이동할 카드");
    expect(app.innerHTML).toContain("API 탭");
    expect(app.innerHTML).toContain("대상");
    expect(app.innerHTML).not.toContain(`<option value="${source.id}"`);
  });

  test("renders delete confirmation with temporary skip action", () => {
    const data = createEmptyData();
    const app = { innerHTML: "" };
    const { render } = createRenderers({
      app,
      state: makeRendererState(data, {
        deleteConfirm: {
          message: "카드를 삭제할까요?",
          detail: "계정 카드와 안의 줄이 삭제됩니다."
        }
      }),
      bindEvents: () => {},
      clampManagerPage: () => ({ page: 1, pageCount: 1, start: 0, end: 5 }),
      renderManagerPager: () => "",
      selectedItemsForCard: () => []
    });

    render();
    expect(app.innerHTML).toContain("delete-confirm-panel");
    expect(app.innerHTML).toContain("5분 동안 다시 묻지 않기");
    expect(app.innerHTML).toContain('name="skipDeleteConfirm"');
    expect(app.innerHTML).toContain("계정 카드와 안의 줄이 삭제됩니다.");
  });
});

function makeRendererState(data, overrides = {}) {
  return {
    data,
    activeTabId: "all",
    activeTabIds: [],
    lastRealTabId: "inbox",
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
    managerPages: { tabs: 1, tags: 1 },
    managerFilters: { tabQuery: "", tabVisibility: "all", tabSort: "order", tagQuery: "", tagSort: "name" },
    drafts: { quick: { title: "", tags: "", text: "", targetCardId: "", baseLabel: "", expiresAt: "", splitMode: "line", splitPattern: DEFAULT_SPLIT_PATTERN }, tableAdd: { cardId: "", lineLabel: "", lineValue: "", lineExpiresAt: "" }, quickLines: {} },
    movingLineKey: null,
    lineMoveDraft: null,
    deleteConfirm: null,
    deleteConfirmMutedUntil: 0,
    lock: { locked: false, reason: "", unlockError: "" },
    ...overrides
  };
}

function startNewCardState(state) {
  state.activePanel = "editor";
  state.editingCardId = "new";
  state.editorDraft = { title: "", tabId: "account", tags: "", description: "", quickValues: "one\ntwo", quickExpiresAt: "" };
}
