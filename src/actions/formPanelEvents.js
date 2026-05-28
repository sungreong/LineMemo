import { syncDraftField } from "../state/drafts.js";
import { bindQuickPastePreview } from "../ui/quickPastePreview.js";
import { bindManagerControls } from "./managerControls.js";

export function bindFormPanelEvents({
  state,
  render,
  quickPaste,
  saveEditor,
  syncEditorDraft,
  quickAddLineFromForm,
  updateLineMoveTarget,
  updateLineMoveQuery,
  updateSelectionMoveMode,
  updateSelectionMoveTarget,
  updateSelectionMoveQuery,
  updateSelectionMoveTab,
  updateSelectionMoveTitle,
  updateEditorLine,
  updateSetting,
  startCellEdit,
  saveCellEdit,
  cancelCellEdit,
  updateLineEditDraft,
  saveLineEdit,
  cancelLineEdit,
  renderTagPreview,
  handleImport,
  toggleSelected
}) {
  document.querySelector("#quick-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    quickPaste(event.currentTarget);
  });

  document.querySelector("#card-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    saveEditor(event.currentTarget);
  });
  document.querySelector("#card-form")?.addEventListener("input", syncEditorDraft);
  document.querySelector("#card-form")?.addEventListener("change", (event) => { syncEditorDraft(); if (event.target.name === "quickSplitMode") render(); });

  document.querySelectorAll("[data-draft]").forEach((control) => {
    const eventName = control.type === "checkbox" || control.tagName === "SELECT" ? "change" : "input";
    control.addEventListener(eventName, (event) => {
      syncDraftField(event.currentTarget, state);
      if (event.currentTarget.dataset.draftRender === "true") render();
    });
  });
  bindQuickPastePreview();

  document.querySelector("[data-line-move-target]")?.addEventListener("change", (event) => updateLineMoveTarget(event.currentTarget.value));
  document.querySelector("[data-line-move-query]")?.addEventListener("input", (event) => updateLineMoveQuery(event.currentTarget.value));
  document.querySelector("[data-selection-move-mode]")?.addEventListener("change", (event) => updateSelectionMoveMode(event.currentTarget.value));
  document.querySelector("[data-selection-move-target]")?.addEventListener("change", (event) => updateSelectionMoveTarget(event.currentTarget.value));
  document.querySelector("[data-selection-move-query]")?.addEventListener("input", (event) => updateSelectionMoveQuery(event.currentTarget.value));
  document.querySelector("[data-selection-move-tab]")?.addEventListener("change", (event) => updateSelectionMoveTab(event.currentTarget.value));
  document.querySelector("[data-selection-move-title]")?.addEventListener("input", (event) => updateSelectionMoveTitle(event.currentTarget.value));

  document.querySelector("[data-table-quick-add]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    quickAddLineFromForm(event.currentTarget);
  });

  document.querySelectorAll("[data-quick-line-form]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      quickAddLineFromForm(event.currentTarget);
    });
  });

  document.querySelectorAll("[data-field]").forEach((control) => {
    control.addEventListener("input", (event) => {
      const row = event.target.closest(".edit-line");
      const field = event.target.dataset.field;
      const value = field === "secret" ? event.target.checked : event.target.value;
      const patch = { [field]: value };
      if (field === "type" && value === "divider") {
        patch.value = "---";
        row.querySelector("[data-field='value']").value = "---";
      }
      updateEditorLine(row.dataset.id, patch);
    });
  });

  document.querySelectorAll("[data-setting]").forEach((control) => {
    control.addEventListener("change", (event) => {
      const key = event.target.dataset.setting;
      const type = event.target.dataset.settingType || "";
      const value = event.target.type === "checkbox"
        ? event.target.checked
        : type === "string"
          ? event.target.value
          : Number(event.target.value);
      updateSetting(key, value);
    });
  });

  document.querySelectorAll("[data-cell-edit]").forEach((element) => {
    element.addEventListener("dblclick", (event) => {
      startCellEdit(event.currentTarget.dataset.card, event.currentTarget.dataset.id, event.currentTarget.dataset.field);
    });
  });

  document.querySelectorAll("[data-cell-edit-input]").forEach((control) => {
    control.addEventListener("input", (event) => {
      state.cellEditValue = event.currentTarget.value;
    });
    control.addEventListener("change", (event) => {
      state.cellEditValue = event.currentTarget.value;
      if (event.currentTarget.tagName === "SELECT") saveCellEdit();
    });
    control.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey && event.currentTarget.tagName !== "TEXTAREA") {
        event.preventDefault();
        saveCellEdit();
      }
      if (event.key === "Escape") {
        event.preventDefault();
        cancelCellEdit();
      }
    });
    control.addEventListener("blur", () => {
      if (state.editingCellKey) saveCellEdit();
    });
  });

  document.querySelectorAll("[data-line-edit-field]").forEach((control) => {
    control.addEventListener("input", (event) => {
      const field = event.currentTarget.dataset.lineEditField;
      const value = event.currentTarget.type === "checkbox" ? event.currentTarget.checked : event.currentTarget.value;
      updateLineEditDraft({ [field]: value });
      if (field === "type" && value === "divider") {
        const valueInput = document.querySelector("[data-line-edit-value]");
        if (valueInput) valueInput.value = "---";
      }
      if (field === "type") render();
    });
    control.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey && event.currentTarget.tagName !== "TEXTAREA") {
        event.preventDefault();
        saveLineEdit();
      }
      if (event.key === "Escape") {
        event.preventDefault();
        cancelLineEdit();
      }
    });
  });

  document.querySelectorAll("[data-tag-input]").forEach((input) => {
    const preview = input.closest("form")?.querySelector("[data-tag-preview]");
    const sync = () => {
      if (preview) preview.innerHTML = renderTagPreview(input.value);
    };
    sync();
    input.addEventListener("input", sync);
  });

  document.querySelector("#import-file")?.addEventListener("change", (event) => handleImport(event.target.files?.[0]));

  bindManagerControls({ state, render });

  document.querySelectorAll("[data-action='select-line']").forEach((box) => {
    box.addEventListener("change", (event) => {
      toggleSelected(event.target.dataset.card, event.target.dataset.id, event.target.checked);
      render();
    });
  });
}
