import { describe, expect, test } from "bun:test";
import { normalizeData } from "../domain.js";
import { clearEditorDraftSnapshot, restoreEditorDraft, saveEditorDraftSnapshot } from "./editorDraftPersistence.js";

describe("card editor draft persistence", () => {
  test("stores new-card drafts in app data settings and restores them without localStorage", () => {
    const state = {
      data: normalizeData(null),
      editingCardId: "new",
      activePanel: "editor",
      editorDraft: {
        title: "복구 테스트",
        tabId: "prompt",
        tags: "draft",
        description: "",
        quickValues: "saved through data json",
        quickSplitMode: "line",
        quickSplitPattern: "---LINE---"
      },
      editorItems: []
    };

    expect(saveEditorDraftSnapshot(state)).toBe(true);
    expect(state.data.settings.cardEditorDraftSnapshot.draft.title).toBe("복구 테스트");

    const restored = {
      data: normalizeData({ settings: state.data.settings }),
      editingCardId: null,
      activePanel: null,
      editorDraft: null,
      editorItems: []
    };
    expect(restoreEditorDraft(restored)).toBe(true);
    expect(restored.editingCardId).toBe("new");
    expect(restored.activePanel).toBe("editor");
    expect(restored.editorDraft.quickValues).toBe("saved through data json");
  });

  test("clears app-data snapshots when the editor closes", () => {
    const state = { data: normalizeData({ settings: { cardEditorDraftSnapshot: { cardId: "new" } } }) };
    clearEditorDraftSnapshot(state);
    expect(state.data.settings.cardEditorDraftSnapshot).toBeUndefined();
  });
});
