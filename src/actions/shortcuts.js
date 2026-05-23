export function isTextEntryTarget(target) {
  if (!target?.closest) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable='true'], [data-cell-edit-input]"));
}

function submitActiveForm() {
  const active = document.activeElement;
  const form = active?.closest?.("form")
    || document.querySelector("#card-form")
    || document.querySelector("#quick-form")
    || document.querySelector("[data-table-quick-add]");
  form?.requestSubmit?.();
}

export function bindKeyboardShortcuts(deps) {
  const {
    state,
    startNewCard,
    openPanel,
    setViewMode,
    focusTableAdd,
    lockApp,
    cancelCellEdit,
    cancelLineEdit,
    cancelLineMove = () => {},
    closeEditor,
    saveCellEdit,
    saveLineEdit,
    scheduleSave,
    notify,
    selectedItemsInView,
    copySelectedInView
  } = deps;

  document.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    const typing = isTextEntryTarget(event.target);

    if (state.lock.locked) return;
    if (event.ctrlKey && event.shiftKey && key === "l") {
      event.preventDefault();
      lockApp();
      return;
    }
    if (event.ctrlKey && event.shiftKey && key === "n") {
      event.preventDefault();
      openPanel("quick");
      return;
    }
    if (event.ctrlKey && event.shiftKey && key === "a") {
      event.preventDefault();
      focusTableAdd();
      return;
    }
    if (event.altKey && ["1", "2"].includes(event.key)) {
      event.preventDefault();
      setViewMode(event.key === "1" ? "cards" : "table");
      return;
    }
    if (event.ctrlKey && event.key === "Enter") {
      event.preventDefault();
      submitActiveForm();
      return;
    }
    if (event.ctrlKey && key === "f") {
      event.preventDefault();
      document.querySelector("#search")?.focus();
      return;
    }
    if (event.ctrlKey && key === "n" && !typing) {
      event.preventDefault();
      startNewCard();
      return;
    }
    if (event.ctrlKey && key === "s") {
      event.preventDefault();
      if (state.editingCellKey) saveCellEdit();
      else if (state.editingLineKey) saveLineEdit();
      else if (state.editingCardId) document.querySelector("#card-form")?.requestSubmit?.();
      else {
        scheduleSave();
        notify("저장됨");
      }
      return;
    }
    if (event.key === "Escape") {
      const hadCell = Boolean(state.editingCellKey);
      const hadLine = Boolean(state.editingLineKey);
      const hadEditor = Boolean(state.editingCardId);
      const hadPanel = Boolean(state.activePanel);
      if (hadCell) cancelCellEdit();
      else if (hadLine) cancelLineEdit();
      else if (hadEditor) closeEditor();
      else if (state.activePanel === "line-move") cancelLineMove();
      else if (hadPanel) openPanel(state.activePanel);
      if (hadCell || hadLine || hadEditor || hadPanel) {
        event.preventDefault();
      }
      return;
    }
    if (event.ctrlKey && key === "c" && !typing) {
      const selected = selectedItemsInView();
      if (selected.length) {
        event.preventDefault();
        copySelectedInView(false);
      }
    }
  });
}
